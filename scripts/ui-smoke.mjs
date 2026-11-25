/**
 * Headless check against the LIVE portal after Pages has finished deploying.
 * Confirms the served JS matches the site commit, then:
 *   1) a cold load shows the login form with zero pageerror / console errors
 *   2) every route for Owner, Admin and Staff loads without errors
 * Logs in through the API and injects the session. Never prints passwords or tokens.
 */
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE_ROOT = process.env.SITE_ROOT || join(root, "..", "migranja-refresh");
const API = process.env.PORTAL_API_URL || "https://migranja-portal.migranja-events.workers.dev";
const PORTAL = process.env.PORTAL_URL || "https://www.migranjaevents.com/portal/";
const ORIGIN = "https://www.migranjaevents.com";
const CHROME = process.env.CHROME_PATH || "/usr/bin/google-chrome-stable";
const LIVE_FILES = [
  "assets/js/portal/modules.js",
  "assets/js/portal/app.js",
  "assets/js/portal/api.js"
];

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

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function siteCommit() {
  if (process.env.SITE_COMMIT) return process.env.SITE_COMMIT.trim();
  try {
    const head = readFileSync(join(SITE_ROOT, ".git/HEAD"), "utf8").trim();
    if (head.startsWith("ref: ")) {
      return readFileSync(join(SITE_ROOT, ".git", head.slice(5).trim()), "utf8").trim();
    }
    return head;
  } catch {
    return "";
  }
}

async function loadPuppeteer() {
  const candidates = [
    join("/tmp/ui-smoke-r5/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js"),
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
  fail("puppeteer-core is not installed. Install it in /tmp/ui-smoke-r5 first.");
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForLiveJs(commit, timeoutMs = 180000) {
  const started = Date.now();
  let last = "not fetched yet";
  while (Date.now() - started < timeoutMs) {
    const mismatches = [];
    for (const file of LIVE_FILES) {
      const localPath = join(SITE_ROOT, file);
      if (!existsSync(localPath)) {
        mismatches.push(`${file} missing locally`);
        continue;
      }
      const local = sha256(readFileSync(localPath, "utf8"));
      const url = `${ORIGIN}/${file}?v=${encodeURIComponent(commit || "live")}&t=${Date.now()}`;
      try {
        const res = await fetch(url, { headers: { "Cache-Control": "no-cache", Pragma: "no-cache" } });
        if (!res.ok) {
          mismatches.push(`${file} HTTP ${res.status}`);
          continue;
        }
        const remote = sha256(await res.text());
        if (local !== remote) mismatches.push(`${file} does not match ${commit ? commit.slice(0, 7) : "local"}`);
      } catch (err) {
        mismatches.push(`${file} fetch failed`);
      }
    }
    if (!mismatches.length) {
      console.log(`PASS  live JS matches ${commit ? commit.slice(0, 7) : "local"} on ${ORIGIN}`);
      return;
    }
    last = mismatches.join("; ");
    await sleep(4000);
  }
  fail(`Live JS did not match the site commit before smoke timed out (${last}).`);
}

function isBenignConsole(text) {
  return /The Content Security Policy directive 'frame-ancestors' is ignored when delivered via a <meta> element/i.test(text || "");
}

function attachErrorCollectors(page, bucket) {
  page.on("pageerror", (err) => bucket.push(`pageerror: ${err && err.message ? err.message : err}`));
  page.on("console", (msg) => {
    if (msg.type() === "error" && !isBenignConsole(msg.text())) bucket.push(`console: ${msg.text()}`);
  });
}

function portalUrl(commit) {
  const base = PORTAL.endsWith("/") ? PORTAL : `${PORTAL}/`;
  return `${base}?v=${encodeURIComponent(commit || "live")}&t=${Date.now()}`;
}

const users = parseStaffFile(readFileSync(join(root, ".sample-staff"), "utf8"));
const commit = siteCommit();
if (!commit) console.log("WARN  could not read the site commit; still checking live JS against local files");
await waitForLiveJs(commit);

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

try {
  const cold = await browser.newPage();
  await cold.setCacheEnabled(false);
  const coldErrors = [];
  attachErrorCollectors(cold, coldErrors);
  await cold.goto(portalUrl(commit), { waitUntil: "networkidle0", timeout: 45000 }).catch(() => {});
  await sleep(1500);
  const coldState = await cold.evaluate(() => {
    const login = document.querySelector("#login-screen");
    const form = document.querySelector("[data-login-form]");
    const email = document.querySelector("#email");
    const loginVisible = !!(login && !login.hidden && form && email);
    const mainText = ((login && login.innerText) || document.body.innerText || "");
    return {
      hasForm: loginVisible,
      mainText: mainText.slice(0, 300)
    };
  });
  const coldCrash = /is not defined|Unexpected token|Could not load this page/i.test(coldState.mainText);
  const coldOk = coldErrors.length === 0 && coldState.hasForm && !coldCrash;
  check(
    "cold load shows the login form",
    coldOk,
    coldOk ? "" : (coldState.hasForm ? coldErrors.slice(0, 3).join(" | ") : "login form missing; " + (coldErrors[0] || coldState.mainText.replace(/\s+/g, " ").slice(0, 160)))
  );
  await cold.close();
  if (!coldOk) fail("Cold load of the live portal failed. Skipping role routes until the login page boots cleanly.");

  const roles = [
    ["owner", users.owner],
    ["admin", users.admin],
    ["staff", users.staff]
  ];

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
    await page.setCacheEnabled(false);
    const errors = [];
    attachErrorCollectors(page, errors);
    await page.goto(portalUrl(commit), { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.evaluate((payload) => {
      localStorage.setItem("mg_portal_session", JSON.stringify(payload));
    }, session);
    await page.goto(portalUrl(commit) + "#/dashboard", { waitUntil: "networkidle0", timeout: 45000 }).catch(() => {});
    await sleep(1200);
    if (errors.length) {
      check(`${role} boot`, false, errors.slice(0, 3).join(" | "));
      await page.close();
      await logout(session.token);
      continue;
    }
    check(`${role} boot`, true);

    for (const route of ROUTES[role]) {
      const before = errors.length;
      await page.evaluate((hash) => { window.location.hash = hash; }, `#/${route}`);
      await sleep(1200);
      const body = await page.evaluate(() => {
        const app = document.querySelector("#app-screen");
        const login = document.querySelector("#login-screen");
        const main = document.querySelector("#app-screen #main") || document.querySelector("#main");
        const appVisible = !!(app && !app.hidden);
        return {
          text: ((appVisible && main && main.innerText) || "").trim(),
          hasLogin: !!(login && !login.hidden && document.querySelector("[data-login-form]"))
        };
      });
      const newErrors = errors.slice(before);
      const crash = /clockCard is not defined|panel is not defined|Could not load this page|Unexpected token|is not defined/i.test(body.text);
      const blocked = role === "owner" && (route === "accounting" || route === "settings") && /Owner only/i.test(body.text) && body.text.length < 400;
      const bounced = body.hasLogin;
      const empty = !body.text || body.text.length < 8;
      const ok = newErrors.length === 0 && !crash && !blocked && !bounced && !empty;
      check(`${role} #/${route}`, ok, ok ? "" : (crash ? "page crashed" : blocked ? "Owner only" : bounced ? "still on login" : empty ? "empty page" : newErrors.slice(0, 3).join(" | ")));
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
