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

async function login(email, password, { required = true } = {}) {
  const res = await request("/api/auth/login", { method: "POST", body: { email, password } });
  if (res.status !== 200 || !res.data || !res.data.token) {
    if (!required) return null;
    fail(`Login failed for ${email} (HTTP ${res.status})`);
  }
  return res.data.token;
}

function createdRecord(path, data) {
  if (!data || typeof data !== "object") return null;
  const map = {
    "/api/clients": ["client", "clients"],
    "/api/leads": ["lead", "leads"],
    "/api/hr/leave": ["leave", "request", "requests"],
    "/api/areas": ["area"],
    "/api/hk/templates": ["template"],
    "/api/inventory/items": ["item"],
    "/api/expenses": ["expense"]
  };
  const tableMap = {
    "/api/clients": "clients",
    "/api/leads": "leads",
    "/api/hr/leave": "leave_requests",
    "/api/areas": "areas",
    "/api/hk/templates": "hk_templates",
    "/api/inventory/items": "inventory_items",
    "/api/expenses": "expenses"
  };
  for (const key of map[path] || []) {
    const row = data[key];
    if (row && row.id) return { table: tableMap[path], id: row.id, is_sample: row.is_sample, path };
  }
  return null;
}

async function logout(token) {
  await request("/api/auth/logout", { method: "POST", token, body: {} });
}

const staffText = readFileSync(join(root, ".sample-staff"), "utf8");
const users = parseStaffFile(staffText);
if (!users.admin) fail("Could not read the SAMPLE Admin login from .sample-staff");

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const ownerToken = users.owner
  ? await login(users.owner.email, users.owner.password, { required: false })
  : null;
if (!ownerToken) console.log("SKIP  SAMPLE owner unavailable — admin and staff checks still run");
const runId = `SMK-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
const stamp = runId;
const created = [];

const creates = [
  ["/api/clients", { name: `SAMPLE Smoke Client ${stamp}`, phone: "09000000000", notes: stamp }],
  ["/api/leads", { name: `SAMPLE Smoke Lead ${stamp}`, stage: "new", notes: stamp }],
  ["/api/hr/leave", { kind: "vacation", start_date: "2027-07-01", end_date: "2027-07-02", reason: `SAMPLE smoke leave ${stamp}` }],
  ["/api/areas", { name: `SAMPLE Smoke Area ${stamp}`, kind: "room", notes: stamp }],
  ["/api/hk/templates", { name: `SAMPLE Smoke Template ${stamp}`, kind: "pre", items: [`Wipe counters ${stamp}`] }],
  ["/api/inventory/items", { name: `SAMPLE Smoke Item ${stamp}`, category: "supplies", unit: "pc", qty_on_hand: 2, reorder_level: 1, notes: stamp }],
  ["/api/expenses", { date: "2027-07-01", category: "supplies", amount: 10, notes: `SAMPLE smoke expense ${stamp}` }]
];

if (ownerToken) {
  for (const [path, body] of creates) {
    const res = await request(path, { method: "POST", token: ownerToken, body });
    check(`POST ${path}`, res.status === 201, `HTTP ${res.status}`);
    const rec = createdRecord(path, res.data);
    if (rec) {
      created.push(rec);
      if (path === "/api/hk/templates") created.push({ table: "hk_template_items", id: rec.id });
      if (path === "/api/inventory/items") created.push({ table: "inventory_moves", id: rec.id });
    }
    if (res.status === 201) {
      const flagged = rec && (rec.is_sample === 1 || rec.is_sample === true);
      check(`POST ${path} is_sample`, flagged, flagged ? "" : "not flagged as sample");
    }
  }
}

let sampleEvent = null;
if (ownerToken) {
  const empty = await request("/api/clients", { method: "POST", token: ownerToken, body: null });
  check("empty body is 400", empty.status === 400, `HTTP ${empty.status}`);

  const events = await request("/api/events", { token: ownerToken });
  sampleEvent = ((events.data && events.data.events) || []).find((row) => row.is_sample);
  if (sampleEvent) {
    const sheet = await request(`/api/events/${sampleEvent.id}/sheet`, { token: ownerToken });
    check("owner event sheet includes balance", sheet.status === 200 && !!(sheet.data && sheet.data.balance), `HTTP ${sheet.status}`);
  }
}

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

const adminDashToken = await login(users.admin.email, users.admin.password);
const dash = await request("/api/dashboard", { token: adminDashToken });
const lowLeak = (((dash.data && dash.data.lowStock) || []).some((row) => Object.prototype.hasOwnProperty.call(row, "unit_cost") || Object.prototype.hasOwnProperty.call(row, "unit_cost_cents")));
check("admin dashboard low-stock hides unit_cost", dash.status === 200 && !lowLeak, lowLeak ? "unit_cost present" : `HTTP ${dash.status}`);
await logout(adminDashToken);

if (ownerToken) {
  const badQuote = await request("/api/quotes", { method: "POST", token: ownerToken, body: { client_name: `SAMPLE Smoke Neg ${stamp}`, event_date: "2028-09-01", venue: "Garden", lines: [{ label: "Bad", qty: 1, unit_price: -10 }] } });
  check("negative quote amount rejected", badQuote.status === 400, `HTTP ${badQuote.status}`);

  const noConfirm = await request("/api/sample/remove", { method: "POST", token: ownerToken, body: {} });
  check("remove-sample requires confirm", noConfirm.status === 400, `HTTP ${noConfirm.status}`);

  const profitList = await request("/api/accounting/event-profit", { token: ownerToken });
  const profitId = ((((profitList.data && profitList.data.events) || [])[0] || {}).event_id);
  if (profitId) {
    const one = await request(`/api/accounting/event-profit/${profitId}`, { token: ownerToken });
    check("owner per-event profit", one.status === 200 && !!(one.data && one.data.event), `HTTP ${one.status}`);
  } else {
    check("owner per-event profit", true, "no events to probe");
  }

  const quote = await request("/api/quotes", { method: "POST", token: ownerToken, body: {
    client_name: `SAMPLE Smoke Accept ${stamp}`,
    event_date: "2028-08-19",
    venue: "The Nook",
    status: "sent",
    notes: stamp,
    lines: [{ label: "Package", qty: 1, unit_price: 50000 }]
  }});
  check("create quote for accept race", quote.status === 201, `HTTP ${quote.status}`);
  const quoteId = quote.data && quote.data.quote && quote.data.quote.id;
  if (quoteId) {
    created.push({ table: "quote_lines", id: quoteId });
    created.push({ table: "quotes", id: quoteId });
    const accepts = await Promise.all(Array.from({ length: 6 }, () => request(`/api/quotes/${quoteId}/accept`, { method: "POST", token: ownerToken, body: {} })));
    const ok = accepts.filter((row) => row.status === 200 && row.data && row.data.ok);
    const conflict = accepts.filter((row) => row.status === 409);
    check("parallel quote accept is atomic", ok.length === 1 && conflict.length === 5, `ok=${ok.length} 409=${conflict.length} other=${accepts.filter((row) => row.status !== 200 && row.status !== 409).map((row) => row.status).join(",")}`);
    const eventId = ok[0] && ok[0].data && ok[0].data.eventId;
    const contractId = ok[0] && ok[0].data && ok[0].data.contractId;
    if (contractId) created.push({ table: "contracts", id: contractId });
    if (eventId) created.push({ table: "events", id: eventId });
  }
}

if (ownerToken && created.length) {
  const cleanup = await request("/api/sample/cleanup-smoke", { method: "POST", token: ownerToken, body: { run_id: runId, records: created } });
  check("smoke records cleaned up", cleanup.status === 200, `HTTP ${cleanup.status}`);
}
if (ownerToken) await logout(ownerToken);

const failed = results.filter((row) => !row.ok);
if (failed.length) fail(`${failed.length} smoke check(s) failed`);
console.log(`All ${results.length} smoke checks passed against ${API}`);
