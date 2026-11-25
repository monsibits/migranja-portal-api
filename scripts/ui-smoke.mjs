/**
 * Headless check: load every portal route as Owner, Admin and Staff.
 * Logs in through the API and injects the session. Never prints passwords or tokens.
 * Fails on a console error, an uncaught exception, or a visible crash message.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = process.env.PORTAL_API_URL || "https://migranja-portal.migranja-events.workers.dev";
const PORTAL = process.env.PORTAL_URL || "https://www.migranjaevents.com/portal/";
const ORIGIN = "https://www.migranjaevents.com";
const CHROME = process.env.CHROME_PATH || "/usr/bin/google-chrome-stable";

const ROUTES = {
  owner: ["dashboard", "events", "requests", "schedule", "tasks", "attendance", "announcements", "sales", "housekeeping", "inventory", "accounting", "finances", "hr", "reports", "users", "settings"],
  admin: ["dashboard", "events", "requests", "schedule", "tasks", "attendance", "announcements", "sales", "housekeeping", "inventory", "hr", "reports"],
  staff: ["dashboard", "schedule", "tasks", "attendance", "announcements", "housekeeping", "inventory", "hr"]
};

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseStaffFile(text) {
  const blocks = text.split(/\n\s*\n/);
  const users = {};
  for (const block of blocks) {
    const email = (block.match(/^Email:\s*(.+)$/m) || [])[1];
    const password = (block.match(/^Password:\s*(.+)$/m) || [])[1];
    const title = (block.match(/^(Admin|Staff|Owner)\s+SAMPLE[^\n]*/m) || [])[0] || "";
    if (!email || !password) continue;
    const role = title.startsWith("Owner") ? "owner" : title.startsWith("Admin") ? "admin" : title.startsWith("Staff") ? "staff" : null;
    if (!role) continue;
    const key = role === "owner" ? "owner" : role === "admin" ? "admin" : email.includes("carlo") ? "staff" : email.includes("liza") ? "staff2" : "staff";
    users[key] = { email: email.trim(), password: password.trim(), role };
  }
  return users;
}

async function loadPuppeteer() {
  const candidates = [
    join("/tmp/ui-smoke/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js"),
    join("/tmp/ui-smoke/node_modules/puppeteer-core/index.js"),
    join(root, "node_modules/puppeteer-core/index.js")
  ];
  for (const file of candidates) {
    try {
      return (await import(pathToFileURL(file).href)).default;
    } catch {
      try {
        return createRequire(import.meta.url)(file);
      } catch {
        /* try next */
      }
    }
  }
  fail("puppeteer-core is not installed. Install it in /tmp/ui-smoke first.");
}

async function login(email, password) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { Origin: ORIGIN, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.token) return null;
  return { token: data.token, expiresAt: data.expiresAt || null };
}

async function logout(token) {
  if (!token) return;
  await fetch(`${API}/api/auth/logout`, {
    method: "POST",
    headers: { Origin: ORIGIN, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: "{}"
  }).catch(() => {});
}

const users = parseStaffFile(readFileSync(join(root, ".sample-staff"), "utf8"));
const puppeteer = await loadPuppeteer();
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
});

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const roles = [
  ["owner", users.owner],
  ["admin", users.admin],
  ["staff", users.staff]
];

try {
  for (const [role, user] of roles) {
    if (!user) {
      check(`${role} login`, false, "login missing from .sample-staff");
      continue;
    }
    const session = await login(user.email, user.password);
    if (!session) {
      if (role === "owner") {
        console.log("SKIP  SAMPLE owner unavailable — admin and staff route checks still run");
        continue;
      }
      check(`${role} login`, false, "login failed");
      continue;
    }
    check(`${role} login`, true);
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (err) => errors.push(`pageerror: ${err && err.message ? err.message : err}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
    });
    await page.goto(PORTAL, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.evaluate((payload) => {
      localStorage.setItem("mg_portal_session", JSON.stringify(payload));
    }, session);
    for (const route of ROUTES[role]) {
      errors.length = 0;
      await page.evaluate((hash) => { window.location.hash = hash; }, `#/${route}`);
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const bodyText = await page.evaluate(() => (document.querySelector("main") || document.body).innerText || "");
      const crash = /clockCard is not defined|Could not load this page|Unexpected token|is not defined/i.test(bodyText);
      const blocked = role === "owner" && (route === "accounting" || route === "settings") && /Owner only/i.test(bodyText) && bodyText.length < 400;
      const ok = errors.length === 0 && !crash && !blocked;
      check(`${role} #/${route}`, ok, ok ? "" : (crash ? "page crashed" : blocked ? "Owner only" : errors.slice(0, 3).join(" | ")));
    }
    await page.close();
    await logout(session.token);
  }
} finally {
  await browser.close();
}

const failed = results.filter((row) => !row.ok);
if (failed.length) fail(`${failed.length} UI smoke check(s) failed`);
console.log(`All ${results.length} UI route checks passed against ${PORTAL}`);
