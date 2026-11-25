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
const runStartedAt = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" }).replace(" ", "T");
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
  const settings = await request("/api/settings", { token: ownerToken });
  check("settings reports demo mode on", settings.status === 200 && settings.data && settings.data.demo_mode === true && settings.data.hasSample === true, JSON.stringify(settings.data || {}));

  const ownerDash = await request("/api/dashboard", { token: ownerToken });
  const kpis = (ownerDash.data && ownerDash.data.kpis) || {};
  const chart = (ownerDash.data && ownerDash.data.chart) || [];
  check("owner dashboard demoMode is on", ownerDash.status === 200 && ownerDash.data && ownerDash.data.demoMode === true, `demoMode=${ownerDash.data && ownerDash.data.demoMode}`);
  check("owner KPIs include sample revenue", (kpis.revenueMonth || 0) > 0, `revenueMonth=${kpis.revenueMonth}`);
  check("owner KPIs include upcoming events", (kpis.upcomingEvents || 0) > 0, `upcoming=${kpis.upcomingEvents}`);
  check("owner chart has year labels and non-zero values", chart.some((row) => (row.revenue || 0) > 0) && chart.some((row) => /20\d{2}/.test(row.label || "")), `labels=${chart.map((row) => row.label || row.month).join(",")}`);

  const pnl = await request("/api/accounting/pnl?range=monthly", { token: ownerToken });
  check("owner monthly P&L is non-zero in demo mode", pnl.status === 200 && pnl.data && pnl.data.demoMode === true && (pnl.data.income || 0) > 0 && (pnl.data.expenses || 0) > 0, `income=${pnl.data && pnl.data.income} expenses=${pnl.data && pnl.data.expenses}`);

  const finances = await request("/api/finances", { token: ownerToken });
  check("owner finances totals are non-zero in demo mode", finances.status === 200 && finances.data && finances.data.demoMode === true && (((finances.data.totals || {}).fees) || 0) > 0, `fees=${finances.data && finances.data.totals && finances.data.totals.fees}`);

  const badQuote = await request("/api/quotes", { method: "POST", token: ownerToken, body: { client_name: `SAMPLE Smoke Neg ${stamp}`, event_date: "2028-09-01", venue: "Garden", lines: [{ label: "Bad", qty: 1, unit_price: -10 }] } });
  check("negative quote amount rejected", badQuote.status === 400, `HTTP ${badQuote.status}`);

  const noConfirm = await request("/api/sample/remove", { method: "POST", token: ownerToken, body: {} });
  check("remove-sample requires confirm", noConfirm.status === 400, `HTTP ${noConfirm.status}`);

  const profitList = await request("/api/accounting/event-profit?sample=1", { token: ownerToken });
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

  const raceItem = await request("/api/inventory/items", { method: "POST", token: ownerToken, body: {
    name: `SAMPLE Smoke Receive ${stamp}`,
    category: "supplies",
    unit: "pc",
    qty_on_hand: 0,
    reorder_level: 0,
    notes: stamp
  }});
  check("create item for PO receive race", raceItem.status === 201, `HTTP ${raceItem.status}`);
  const itemId = raceItem.data && raceItem.data.item && raceItem.data.item.id;
  if (itemId) {
    created.push({ table: "inventory_moves", id: itemId });
    created.push({ table: "inventory_items", id: itemId });
    const po = await request("/api/purchase-orders", { method: "POST", token: ownerToken, body: {
      notes: stamp,
      status: "ordered",
      lines: [{ item_id: itemId, label: "Smoke receive", qty: 5, unit_cost: 10 }]
    }});
    check("create PO for receive race", po.status === 201, `HTTP ${po.status}`);
    const poId = po.data && po.data.order && po.data.order.id;
    if (poId) {
      created.push({ table: "po_lines", id: poId });
      created.push({ table: "purchase_orders", id: poId });
      const receives = await Promise.all(Array.from({ length: 6 }, () =>
        request(`/api/purchase-orders/${poId}`, { method: "PATCH", token: ownerToken, body: { status: "received" } })
      ));
      const ok = receives.filter((row) => row.status === 200);
      const conflict = receives.filter((row) => row.status === 409);
      check("parallel PO receive is atomic", ok.length === 1 && conflict.length === 5, `ok=${ok.length} 409=${conflict.length} other=${receives.filter((row) => row.status !== 200 && row.status !== 409).map((row) => row.status).join(",")}`);
      const itemsAfter = await request("/api/inventory/items", { token: ownerToken });
      const row = ((itemsAfter.data && itemsAfter.data.items) || []).find((item) => item.id === itemId);
      check("PO receive added stock once", row && Number(row.qty_on_hand) === 5, `qty=${row && row.qty_on_hand}`);
      const unrecv = await request(`/api/purchase-orders/${poId}`, { method: "PATCH", token: ownerToken, body: { status: "ordered" } });
      check("un-receiving a PO is blocked", unrecv.status === 400, `HTTP ${unrecv.status}`);
    }
  }

  const dupItem = await request("/api/inventory/items", { method: "POST", token: ownerToken, body: {
    name: `SAMPLE Smoke DupLines ${stamp}`,
    category: "supplies",
    unit: "pc",
    qty_on_hand: 0,
    reorder_level: 0,
    notes: stamp
  }});
  check("create item for duplicate PO lines", dupItem.status === 201, `HTTP ${dupItem.status}`);
  const dupItemId = dupItem.data && dupItem.data.item && dupItem.data.item.id;
  if (dupItemId) {
    created.push({ table: "inventory_moves", id: dupItemId });
    created.push({ table: "inventory_items", id: dupItemId });
    const dupPo = await request("/api/purchase-orders", { method: "POST", token: ownerToken, body: {
      notes: stamp,
      status: "ordered",
      lines: [
        { item_id: dupItemId, label: "Line A", qty: 2, unit_cost: 10 },
        { item_id: dupItemId, label: "Line B", qty: 3, unit_cost: 10 }
      ]
    }});
    check("create PO with two lines for one item", dupPo.status === 201, `HTTP ${dupPo.status}`);
    const dupPoId = dupPo.data && dupPo.data.order && dupPo.data.order.id;
    if (dupPoId) {
      created.push({ table: "po_lines", id: dupPoId });
      created.push({ table: "purchase_orders", id: dupPoId });
      const received = await request(`/api/purchase-orders/${dupPoId}`, { method: "PATCH", token: ownerToken, body: { status: "received" } });
      check("receive PO with duplicate item lines", received.status === 200, `HTTP ${received.status}`);
      const itemsAfter = await request("/api/inventory/items", { token: ownerToken });
      const row = ((itemsAfter.data && itemsAfter.data.items) || []).find((item) => item.id === dupItemId);
      const moves = await request(`/api/inventory/moves?item=${dupItemId}`, { token: ownerToken });
      const recvMoves = ((moves.data && moves.data.moves) || []).filter((move) => move.kind === "receive" && move.item_id === dupItemId);
      const moveQty = recvMoves.reduce((sum, move) => sum + (Number(move.qty) || 0), 0);
      check("duplicate PO lines write one move each", recvMoves.length === 2 && Number(row && row.qty_on_hand) === 5 && moveQty === 5, `moves=${recvMoves.length} qty=${row && row.qty_on_hand} moveQty=${moveQty}`);
    }
  }

  const cancelledPo = await request("/api/purchase-orders", { method: "POST", token: ownerToken, body: {
    notes: stamp,
    status: "cancelled",
    lines: [{ item_id: dupItemId || itemId, label: "Cancelled line", qty: 1, unit_cost: 10 }]
  }});
  check("create cancelled PO", cancelledPo.status === 201, `HTTP ${cancelledPo.status}`);
  const cancelledId = cancelledPo.data && cancelledPo.data.order && cancelledPo.data.order.id;
  if (cancelledId) {
    created.push({ table: "po_lines", id: cancelledId });
    created.push({ table: "purchase_orders", id: cancelledId });
    const receiveCancelled = await request(`/api/purchase-orders/${cancelledId}`, { method: "PATCH", token: ownerToken, body: { status: "received" } });
    check("receiving a cancelled PO is blocked", receiveCancelled.status === 400, `HTTP ${receiveCancelled.status}`);
  }

  const reqA = await request("/api/requests/new", { method: "POST", token: ownerToken, body: {
    name: `SAMPLE Smoke Race A ${stamp}`,
    contact: "09170000001",
    date: "2028-11-18",
    venue: "The Nook",
    type: "Wedding",
    pax: 80,
    notes: stamp
  }});
  const reqB = await request("/api/requests/new", { method: "POST", token: ownerToken, body: {
    name: `SAMPLE Smoke Race B ${stamp}`,
    contact: "09170000002",
    date: "2028-11-18",
    venue: "The Nook",
    type: "Wedding",
    pax: 80,
    notes: stamp
  }});
  check("create two pending requests for the same date", reqA.status === 201 && reqB.status === 201, `A=${reqA.status} B=${reqB.status}`);
  const reqAId = reqA.data && reqA.data.request && reqA.data.request.id;
  const reqBId = reqB.data && reqB.data.request && reqB.data.request.id;
  if (reqAId) created.push({ table: "requests", id: reqAId });
  if (reqBId) created.push({ table: "requests", id: reqBId });
  if (reqAId && reqBId) {
    const decisions = await Promise.all([
      request(`/api/requests/${reqAId}/decide`, { method: "POST", token: ownerToken, body: { decision: "approved" } }),
      request(`/api/requests/${reqBId}/decide`, { method: "POST", token: ownerToken, body: { decision: "approved" } })
    ]);
    const ok = decisions.filter((row) => row.status === 200);
    const conflict = decisions.filter((row) => row.status === 409);
    check("parallel request approve is atomic", ok.length === 1 && conflict.length === 1, `ok=${ok.length} 409=${conflict.length} other=${decisions.filter((row) => row.status !== 200 && row.status !== 409).map((row) => row.status).join(",")}`);
    const eventId = ok[0] && ok[0].data && ok[0].data.request && ok[0].data.request.id
      ? (ok[0].data.eventId || null)
      : null;
    // decideRequest returns { request }, not eventId. Look up events later if needed.
    const winner = ok[0] && ok[0].data && ok[0].data.request;
    if (winner) {
      const events = await request("/api/events", { token: ownerToken });
      const made = ((events.data && events.data.events) || []).find((event) => event.from_request === winner.id);
      if (made) created.push({ table: "events", id: made.id });
    }
  }

  const beforeClock = await request("/api/attendance/clock", { method: "POST", token: ownerToken, body: {} });
  check("sample owner can clock", beforeClock.status === 200, `HTTP ${beforeClock.status}`);
  const punches = (beforeClock.data && beforeClock.data.attendance) || [];
  const todayPunch = punches.find((row) => row.date && String(row.date).startsWith(new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 10))) || punches[0];
  check("sample clock-in stays sample", todayPunch && (todayPunch.is_sample === 1 || todayPunch.is_sample === true), `is_sample=${todayPunch && todayPunch.is_sample}`);
  if (todayPunch && todayPunch.id) created.push({ table: "attendance", id: todayPunch.id });
  if (todayPunch && todayPunch.time_in && !todayPunch.time_out) {
    const clockOut = await request("/api/attendance/clock", { method: "POST", token: ownerToken, body: {} });
    check("sample clock-out stays sample", clockOut.status === 200 && ((clockOut.data && clockOut.data.attendance) || []).some((row) => row.id === todayPunch.id && (row.is_sample === 1 || row.is_sample === true)), `HTTP ${clockOut.status}`);
  }
}

if (ownerToken && created.length) {
  const cleanup = await request("/api/sample/cleanup-smoke", { method: "POST", token: ownerToken, body: { run_id: runId, run_started_at: runStartedAt, records: created } });
  check("smoke records cleaned up", cleanup.status === 200, `HTTP ${cleanup.status}`);
}
if (ownerToken) await logout(ownerToken);

const failed = results.filter((row) => !row.ok);
if (failed.length) fail(`${failed.length} smoke check(s) failed`);
console.log(`All ${results.length} smoke checks passed against ${API}`);
