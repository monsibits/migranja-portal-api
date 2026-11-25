/**
 * Post-deploy smoke test. Reads sample logins from .sample-staff
 * (never prints passwords or tokens). Creates one SAMPLE record per
 * new module, then checks a few high-priority guards.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = process.env.PORTAL_API_URL || "https://migranja-portal.migranja-events.workers.dev";
const ORIGIN = "https://www.migranjaevents.com";

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

async function request(path, { method = "GET", token, body, raw = false } = {}) {
  const headers = { Origin: ORIGIN, Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : body === null ? "" : JSON.stringify(body)
  });
  const text = await res.text();
  if (raw) return { status: res.status, text };
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { parseError: true, text: text.slice(0, 200) }; }
  return { status: res.status, data };
}

async function login(email, password) {
  const res = await request("/api/auth/login", { method: "POST", body: { email, password } });
  if (res.status !== 200 || !res.data || !res.data.token) {
    fail(`Login failed for ${email} (HTTP ${res.status})`);
  }
  return res.data.token;
}

async function logout(token) {
  await request("/api/auth/logout", { method: "POST", token, body: {} });
}

const staffText = readFileSync(join(root, ".sample-staff"), "utf8");
const users = parseStaffFile(staffText);
if (!users.owner || !users.admin) fail("Could not read SAMPLE Owner and Admin logins from .sample-staff");

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const ownerToken = await login(users.owner.email, users.owner.password);
const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");

const creates = [
  ["/api/clients", { name: `SAMPLE Smoke Client ${stamp}`, phone: "09000000000", notes: "smoke" }],
  ["/api/leads", { name: `SAMPLE Smoke Lead ${stamp}`, stage: "new", notes: "smoke" }],
  ["/api/hr/leave", { kind: "vacation", start_date: "2027-07-01", end_date: "2027-07-02", reason: "SAMPLE smoke leave" }],
  ["/api/areas", { name: `SAMPLE Smoke Area ${stamp}`, kind: "room", notes: "smoke" }],
  ["/api/hk/templates", { name: `SAMPLE Smoke Template ${stamp}`, kind: "pre", items: ["Wipe counters"] }],
  ["/api/inventory/items", { name: `SAMPLE Smoke Item ${stamp}`, category: "supplies", unit: "pc", qty_on_hand: 2, reorder_level: 1 }],
  ["/api/expenses", { date: "2027-07-01", category: "supplies", amount: 10, notes: "SAMPLE smoke expense" }]
];

for (const [path, body] of creates) {
  const res = await request(path, { method: "POST", token: ownerToken, body });
  check(`POST ${path}`, res.status === 201, `HTTP ${res.status}`);
}

const empty = await request("/api/clients", { method: "POST", token: ownerToken, body: null });
check("empty body is 400", empty.status === 400, `HTTP ${empty.status}`);

const events = await request("/api/events", { token: ownerToken });
const sampleEvent = ((events.data && events.data.events) || []).find((row) => row.is_sample);
if (sampleEvent) {
  const sheet = await request(`/api/events/${sampleEvent.id}/sheet`, { token: ownerToken });
  check("owner event sheet includes balance", sheet.status === 200 && !!(sheet.data && sheet.data.balance), `HTTP ${sheet.status}`);
}

await logout(ownerToken);

const adminToken = await login(users.admin.email, users.admin.password);
if (sampleEvent) {
  const sheet = await request(`/api/events/${sampleEvent.id}/sheet`, { token: adminToken });
  const hasMoney = !!(sheet.data && sheet.data.balance);
  check("admin event sheet hides balance", sheet.status === 200 && !hasMoney, hasMoney ? "balance present" : `HTTP ${sheet.status}`);
}
const items = await request("/api/inventory/items", { token: adminToken });
const leaked = ((items.data && items.data.items) || []).some((row) => Object.prototype.hasOwnProperty.call(row, "unit_cost") || Object.prototype.hasOwnProperty.call(row, "unit_cost_cents"));
check("admin inventory hides unit_cost", items.status === 200 && !leaked, leaked ? "unit_cost present" : `HTTP ${items.status}`);
const money = await request("/api/payments", { token: adminToken });
check("admin payments denied", money.status === 403, `HTTP ${money.status}`);
await logout(adminToken);

if (users.staff) {
  const staffToken = await login(users.staff.email, users.staff.password);
  const leave = await request("/api/hr/leave", { token: staffToken });
  check("staff can list own leave", leave.status === 200, `HTTP ${leave.status}`);
  const area = await request("/api/areas", { method: "POST", token: staffToken, body: { name: "SAMPLE blocked area" } });
  check("staff cannot create areas", area.status === 403, `HTTP ${area.status}`);
  await logout(staffToken);
}

const failed = results.filter((row) => !row.ok);
if (failed.length) fail(`${failed.length} smoke check(s) failed`);
console.log(`All ${results.length} smoke checks passed against ${API}`);
