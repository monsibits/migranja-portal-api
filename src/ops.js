/**
 * Operations modules: dashboard, sales, event sheets, housekeeping,
 * inventory, accounting, HR, and expanded reports.
 * Concatenated after index.js for deploy. Uses helpers declared there.
 */

const LEAD_STAGES = ["new", "contacted", "quoted", "won", "lost"];
const QUOTE_STATUSES = ["draft", "sent", "accepted", "rejected", "expired"];
const CONTRACT_STATUSES = ["draft", "sent", "signed", "cancelled"];
const PAYMENT_KINDS = ["reservation", "downpayment", "balance", "security_deposit", "refund"];
const PAYMENT_METHODS = ["cash", "gcash", "maya", "bank", "card", "check"];
const HK_KINDS = ["pre", "post", "daily", "deep"];
const HK_STATUSES = ["pending", "in_progress", "done", "inspected", "failed"];
const TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"];
const TICKET_PRIORITIES = ["low", "normal", "high", "urgent"];
const MOVE_KINDS = ["receive", "issue", "return", "adjust", "damage", "loss", "transfer"];
const PO_STATUSES = ["draft", "ordered", "received", "cancelled"];
const ACCOUNT_TYPES = ["income", "expense", "asset", "liability"];
const ADVANCE_STATUSES = ["open", "deducted", "cancelled"];
const LEAVE_KINDS = ["vacation", "sick", "emergency", "unpaid", "other"];
const LEAVE_STATUSES = ["pending", "approved", "declined", "cancelled"];
const PAYROLL_STATUSES = ["draft", "approved", "paid"];
const EXPENSE_CATEGORIES = ["food", "decor", "utilities", "supplies", "labor", "transport", "maintenance", "marketing", "fees", "other"];

function isOwner(user) {
  return !!(user && user.role === "owner");
}

function denyMoney(request) {
  return json({ error: "Only the owner can view or change money records." }, 403, request);
}

function centsFromPesos(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function attachCents(fields, names) {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(fields, name)) {
      fields[`${name}_cents`] = centsFromPesos(fields[name]);
    }
  }
  return fields;
}

function pesosFromCents(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n / 100;
}

function withPesos(row, fields) {
  if (!row) return row;
  const out = { ...row };
  for (const field of fields) {
    const centsKey = `${field}_cents`;
    if (out[centsKey] != null) out[field] = pesosFromCents(out[centsKey]);
  }
  return out;
}

function stripMoneyFields(row, fields) {
  if (!row) return row;
  const out = { ...row };
  for (const field of fields) {
    delete out[field];
    delete out[`${field}_cents`];
  }
  return out;
}

const PACKAGE_MONEY = ["base_fee", "extra_pax_price"];
const QUOTE_MONEY = ["subtotal", "discount", "total", "unit_price", "amount"];
const CONTRACT_MONEY = ["total", "deposit_due"];
const PAYMENT_MONEY = ["amount"];
const HR_RATE_FIELDS = ["daily_rate", "hourly_rate", "rate", "daily_rate_cents", "hourly_rate_cents", "rate_cents"];

const SERIAL_SPECS = {
  quotes: { table: "quotes", column: "number", prefix: "MG-Q" },
  contracts: { table: "contracts", column: "number", prefix: "MG-C" },
  payments: { table: "payments", column: "receipt_no", prefix: "MG-OR" },
  expenses: { table: "expenses", column: "receipt_no", prefix: "MG-EX" },
  pos: { table: "purchase_orders", column: "number", prefix: "MG-PO" }
};

async function handleOps(request, env, url, user) {
  const path = url.pathname;
  const method = request.method;
  const parts = path.split("/").filter(Boolean);

  if (path === "/api/dashboard" && method === "GET") {
    if (!user) return deny(request);
    return dashboard(env, request, user);
  }

  if (path === "/api/reports/summary" && method === "GET") {
    if (!allow(user, "reports", "read")) return deny(request);
    return reportSummary(env, request, user);
  }

  if (parts[0] === "api" && parts[1] === "events" && parts[3] === "sheet") {
    if (!allow(user, "events", "read")) return deny(request);
    if (method === "GET") return getEventSheet(env, request, user, parts[2]);
    if (method === "PUT" || method === "PATCH") {
      if (!allow(user, "events", "write")) return deny(request);
      return saveEventSheet(env, request, user, parts[2]);
    }
  }
  if (parts[0] === "api" && parts[1] === "events" && parts[3] === "balance" && method === "GET") {
    if (!isOwner(user)) return denyMoney(request);
    return eventBalance(env, request, user, parts[2]);
  }

  const salesRead = () => allow(user, "sales", "read");
  const salesWrite = () => allow(user, "sales", "write");

  if (path === "/api/sales/pipeline" && method === "GET") {
    if (!salesRead()) return deny(request);
    return salesPipeline(env, request, user);
  }

  const listMap = {
    "/api/clients": { res: "sales", list: listClients, create: createClient },
    "/api/packages": { res: "sales", list: listPackages, create: createPackage },
    "/api/leads": { res: "sales", list: listLeads, create: createLead },
    "/api/quotes": { res: "sales", list: listQuotes, create: createQuote },
    "/api/contracts": { res: "sales", list: listContracts, create: createContract },
    "/api/payments": { res: "sales", list: listPayments, create: createPayment },
    "/api/areas": { res: "housekeeping", list: listAreas, create: createArea },
    "/api/hk/templates": { res: "housekeeping", list: listHkTemplates, create: createHkTemplate },
    "/api/hk/jobs": { res: "housekeeping", list: listHkJobs, create: createHkJob },
    "/api/maintenance": { res: "housekeeping", list: listTickets, create: createTicket },
    "/api/inventory/items": { res: "inventory", list: listInventoryItems, create: createInventoryItem },
    "/api/inventory/stock": { res: "inventory", list: listStock },
    "/api/inventory/moves": { res: "inventory", list: listMoves, create: createMove },
    "/api/inventory/allocations": { res: "inventory", list: listAllocations, create: createAllocation },
    "/api/suppliers": { res: "inventory", list: listSuppliers, create: createSupplier },
    "/api/purchase-orders": { res: "inventory", list: listPOs, create: createPO },
    "/api/accounts": { res: "accounting", list: listAccounts },
    "/api/expenses": { res: "accounting", list: listExpenses, create: createExpense },
    "/api/petty-cash": { res: "accounting", list: listPetty, create: createPetty },
    "/api/hr/staff": { res: "hr", list: listHrStaff },
    "/api/hr/payroll": { res: "payroll", list: listPayroll, create: createPayrollPeriod },
    "/api/hr/advances": { res: "payroll", list: listAdvances, create: createAdvance },
    "/api/hr/leave": { res: "hr", list: listLeave, create: createLeave }
  };
  const entry = listMap[path];
  if (entry) {
    if (method === "GET") {
      if (!allow(user, entry.res, "read")) return deny(request);
      if (path === "/api/payments" && !isOwner(user)) return denyMoney(request);
      return entry.list(env, request, user);
    }
    if (method === "POST" && entry.create) {
      const writeRes = path === "/api/inventory/moves" && ["issue", "return"].includes(String((await peekKind(request)) || ""))
        ? "housekeeping"
        : entry.res;
      // Staff may post issue/return; createMove enforces kind. Use inventory write for admin/owner, special case inside createMove.
      if (path === "/api/inventory/moves") {
        if (!allow(user, "inventory", "read")) return deny(request);
        return entry.create(env, request, user);
      }
      if (path === "/api/hr/leave" && user.role === "staff") {
        return entry.create(env, request, user);
      }
      if (!allow(user, entry.res, "write")) return deny(request);
      if (["/api/payments", "/api/quotes", "/api/contracts", "/api/packages"].includes(path) && !isOwner(user)) {
        return denyMoney(request);
      }
      return entry.create(env, request, user);
    }
  }

  if (path === "/api/accounting/pnl" && method === "GET") {
    if (!allow(user, "accounting", "read")) return deny(request);
    return pnlReport(env, request, user);
  }
  if (path === "/api/accounting/cashflow" && method === "GET") {
    if (!allow(user, "accounting", "read")) return deny(request);
    return cashflowReport(env, request, user);
  }
  if (path === "/api/accounting/event-profit" && method === "GET") {
    if (!allow(user, "accounting", "read")) return deny(request);
    return eventProfitList(env, request, user);
  }
  if (parts[0] === "api" && parts[1] === "accounting" && parts[2] === "event-profit" && parts[3] && method === "GET") {
    if (!allow(user, "accounting", "read")) return deny(request);
    return eventProfitOne(env, request, user, parts[3]);
  }

  if (parts[0] === "api" && parts[2] && method === "PATCH") {
    const id = parts[parts.length - 1];
    const patchers = [
      ["clients", "sales", patchClient],
      ["packages", "sales", patchPackage],
      ["leads", "sales", patchLead],
      ["quotes", "sales", patchQuote],
      ["contracts", "sales", patchContract],
      ["areas", "housekeeping", patchArea],
      ["maintenance", "housekeeping", patchTicket],
      ["suppliers", "inventory", patchSupplier]
    ];
    for (const [name, res, fn] of patchers) {
      if (parts[1] === name && parts.length === 3) {
        if (!allow(user, res, "write")) return deny(request);
        if (["packages", "quotes", "contracts"].includes(name) && !isOwner(user)) return denyMoney(request);
        return fn(id, request, env, user);
      }
    }
    if (parts[1] === "hk" && parts[2] === "jobs" && parts.length === 4) {
      if (!allow(user, "housekeeping", "write")) return deny(request);
      return patchHkJob(parts[3], request, env, user);
    }
    if (parts[1] === "hk" && parts[2] === "items" && parts.length === 4) {
      if (!allow(user, "housekeeping", "write")) return deny(request);
      return patchHkItem(parts[3], request, env, user);
    }
    if (parts[1] === "inventory" && parts[2] === "items" && parts.length === 4) {
      if (!allow(user, "inventory", "write")) return deny(request);
      return patchInventoryItem(parts[3], request, env, user);
    }
    if (parts[1] === "hr" && parts[2] === "staff" && parts.length === 4) {
      if (!allow(user, "hr", "write")) return deny(request);
      return patchHrStaff(parts[3], request, env, user);
    }
    if (parts[1] === "hr" && parts[2] === "leave" && parts.length === 4) {
      if (!allow(user, "hr", "write") && user.role !== "staff") return deny(request);
      return patchLeave(parts[3], request, env, user);
    }
    if (parts[1] === "hr" && parts[2] === "advances" && parts.length === 4) {
      if (!allow(user, "payroll", "write")) return deny(request);
      return patchAdvance(parts[3], request, env, user);
    }
    if (parts[1] === "hr" && parts[2] === "payroll" && parts.length === 4) {
      if (!allow(user, "payroll", "write")) return deny(request);
      return patchPayrollPeriod(parts[3], request, env, user);
    }
    if (parts[1] === "purchase-orders" && parts.length === 3) {
      if (!allow(user, "inventory", "write")) return deny(request);
      return patchPO(id, request, env, user);
    }
  }

  if (parts[0] === "api" && parts[1] === "quotes" && parts[3] === "accept" && method === "POST") {
    if (!isOwner(user)) return denyMoney(request);
    return acceptQuote(parts[2], request, env, user);
  }
  if (parts[0] === "api" && parts[1] === "payments" && parts[3] === "void" && method === "POST") {
    if (!isOwner(user)) return denyMoney(request);
    return voidPayment(parts[2], request, env, user);
  }
  if (parts[0] === "api" && parts[1] === "expenses" && parts[3] === "void" && method === "POST") {
    if (!allow(user, "accounting", "write")) return deny(request);
    return voidExpense(parts[2], request, env, user);
  }

  return null;
}

async function peekKind(request) {
  return null;
}

function sampleFlag(row) {
  return row && (row.is_sample === 1 || row.is_sample === true);
}

function monthKey(isoDate) {
  return String(isoDate || "").slice(0, 7);
}

function monthRange(year, month) {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, "0");
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(last).padStart(2, "0")}`, days: last };
}

async function nextSerial(env, key) {
  const spec = SERIAL_SPECS[key];
  if (!spec) throw new Error("Unknown serial");
  const sql = spec.table === "quotes" && spec.column === "number"
    ? "SELECT number AS n FROM quotes WHERE number LIKE ? ORDER BY number DESC LIMIT 1"
    : spec.table === "contracts" && spec.column === "number"
      ? "SELECT number AS n FROM contracts WHERE number LIKE ? ORDER BY number DESC LIMIT 1"
      : spec.table === "payments" && spec.column === "receipt_no"
        ? "SELECT receipt_no AS n FROM payments WHERE receipt_no LIKE ? ORDER BY receipt_no DESC LIMIT 1"
        : spec.table === "expenses" && spec.column === "receipt_no"
          ? "SELECT receipt_no AS n FROM expenses WHERE receipt_no LIKE ? ORDER BY receipt_no DESC LIMIT 1"
          : spec.table === "pos" || (spec.table === "purchase_orders" && spec.column === "number")
            ? "SELECT number AS n FROM purchase_orders WHERE number LIKE ? ORDER BY number DESC LIMIT 1"
            : null;
  if (!sql) throw new Error("Unknown serial");
  const row = await env.DB.prepare(sql).bind(`${spec.prefix}-%`).first();
  const current = row && row.n ? Number(String(row.n).split("-").pop()) : 0;
  const next = (Number.isFinite(current) ? current : 0) + 1;
  return `${spec.prefix}-${String(next).padStart(4, "0")}`;
}

async function dashboard(env, request, user) {
  const today = todayISO();
  const now = new Date(`${today}T00:00:00+08:00`);
  const { from, to, days } = monthRange(now.getFullYear(), now.getMonth() + 1);
  const staff = user.role === "staff";

  const events = (await env.DB.prepare("SELECT id, date, client, title, status, fee, deposit, contract_total, is_sample FROM events").all()).results || [];
  const taskStmt = staff
    ? env.DB.prepare("SELECT id, status, is_sample FROM tasks WHERE staff_id = ?").bind(user.id)
    : env.DB.prepare("SELECT id, status, is_sample FROM tasks");
  const tasks = (await taskStmt.all()).results || [];
  const requests = staff ? [] : ((await env.DB.prepare("SELECT id, status, is_sample FROM requests").all()).results || []);
  const balances = isOwner(user)
    ? ((await env.DB.prepare("SELECT * FROM v_event_balance").all()).results || [])
    : [];
  const stock = allow(user, "inventory", "read")
    ? ((await env.DB.prepare("SELECT * FROM v_stock_on_hand").all()).results || [])
    : [];
  const jobs = allow(user, "housekeeping", "read")
    ? ((await env.DB.prepare("SELECT id, status, assigned_to, is_sample FROM checklists").all()).results || [])
    : [];
  const payments = isOwner(user)
    ? ((await env.DB.prepare("SELECT IFNULL(amount_cents, CAST(ROUND(amount * 100) AS INTEGER)) AS amount_cents, amount, received_at, kind, voided_at, is_sample FROM payments").all()).results || []).map((row) => withPesos(row, ["amount"]))
    : [];
  const expenses = isOwner(user)
    ? ((await env.DB.prepare("SELECT IFNULL(amount_cents, CAST(ROUND(amount * 100) AS INTEGER)) AS amount_cents, amount, date, voided_at, is_sample FROM expenses").all()).results || []).map((row) => withPesos(row, ["amount"]))
    : [];

  const kpis = (isSample) => {
    const ev = events.filter((row) => Boolean(row.is_sample) === isSample);
    const held = ev.filter((row) => HELD_STATUSES.has(row.status) || row.status === "Completed");
    const upcoming = ev.filter((row) => row.date >= today && row.status !== "Cancelled");
    const monthHeld = new Set(held.filter((row) => row.date >= from && row.date <= to).map((row) => row.date));
    const unpaid = balances.filter((row) => Boolean(row.is_sample) === isSample && (row.balance || 0) > 0);
    const low = stock.filter((row) => Boolean(row.is_sample) === isSample && Number(row.qty_on_hand || 0) <= Number(row.reorder_level || 0));
    const openTasks = tasks.filter((row) => Boolean(row.is_sample) === isSample && row.status === "open");
    const pendingReq = requests.filter((row) => Boolean(row.is_sample) === isSample && row.status === "pending");
    const openJobs = jobs.filter((row) => Boolean(row.is_sample) === isSample && (row.status === "pending" || row.status === "in_progress" || row.status === "failed"));
    const collected = payments
      .filter((row) => Boolean(row.is_sample) === isSample && !row.voided_at && String(row.received_at).slice(0, 10) >= from && String(row.received_at).slice(0, 10) <= to)
      .reduce((sum, row) => sum + (row.kind === "refund" ? -row.amount : row.amount || 0), 0);
    return {
      revenueMonth: collected,
      upcomingEvents: upcoming.length,
      occupancy: days ? Math.round((monthHeld.size / days) * 100) : 0,
      occupancyDays: monthHeld.size,
      daysInMonth: days,
      unpaidBalance: unpaid.reduce((sum, row) => sum + (row.balance || 0), 0),
      unpaidCount: unpaid.length,
      lowStock: low.length,
      openTasks: openTasks.length,
      pendingRequests: pendingReq.length,
      openHousekeeping: openJobs.length
    };
  };

  const months = [];
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push(key);
  }
  const chart = months.map((key) => {
    const realRev = payments.filter((p) => !p.is_sample && !p.voided_at && monthKey(p.received_at) === key).reduce((s, p) => s + (p.kind === "refund" ? -p.amount : p.amount || 0), 0);
    const sampleRev = payments.filter((p) => p.is_sample && !p.voided_at && monthKey(p.received_at) === key).reduce((s, p) => s + (p.kind === "refund" ? -p.amount : p.amount || 0), 0);
    const realExp = expenses.filter((p) => !p.is_sample && !p.voided_at && monthKey(p.date) === key).reduce((s, p) => s + (p.amount || 0), 0);
    const sampleExp = expenses.filter((p) => p.is_sample && !p.voided_at && monthKey(p.date) === key).reduce((s, p) => s + (p.amount || 0), 0);
    return { month: key, revenue: realRev, expenses: realExp, sampleRevenue: sampleRev, sampleExpenses: sampleExp };
  });

  const upcoming = events
    .filter((row) => row.date >= today && row.status !== "Cancelled")
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8)
    .map((row) => ({ id: row.id, date: row.date, client: row.client, title: row.title, status: row.status, is_sample: row.is_sample }));

  const realKpis = kpis(false);
  const sampleKpis = kpis(true);
  if (!isOwner(user)) {
    delete realKpis.revenueMonth;
    delete realKpis.unpaidBalance;
    delete realKpis.unpaidCount;
    delete sampleKpis.revenueMonth;
    delete sampleKpis.unpaidBalance;
    delete sampleKpis.unpaidCount;
  }
  return json({
    month: from.slice(0, 7),
    kpis: realKpis,
    sampleKpis,
    hasSample: events.some((row) => row.is_sample) || payments.some((row) => row.is_sample),
    chart: isOwner(user) ? chart : months.map((key) => ({ month: key })),
    upcoming,
    lowStock: stock.filter((row) => Number(row.qty_on_hand || 0) <= Number(row.reorder_level || 0)).slice(0, 8)
  }, 200, request);
}


function requireOrigin(request) {
  return originAllowed(request);
}

async function listBy(env, request, sql, params = []) {
  const stmt = params.length ? env.DB.prepare(sql).bind(...params) : env.DB.prepare(sql);
  const { results } = await stmt.all();
  return results || [];
}

async function listClients(env, request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  let sql = "SELECT * FROM clients ORDER BY name ASC LIMIT 500";
  const params = [];
  if (q) {
    sql = "SELECT * FROM clients WHERE LOWER(name) LIKE ? OR LOWER(IFNULL(contact,'')) LIKE ? OR LOWER(IFNULL(email,'')) LIKE ? OR LOWER(IFNULL(company,'')) LIKE ? ORDER BY name ASC LIMIT 500";
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  return json({ clients: await listBy(env, request, sql, params) }, 200, request);
}

async function createClient(request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  const name = vStr(body && body.name, { label: "the client name", max: 120 });
  const contact = vStr(body && body.contact, { label: "the contact", required: false, max: 80 });
  const email = vStr(body && body.email, { label: "the email", required: false, max: 80 });
  const company = vStr(body && body.company, { label: "the company", required: false, max: 120 });
  const notes = vStr(body && body.notes, { label: "notes", required: false, max: 2000 });
  for (const field of [name, contact, email, company, notes]) {
    if (field.error) return json({ error: field.error }, 400, request);
  }
  const id = randomId();
  const now = isoNow();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO clients (id, name, contact, email, company, notes, created_at, created_by, is_sample)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`
    ).bind(id, name.value, contact.value, email.value, company.value, notes.value, now, user.id),
    auditStmt(env, user, "create", "clients", id, name.value, request)
  ]);
  const client = await env.DB.prepare("SELECT * FROM clients WHERE id = ?").bind(id).first();
  return json({ client }, 201, request);
}

async function patchClient(id, request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  const existing = await env.DB.prepare("SELECT * FROM clients WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Client not found." }, 404, request);
  const fields = {};
  for (const key of ["name", "contact", "email", "company", "notes"]) {
    if (body[key] !== undefined) {
      const parsed = vStr(body[key], { label: key, required: key === "name", max: key === "notes" ? 2000 : 120 });
      if (parsed.error) return json({ error: parsed.error }, 400, request);
      fields[key] = parsed.value;
    }
  }
  const keys = Object.keys(fields);
  if (!keys.length) return json({ client: existing }, 200, request);
  fields.updated_at = isoNow();
  keys.push("updated_at");
  await env.DB.batch([
    env.DB.prepare(`UPDATE clients SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`).bind(...keys.map((k) => fields[k]), id),
    auditStmt(env, user, "update", "clients", id, JSON.stringify(fields), request, existing.is_sample)
  ]);
  return json({ client: await env.DB.prepare("SELECT * FROM clients WHERE id = ?").bind(id).first() }, 200, request);
}

async function listPackages(env, request, user) {
  const url = new URL(request.url);
  const active = url.searchParams.get("active");
  let sql = "SELECT * FROM packages ORDER BY name ASC";
  const params = [];
  if (active === "1") { sql = "SELECT * FROM packages WHERE IFNULL(is_active,1)=1 ORDER BY name ASC"; }
  const packages = (await listBy(env, request, sql, params)).map((row) => withPesos(row, PACKAGE_MONEY));
  return json({ packages: isOwner(user) ? packages : packages.map((row) => stripMoneyFields(row, PACKAGE_MONEY)) }, 200, request);
}

async function createPackage(request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  const name = vStr(body && body.name, { label: "the package name", max: 120 });
  const venue = vStr(body && body.venue, { label: "the venue", required: false, max: 80 });
  const description = vStr(body && body.description, { label: "the description", required: false, max: 2000 });
  const inclusions = vStr(body && body.inclusions, { label: "the inclusions", required: false, max: 4000 });
  const base = vInt(body && body.base_fee, { label: "the package fee", min: 0, max: 100000000 });
  const pax = vInt(body && body.included_pax, { label: "included guests", min: 0, max: 2000, required: false, allowNull: true });
  const extra = vInt(body && body.extra_pax_price, { label: "the extra-guest fee", min: 0, max: 1000000, required: false, allowNull: true });
  const hours = vInt(body && body.hours, { label: "the hours", min: 0, max: 72, required: false, allowNull: true });
  for (const field of [name, venue, description, inclusions, base, pax, extra, hours]) {
    if (field.error) return json({ error: field.error }, 400, request);
  }
  const id = randomId();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO packages (id, name, venue, description, base_fee, included_pax, extra_pax_price, hours, inclusions, is_active, is_sample, created_at, created_by, base_fee_cents, extra_pax_price_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?, ?)`
    ).bind(id, name.value, venue.value, description.value, base.value, pax.value, extra.value, hours.value, inclusions.value, isoNow(), user.id, centsFromPesos(base.value), centsFromPesos(extra.value)),
    auditStmt(env, user, "create", "packages", id, name.value, request)
  ]);
  return json({ package: await env.DB.prepare("SELECT * FROM packages WHERE id = ?").bind(id).first() }, 201, request);
}

async function patchPackage(id, request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  const existing = await env.DB.prepare("SELECT * FROM packages WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Package not found." }, 404, request);
  const fields = { updated_at: isoNow() };
  if (body.name !== undefined) {
    const name = vStr(body.name, { label: "the package name", max: 120 });
    if (name.error) return json({ error: name.error }, 400, request);
    fields.name = name.value;
  }
  if (body.venue !== undefined) fields.venue = String(body.venue || "").trim();
  if (body.description !== undefined) fields.description = String(body.description || "").trim();
  if (body.inclusions !== undefined) fields.inclusions = String(body.inclusions || "").trim();
  if (body.base_fee !== undefined) {
    const base = vInt(body.base_fee, { label: "the package fee", min: 0, max: 100000000 });
    if (base.error) return json({ error: base.error }, 400, request);
    fields.base_fee = base.value;
  }
  if (body.included_pax !== undefined) fields.included_pax = body.included_pax === "" || body.included_pax === null ? null : Number(body.included_pax);
  if (body.extra_pax_price !== undefined) fields.extra_pax_price = body.extra_pax_price === "" || body.extra_pax_price === null ? null : Number(body.extra_pax_price);
  if (body.hours !== undefined) fields.hours = body.hours === "" || body.hours === null ? null : Number(body.hours);
  if (body.is_active !== undefined) fields.is_active = body.is_active ? 1 : 0;
  attachCents(fields, PACKAGE_MONEY);
  const keys = Object.keys(fields);
  await env.DB.batch([
    env.DB.prepare(`UPDATE packages SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`).bind(...keys.map((k) => fields[k]), id),
    auditStmt(env, user, "update", "packages", id, JSON.stringify(fields), request, existing.is_sample)
  ]);
  return json({ package: await env.DB.prepare("SELECT * FROM packages WHERE id = ?").bind(id).first() }, 200, request);
}

async function listLeads(env, request) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || url.searchParams.get("stage") || "";
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const clauses = [];
  const params = [];
  if (status && LEAD_STAGES.includes(status)) { clauses.push("l.status = ?"); params.push(status); }
  if (q) {
    clauses.push("(LOWER(l.name) LIKE ? OR LOWER(IFNULL(l.contact,'')) LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }
  let sql = `SELECT l.*, c.name AS client_name, u.name AS assigned_name
             FROM leads l
             LEFT JOIN clients c ON c.id = l.client_id
             LEFT JOIN users u ON u.id = l.assigned_to`;
  if (clauses.length) sql += ` WHERE ${clauses.join(" AND ")}`;
  sql += " ORDER BY l.created_at DESC LIMIT 500";
  return json({ leads: await listBy(env, request, sql, params), stages: LEAD_STAGES }, 200, request);
}

async function createLead(request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  const name = vStr(body && body.name, { label: "the name", max: 120 });
  const contact = vStr(body && body.contact, { label: "the contact", required: false, max: 80 });
  const source = vStr(body && body.source, { label: "the source", required: false, max: 80 });
  const status = vOneOf(String(body && body.status || body && body.stage || "new"), LEAD_STAGES, "stage");
  const notes = vStr(body && body.notes, { label: "notes", required: false, max: 2000 });
  const venue = vStr(body && body.venue, { label: "the venue", required: false, max: 80 });
  const type = vStr(body && body.type, { label: "the event type", required: false, max: 80 });
  const eventDate = vDate(body && body.event_date, { label: "the event date", required: false });
  const pax = vInt(body && body.pax, { label: "the guest count", min: 0, max: 2000, required: false, allowNull: true });
  for (const field of [name, contact, source, status, notes, venue, type, eventDate, pax]) {
    if (field.error) return json({ error: field.error }, 400, request);
  }
  const id = randomId();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO leads (id, name, contact, source, status, notes, request_id, client_id, assigned_to, event_date, venue, pax, type, created_at, created_by, is_sample)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
    ).bind(id, name.value, contact.value, source.value, status.value, notes.value, body.request_id || null, body.client_id || null, body.assigned_to || null, eventDate.value || null, venue.value, pax.value, type.value, isoNow(), user.id),
    auditStmt(env, user, "create", "leads", id, name.value, request)
  ]);
  return json({ lead: await env.DB.prepare("SELECT * FROM leads WHERE id = ?").bind(id).first() }, 201, request);
}

async function patchLead(id, request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  const existing = await env.DB.prepare("SELECT * FROM leads WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Lead not found." }, 404, request);
  const fields = { updated_at: isoNow() };
  if (body.name !== undefined) {
    const name = vStr(body.name, { label: "the name", max: 120 });
    if (name.error) return json({ error: name.error }, 400, request);
    fields.name = name.value;
  }
  if (body.contact !== undefined) fields.contact = String(body.contact || "").trim();
  if (body.source !== undefined) fields.source = String(body.source || "").trim();
  if (body.notes !== undefined) fields.notes = String(body.notes || "").trim();
  if (body.venue !== undefined) fields.venue = String(body.venue || "").trim();
  if (body.type !== undefined) fields.type = String(body.type || "").trim();
  if (body.event_date !== undefined) fields.event_date = body.event_date || null;
  if (body.pax !== undefined) fields.pax = body.pax === "" || body.pax === null ? null : Number(body.pax);
  if (body.client_id !== undefined) fields.client_id = body.client_id || null;
  if (body.assigned_to !== undefined) fields.assigned_to = body.assigned_to || null;
  if (body.status !== undefined || body.stage !== undefined) {
    const status = vOneOf(String(body.status || body.stage), LEAD_STAGES, "stage");
    if (status.error) return json({ error: status.error }, 400, request);
    fields.status = status.value;
  }
  const keys = Object.keys(fields);
  await env.DB.batch([
    env.DB.prepare(`UPDATE leads SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`).bind(...keys.map((k) => fields[k]), id),
    auditStmt(env, user, "update", "leads", id, JSON.stringify(fields), request, existing.is_sample)
  ]);
  return json({ lead: await env.DB.prepare("SELECT * FROM leads WHERE id = ?").bind(id).first() }, 200, request);
}


function quoteTotals(lines, discount) {
  const subtotal = (lines || []).reduce((sum, line) => sum + (Number(line.amount) || (Number(line.qty) || 0) * (Number(line.unit_price) || 0)), 0);
  const off = Number(discount) || 0;
  return { subtotal, discount: off, total: Math.max(subtotal - off, 0) };
}

async function listQuotes(env, request, user) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "";
  const clauses = [];
  const params = [];
  if (status && QUOTE_STATUSES.includes(status)) { clauses.push("q.status = ?"); params.push(status); }
  let sql = `SELECT q.*, p.name AS package_name, l.name AS lead_name
             FROM quotes q
             LEFT JOIN packages p ON p.id = q.package_id
             LEFT JOIN leads l ON l.id = q.lead_id`;
  if (clauses.length) sql += ` WHERE ${clauses.join(" AND ")}`;
  sql += " ORDER BY q.created_at DESC LIMIT 500";
  const quotes = await listBy(env, request, sql, params);
  const ids = quotes.map((row) => row.id);
  let lines = [];
  if (ids.length) {
    const placeholders = ids.map(() => "?").join(",");
    lines = await listBy(env, request, `SELECT * FROM quote_lines WHERE quote_id IN (${placeholders}) ORDER BY sort_order ASC`, ids);
  }
  const byQuote = {};
  for (const line of lines) {
    if (!byQuote[line.quote_id]) byQuote[line.quote_id] = [];
    byQuote[line.quote_id].push(line);
  }
  const shaped = quotes.map((row) => withPesos({ ...row, lines: (byQuote[row.id] || []).map((line) => withPesos(line, QUOTE_MONEY)) }, QUOTE_MONEY));
  return json({ quotes: isOwner(user) ? shaped : shaped.map((row) => ({ ...stripMoneyFields(row, QUOTE_MONEY), lines: (row.lines || []).map((line) => stripMoneyFields(line, QUOTE_MONEY)) })), statuses: QUOTE_STATUSES }, 200, request);
}

async function insertQuoteStatements(env, user, request, payload) {
  const id = payload.id || randomId();
  const number = payload.number;
  const totals = quoteTotals(payload.lines, payload.discount);
  const now = isoNow();
  const statements = [
    env.DB.prepare(
      `INSERT INTO quotes (id, number, lead_id, request_id, event_id, client_id, client_name, contact, event_date, venue, package_id, items, subtotal, discount, total, status, valid_until, notes, created_at, created_by, is_sample, subtotal_cents, discount_cents, total_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, number, payload.lead_id || null, payload.request_id || null, payload.event_id || null, payload.client_id || null,
      payload.client_name, payload.contact || "", payload.event_date || null, payload.venue || "", payload.package_id || null,
      JSON.stringify(payload.lines || []), totals.subtotal, totals.discount, totals.total, payload.status, payload.valid_until || null,
      payload.notes || "", now, user.id, payload.is_sample || 0, centsFromPesos(totals.subtotal), centsFromPesos(totals.discount), centsFromPesos(totals.total)
    )
  ];
  (payload.lines || []).forEach((line, index) => {
    const qty = Number(line.qty) || 1;
    const unit = Number(line.unit_price) || 0;
    statements.push(env.DB.prepare(
      `INSERT INTO quote_lines (id, quote_id, label, qty, unit_price, amount, sort_order, is_sample, unit_price_cents, amount_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(randomId(), id, String(line.label || "Item").slice(0, 200), qty, unit, qty * unit, index, payload.is_sample || 0, centsFromPesos(unit), centsFromPesos(qty * unit)));
  });
  statements.push(auditStmt(env, user, "create", "quotes", id, number, request, payload.is_sample || 0));
  return { id, statements, totals };
}

async function createQuote(request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  const clientName = vStr(body && body.client_name, { label: "the client name", max: 120 });
  const status = vOneOf(String(body && body.status || "draft"), QUOTE_STATUSES, "quote status");
  const discount = vInt(body && body.discount, { label: "the discount", min: 0, max: 100000000, required: false });
  const notes = vStr(body && body.notes, { label: "notes", required: false, max: 2000 });
  const valid = vDate(body && body.valid_until, { label: "the valid-until date", required: false });
  const eventDate = vDate(body && body.event_date, { label: "the event date", required: false });
  for (const field of [clientName, status, discount, notes, valid, eventDate]) {
    if (field.error) return json({ error: field.error }, 400, request);
  }
  const lines = Array.isArray(body.lines) && body.lines.length
    ? body.lines
    : body.package_id
      ? [{ label: "Package", qty: 1, unit_price: Number(body.base_fee || 0) }]
      : [];
  if (!lines.length) return json({ error: "Please add at least one line to the quote." }, 400, request);
  const number = await nextSerial(env, "quotes");
  const built = await insertQuoteStatements(env, user, request, {
    number,
    lead_id: body.lead_id,
    request_id: body.request_id,
    event_id: body.event_id,
    client_id: body.client_id,
    client_name: clientName.value,
    contact: body.contact || "",
    event_date: eventDate.value,
    venue: body.venue || "",
    package_id: body.package_id,
    lines,
    discount: discount.value || 0,
    status: status.value,
    valid_until: valid.value,
    notes: notes.value
  });
  await env.DB.batch(built.statements);
  if (body.lead_id && status.value !== "draft") {
    await env.DB.prepare("UPDATE leads SET status = CASE WHEN status IN ('won','lost') THEN status ELSE 'quoted' END, updated_at = ? WHERE id = ?").bind(isoNow(), body.lead_id).run();
  }
  const quote = await env.DB.prepare("SELECT * FROM quotes WHERE id = ?").bind(built.id).first();
  const quoteLines = await listBy(env, request, "SELECT * FROM quote_lines WHERE quote_id = ? ORDER BY sort_order", [built.id]);
  return json({ quote: { ...quote, lines: quoteLines } }, 201, request);
}

async function patchQuote(id, request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  const existing = await env.DB.prepare("SELECT * FROM quotes WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Quote not found." }, 404, request);
  const fields = { updated_at: isoNow() };
  if (body.status !== undefined) {
    const status = vOneOf(String(body.status), QUOTE_STATUSES, "quote status");
    if (status.error) return json({ error: status.error }, 400, request);
    fields.status = status.value;
  }
  if (body.notes !== undefined) fields.notes = String(body.notes || "").trim();
  if (body.valid_until !== undefined) fields.valid_until = body.valid_until || null;
  if (body.event_date !== undefined) fields.event_date = body.event_date || null;
  if (body.venue !== undefined) fields.venue = String(body.venue || "").trim();
  if (body.contact !== undefined) fields.contact = String(body.contact || "").trim();
  if (body.client_name !== undefined) fields.client_name = String(body.client_name || "").trim();
  if (Array.isArray(body.lines)) {
    const totals = quoteTotals(body.lines, body.discount !== undefined ? body.discount : existing.discount);
    fields.items = JSON.stringify(body.lines);
    fields.subtotal = totals.subtotal;
    fields.discount = totals.discount;
    fields.total = totals.total;
  } else if (body.discount !== undefined) {
    const totals = quoteTotals(JSON.parse(existing.items || "[]"), body.discount);
    fields.discount = totals.discount;
    fields.total = totals.total;
  }
  attachCents(fields, QUOTE_MONEY);
  const keys = Object.keys(fields);
  const statements = [
    env.DB.prepare(`UPDATE quotes SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`).bind(...keys.map((k) => fields[k]), id)
  ];
  if (Array.isArray(body.lines)) {
    statements.push(env.DB.prepare("DELETE FROM quote_lines WHERE quote_id = ?").bind(id));
    body.lines.forEach((line, index) => {
      const qty = Number(line.qty) || 1;
      const unit = Number(line.unit_price) || 0;
      statements.push(env.DB.prepare(
        `INSERT INTO quote_lines (id, quote_id, label, qty, unit_price, amount, sort_order, is_sample, unit_price_cents, amount_cents) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(randomId(), id, String(line.label || "Item").slice(0, 200), qty, unit, qty * unit, index, existing.is_sample || 0, centsFromPesos(unit), centsFromPesos(qty * unit)));
    });
  }
  statements.push(auditStmt(env, user, "update", "quotes", id, JSON.stringify(fields), request, existing.is_sample));
  await env.DB.batch(statements);
  const quote = await env.DB.prepare("SELECT * FROM quotes WHERE id = ?").bind(id).first();
  const lines = await listBy(env, request, "SELECT * FROM quote_lines WHERE quote_id = ? ORDER BY sort_order", [id]);
  return json({ quote: { ...quote, lines } }, 200, request);
}

async function acceptQuote(id, request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const quote = await env.DB.prepare("SELECT * FROM quotes WHERE id = ?").bind(id).first();
  if (!quote) return json({ error: "Quote not found." }, 404, request);
  if (quote.status === "accepted" && quote.event_id) {
    return json({ quote, eventId: quote.event_id }, 200, request);
  }
  const date = quote.event_date;
  if (!date) return json({ error: "Please set an event date on the quote before accepting it." }, 400, request);
  const venue = quote.venue || "Any";
  const taken = await dateVenueTaken(env, date, venue);
  if (taken && !quote.event_id) return json({ error: "That date and venue are already held by another event." }, 409, request);
  const now = isoNow();
  const eventId = quote.event_id || randomId();
  const contractId = randomId();
  const contractNo = await nextSerial(env, "contracts");
  const statements = [
    env.DB.prepare("UPDATE quotes SET status = 'accepted', event_id = ?, updated_at = ? WHERE id = ? AND status != 'accepted'").bind(eventId, now, id)
  ];
  if (!quote.event_id) {
    statements.push(env.DB.prepare(
      `INSERT INTO events (id, date, client, title, type, package, pax, venue, status, fee, deposit, contract_total, quote_id, client_id, package_id, created_at, created_by, is_sample)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Confirmed', ?, 0, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      eventId, date, quote.client_name, quote.venue ? `${quote.client_name} event` : "Booked event",
      "Other", null, null, venue, quote.total, quote.total, quote.id, quote.client_id, quote.package_id, now, user.id, quote.is_sample || 0
    ));
  } else {
    statements.push(env.DB.prepare("UPDATE events SET quote_id = ?, contract_total = ?, fee = IFNULL(fee, ?), updated_at = ? WHERE id = ?").bind(id, quote.total, quote.total, now, eventId));
  }
  statements.push(env.DB.prepare(
    `INSERT INTO contracts (id, number, quote_id, event_id, client_id, client_name, event_date, venue, total, deposit_due, terms, status, created_at, created_by, is_sample, total_cents, deposit_due_cents)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)`
  ).bind(contractId, contractNo, id, eventId, quote.client_id, quote.client_name, date, venue, quote.total, Math.round((quote.total || 0) * 0.5), "Fifty percent reservation, balance due seven days before the event.", now, user.id, quote.is_sample || 0, centsFromPesos(quote.total), centsFromPesos(Math.round((quote.total || 0) * 0.5))));
  if (quote.lead_id) {
    statements.push(env.DB.prepare("UPDATE leads SET status = 'won', updated_at = ? WHERE id = ?").bind(now, quote.lead_id));
  }
  statements.push(auditStmt(env, user, "accept", "quotes", id, `Event ${eventId} contract ${contractNo}`, request, quote.is_sample));
  const results = await env.DB.batch(statements);
  const changes = results[0] && results[0].meta && results[0].meta.changes;
  if (changes !== 1 && quote.status !== "accepted") {
    return json({ error: "This quote could not be accepted. It may have just changed." }, 409, request);
  }
  return json({ ok: true, eventId, contractId, quote: await env.DB.prepare("SELECT * FROM quotes WHERE id = ?").bind(id).first() }, 200, request);
}

async function listContracts(env, request, user) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "";
  const clauses = [];
  const params = [];
  if (status && CONTRACT_STATUSES.includes(status)) { clauses.push("status = ?"); params.push(status); }
  let sql = "SELECT * FROM contracts";
  if (clauses.length) sql += ` WHERE ${clauses.join(" AND ")}`;
  sql += " ORDER BY created_at DESC LIMIT 500";
  const contracts = (await listBy(env, request, sql, params)).map((row) => withPesos(row, CONTRACT_MONEY));
  return json({ contracts: isOwner(user) ? contracts : contracts.map((row) => stripMoneyFields(row, CONTRACT_MONEY)), statuses: CONTRACT_STATUSES }, 200, request);
}

async function createContract(request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  const clientName = vStr(body && body.client_name, { label: "the client name", max: 120 });
  const total = vInt(body && body.total, { label: "the contract total", min: 0, max: 100000000 });
  const depositDue = vInt(body && body.deposit_due, { label: "the reservation amount", min: 0, max: 100000000, required: false });
  const eventDate = vDate(body && body.event_date, { label: "the event date", required: false });
  const status = vOneOf(String(body && body.status || "draft"), CONTRACT_STATUSES, "contract status");
  for (const field of [clientName, total, depositDue, eventDate, status]) {
    if (field.error) return json({ error: field.error }, 400, request);
  }
  const id = randomId();
  const number = await nextSerial(env, "contracts");
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO contracts (id, number, quote_id, event_id, client_id, client_name, event_date, venue, total, deposit_due, terms, status, created_at, created_by, is_sample, total_cents, deposit_due_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    ).bind(id, number, body.quote_id || null, body.event_id || null, body.client_id || null, clientName.value, eventDate.value || null, body.venue || "", total.value, depositDue.value || Math.round((total.value || 0) * 0.5), body.terms || "", status.value, isoNow(), user.id, centsFromPesos(total.value), centsFromPesos(depositDue.value || Math.round((total.value || 0) * 0.5))),
    auditStmt(env, user, "create", "contracts", id, number, request)
  ]);
  return json({ contract: await env.DB.prepare("SELECT * FROM contracts WHERE id = ?").bind(id).first() }, 201, request);
}

async function patchContract(id, request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  const existing = await env.DB.prepare("SELECT * FROM contracts WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Contract not found." }, 404, request);
  const fields = { updated_at: isoNow() };
  if (body.status !== undefined) {
    const status = vOneOf(String(body.status), CONTRACT_STATUSES, "contract status");
    if (status.error) return json({ error: status.error }, 400, request);
    fields.status = status.value;
    if (status.value === "signed") fields.signed_at = isoNow();
  }
  if (body.terms !== undefined) fields.terms = String(body.terms || "").trim();
  if (body.total !== undefined) {
    const total = vInt(body.total, { label: "the contract total", min: 0, max: 100000000 });
    if (total.error) return json({ error: total.error }, 400, request);
    fields.total = total.value;
  }
  if (body.deposit_due !== undefined) fields.deposit_due = Number(body.deposit_due) || 0;
  attachCents(fields, CONTRACT_MONEY);
  const keys = Object.keys(fields);
  await env.DB.batch([
    env.DB.prepare(`UPDATE contracts SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`).bind(...keys.map((k) => fields[k]), id),
    auditStmt(env, user, "update", "contracts", id, JSON.stringify(fields), request, existing.is_sample)
  ]);
  return json({ contract: await env.DB.prepare("SELECT * FROM contracts WHERE id = ?").bind(id).first() }, 200, request);
}

async function listPayments(env, request, user) {
  const url = new URL(request.url);
  const eventId = url.searchParams.get("event") || "";
  const clauses = [];
  const params = [];
  if (eventId) { clauses.push("event_id = ?"); params.push(eventId); }
  let sql = "SELECT * FROM payments";
  if (clauses.length) sql += ` WHERE ${clauses.join(" AND ")}`;
  sql += " ORDER BY received_at DESC LIMIT 500";
  const payments = (await listBy(env, request, sql, params)).map((row) => withPesos(row, PAYMENT_MONEY));
  return json({ payments, kinds: PAYMENT_KINDS, methods: PAYMENT_METHODS }, 200, request);
}

async function createPayment(request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  const amount = vInt(body && body.amount, { label: "the amount", min: 1, max: 100000000 });
  const kind = vOneOf(String(body && body.kind || "downpayment"), PAYMENT_KINDS, "payment kind");
  const method = vOneOf(String(body && body.method || "cash"), PAYMENT_METHODS, "payment method");
  const received = vDate(body && body.received_at || todayISO(), { label: "the date received" });
  const notes = vStr(body && body.notes, { label: "notes", required: false, max: 1000 });
  for (const field of [amount, kind, method, received, notes]) {
    if (field.error) return json({ error: field.error }, 400, request);
  }
  const id = randomId();
  const receipt = body.receipt_no || body.or_number || await nextSerial(env, "payments");
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO payments (id, receipt_no, or_number, event_id, quote_id, contract_id, client_name, kind, amount, method, received_at, notes, created_at, created_by, is_sample, amount_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
    ).bind(id, receipt, receipt, body.event_id || null, body.quote_id || null, body.contract_id || null, body.client_name || "", kind.value, amount.value, method.value, received.value, notes.value, isoNow(), user.id, centsFromPesos(amount.value)),
    auditStmt(env, user, "create", "payments", id, `${receipt} ${amount.value}`, request)
  ]);
  return json({ payment: await env.DB.prepare("SELECT * FROM payments WHERE id = ?").bind(id).first() }, 201, request);
}

async function voidPayment(id, request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const existing = await env.DB.prepare("SELECT * FROM payments WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Payment not found." }, 404, request);
  if (existing.voided_at) return json({ payment: existing }, 200, request);
  const now = isoNow();
  await env.DB.batch([
    env.DB.prepare("UPDATE payments SET voided_at = ?, voided_by = ? WHERE id = ? AND voided_at IS NULL").bind(now, user.id, id),
    auditStmt(env, user, "void", "payments", id, existing.receipt_no, request, existing.is_sample)
  ]);
  return json({ payment: await env.DB.prepare("SELECT * FROM payments WHERE id = ?").bind(id).first() }, 200, request);
}

async function salesPipeline(env, request, user) {
  const leads = await listBy(env, request, "SELECT status, COUNT(*) AS n FROM leads GROUP BY status");
  if (!isOwner(user)) {
    const quotes = await listBy(env, request, "SELECT status, COUNT(*) AS n FROM quotes GROUP BY status");
    return json({ leads, quotes }, 200, request);
  }
  const quotes = await listBy(env, request, "SELECT status, COUNT(*) AS n, SUM(IFNULL(total_cents, CAST(ROUND(total * 100) AS INTEGER))) AS total_cents, SUM(total) AS total FROM quotes GROUP BY status");
  const unpaid = await listBy(env, request, "SELECT * FROM v_event_balance WHERE IFNULL(balance,0) > 0 ORDER BY date");
  return json({ leads, quotes, unpaid }, 200, request);
}

async function eventBalance(env, request, user, id) {
  const row = await env.DB.prepare("SELECT * FROM v_event_balance WHERE event_id = ?").bind(id).first();
  if (!row) return json({ error: "Event not found." }, 404, request);
  if (user.role !== "owner" && user.role !== "admin") return deny(request);
  const payments = await listBy(env, request, "SELECT * FROM payments WHERE event_id = ? ORDER BY received_at", [id]);
  return json({ balance: row, payments }, 200, request);
}

async function getEventSheet(env, request, user, id) {
  const event = await env.DB.prepare(`SELECT ${eventColumns(user.role)} FROM events e WHERE e.id = ?`).bind(id).first();
  if (!event) return json({ error: "Event not found." }, 404, request);
  const details = await env.DB.prepare("SELECT * FROM event_details WHERE event_id = ?").bind(id).first();
  const shifts = await listBy(env, request, `SELECT shifts.*, u.name AS staff_name FROM shifts LEFT JOIN users u ON u.id = shifts.staff_id WHERE shifts.event_id = ? ORDER BY shifts.start`, [id]);
  const allocations = await listBy(env, request, `SELECT a.*, i.name AS item_name, i.unit FROM event_item_allocations a LEFT JOIN inventory_items i ON i.id = a.item_id WHERE a.event_id = ?`, [id]);
  const jobs = await listBy(env, request, `SELECT c.*, u.name AS assigned_name, ar.name AS area_name FROM checklists c LEFT JOIN users u ON u.id = c.assigned_to LEFT JOIN areas ar ON ar.id = c.area_id WHERE c.event_id = ?`, [id]);
  let balance = null;
  if (user.role === "owner" || allow(user, "sales", "read")) {
    balance = await env.DB.prepare("SELECT * FROM v_event_balance WHERE event_id = ?").bind(id).first();
  }
  return json({ event, details: details || { event_id: id }, shifts, allocations, jobs, balance }, 200, request);
}

async function saveEventSheet(env, request, user, id) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const existing = await env.DB.prepare("SELECT * FROM events WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Event not found." }, 404, request);
  const body = await readJson(request);
  const headcount = vInt(body && body.headcount, { label: "the headcount", min: 0, max: 2000, required: false, allowNull: true });
  const menu = vStr(body && body.menu, { label: "the menu", required: false, max: 4000 });
  const setup = vStr(body && body.setup, { label: "the setup notes", required: false, max: 4000 });
  const timeline = vStr(body && body.timeline, { label: "the timeline", required: false, max: 4000 });
  const notes = vStr(body && body.notes, { label: "notes", required: false, max: 4000 });
  for (const field of [headcount, menu, setup, timeline, notes]) {
    if (field.error) return json({ error: field.error }, 400, request);
  }
  const now = isoNow();
  const coordinator = body.coordinator_id || null;
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO event_details (event_id, headcount, menu, setup, timeline, notes, coordinator_id, updated_at, created_at, created_by, is_sample)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(event_id) DO UPDATE SET headcount=excluded.headcount, menu=excluded.menu, setup=excluded.setup, timeline=excluded.timeline, notes=excluded.notes, coordinator_id=excluded.coordinator_id, updated_at=excluded.updated_at`
    ).bind(id, headcount.value, menu.value, setup.value, timeline.value, notes.value, coordinator, now, now, user.id, existing.is_sample || 0),
    env.DB.prepare("UPDATE events SET coordinator_id = ?, updated_at = ? WHERE id = ?").bind(coordinator, now, id),
    auditStmt(env, user, "update", "event_details", id, "Event sheet saved", request, existing.is_sample)
  ]);
  return getEventSheet(env, request, user, id);
}


async function listAreas(env, request) {
  const rows = await listBy(env, request, `SELECT a.*, v.name AS venue_name FROM areas a LEFT JOIN venues v ON v.id = a.venue_id ORDER BY a.name`);
  const venues = await listBy(env, request, "SELECT * FROM venues ORDER BY name");
  return json({ areas: rows, venues }, 200, request);
}

async function createArea(request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  const name = vStr(body && body.name, { label: "the area name", max: 120 });
  if (name.error) return json({ error: name.error }, 400, request);
  const id = randomId();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO areas (id, name, kind, notes, venue_id, is_sample) VALUES (?, ?, ?, ?, ?, 0)").bind(id, name.value, body.kind || "", body.notes || "", body.venue_id || null),
    auditStmt(env, user, "create", "areas", id, name.value, request)
  ]);
  return json({ area: await env.DB.prepare("SELECT * FROM areas WHERE id = ?").bind(id).first() }, 201, request);
}

async function patchArea(id, request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  const existing = await env.DB.prepare("SELECT * FROM areas WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Area not found." }, 404, request);
  const fields = {};
  if (body.name !== undefined) fields.name = String(body.name || "").trim();
  if (body.kind !== undefined) fields.kind = String(body.kind || "").trim();
  if (body.notes !== undefined) fields.notes = String(body.notes || "").trim();
  if (body.venue_id !== undefined) fields.venue_id = body.venue_id || null;
  const keys = Object.keys(fields);
  if (!keys.length) return json({ area: existing }, 200, request);
  await env.DB.prepare(`UPDATE areas SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`).bind(...keys.map((k) => fields[k]), id).run();
  await audit(env, user, "update", "areas", id, JSON.stringify(fields), request, existing.is_sample);
  return json({ area: await env.DB.prepare("SELECT * FROM areas WHERE id = ?").bind(id).first() }, 200, request);
}

async function listHkTemplates(env, request) {
  const templates = await listBy(env, request, `SELECT t.*, a.name AS area_name FROM hk_templates t LEFT JOIN areas a ON a.id = t.area_id ORDER BY t.name`);
  const ids = templates.map((row) => row.id);
  let items = [];
  if (ids.length) items = await listBy(env, request, `SELECT * FROM hk_template_items WHERE template_id IN (${ids.map(() => "?").join(",")}) ORDER BY sort_order`, ids);
  const by = {};
  for (const item of items) {
    if (!by[item.template_id]) by[item.template_id] = [];
    by[item.template_id].push(item);
  }
  return json({ templates: templates.map((row) => ({ ...row, items: by[row.id] || [] })), kinds: HK_KINDS }, 200, request);
}

async function createHkTemplate(request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  const name = vStr(body && body.name, { label: "the template name", max: 160 });
  const kind = vOneOf(String(body && body.kind || "pre"), HK_KINDS, "job kind");
  if (name.error || kind.error) return json({ error: (name.error || kind.error) }, 400, request);
  const id = randomId();
  const statements = [
    env.DB.prepare("INSERT INTO hk_templates (id, name, kind, area_id, is_sample, created_at) VALUES (?, ?, ?, ?, 0, ?)").bind(id, name.value, kind.value, body.area_id || null, isoNow())
  ];
  (body.items || []).forEach((label, index) => {
    const text = typeof label === "string" ? label : label.label;
    if (!text) return;
    statements.push(env.DB.prepare("INSERT INTO hk_template_items (id, template_id, label, sort_order, is_sample) VALUES (?, ?, ?, ?, 0)").bind(randomId(), id, String(text).slice(0, 200), index));
  });
  statements.push(auditStmt(env, user, "create", "hk_templates", id, name.value, request));
  await env.DB.batch(statements);
  return json({ template: await env.DB.prepare("SELECT * FROM hk_templates WHERE id = ?").bind(id).first() }, 201, request);
}

async function listHkJobs(env, request, user) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "";
  const eventId = url.searchParams.get("event") || "";
  const clauses = [];
  const params = [];
  if (user.role === "staff") { clauses.push("c.assigned_to = ?"); params.push(user.id); }
  if (status && HK_STATUSES.includes(status)) { clauses.push("c.status = ?"); params.push(status); }
  if (eventId) { clauses.push("c.event_id = ?"); params.push(eventId); }
  let sql = `SELECT c.*, u.name AS assigned_name, ar.name AS area_name, e.client AS event_client, e.title AS event_title, e.date AS event_date
             FROM checklists c
             LEFT JOIN users u ON u.id = c.assigned_to
             LEFT JOIN areas ar ON ar.id = c.area_id
             LEFT JOIN events e ON e.id = c.event_id`;
  if (clauses.length) sql += ` WHERE ${clauses.join(" AND ")}`;
  sql += " ORDER BY c.due ASC, c.created_at DESC LIMIT 500";
  const jobs = await listBy(env, request, sql, params);
  const ids = jobs.map((row) => row.id);
  let items = [];
  if (ids.length) items = await listBy(env, request, `SELECT * FROM checklist_items WHERE checklist_id IN (${ids.map(() => "?").join(",")}) ORDER BY sort_order`, ids);
  const by = {};
  for (const item of items) {
    if (!by[item.checklist_id]) by[item.checklist_id] = [];
    by[item.checklist_id].push(item);
  }
  return json({ jobs: jobs.map((row) => ({ ...row, items: by[row.id] || [] })), statuses: HK_STATUSES, kinds: HK_KINDS }, 200, request);
}

async function createHkJob(request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  if (user.role === "staff") return deny(request);
  const body = await readJson(request);
  const title = vStr(body && body.title, { label: "the job title", max: 160 });
  const kind = vOneOf(String(body && body.kind || "pre"), HK_KINDS, "job kind");
  const status = vOneOf(String(body && body.status || "pending"), HK_STATUSES, "job status");
  const due = vDate(body && body.due, { label: "the due date", required: false });
  for (const field of [title, kind, status, due]) {
    if (field.error) return json({ error: field.error }, 400, request);
  }
  const id = randomId();
  const statements = [
    env.DB.prepare(
      `INSERT INTO checklists (id, event_id, area_id, kind, title, assigned_to, due, status, notes, created_at, created_by, is_sample)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
    ).bind(id, body.event_id || null, body.area_id || null, kind.value, title.value, body.assigned_to || null, due.value || null, status.value, body.notes || "", isoNow(), user.id)
  ];
  let labels = Array.isArray(body.items) ? body.items : [];
  if (body.template_id && !labels.length) {
    const tmpl = await listBy(env, request, "SELECT label, sort_order FROM hk_template_items WHERE template_id = ? ORDER BY sort_order", [body.template_id]);
    labels = tmpl.map((row) => row.label);
  }
  labels.forEach((label, index) => {
    const text = typeof label === "string" ? label : label.label;
    if (!text) return;
    statements.push(env.DB.prepare("INSERT INTO checklist_items (id, checklist_id, label, done, notes, sort_order, is_sample) VALUES (?, ?, ?, 0, '', ?, 0)").bind(randomId(), id, String(text).slice(0, 200), index));
  });
  statements.push(auditStmt(env, user, "create", "checklists", id, title.value, request));
  await env.DB.batch(statements);
  return json({ job: await env.DB.prepare("SELECT * FROM checklists WHERE id = ?").bind(id).first() }, 201, request);
}

async function patchHkJob(id, request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const existing = await env.DB.prepare("SELECT * FROM checklists WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Job not found." }, 404, request);
  if (user.role === "staff" && existing.assigned_to !== user.id) return deny(request);
  const body = await readJson(request);
  const fields = {};
  if (body.status !== undefined) {
    const status = vOneOf(String(body.status), HK_STATUSES, "job status");
    if (status.error) return json({ error: status.error }, 400, request);
    fields.status = status.value;
  }
  if (body.notes !== undefined) fields.notes = String(body.notes || "").trim();
  if (body.assigned_to !== undefined && user.role !== "staff") fields.assigned_to = body.assigned_to || null;
  if (body.due !== undefined && user.role !== "staff") fields.due = body.due || null;
  if (body.title !== undefined && user.role !== "staff") fields.title = String(body.title || "").trim();
  const keys = Object.keys(fields);
  if (!keys.length) return json({ job: existing }, 200, request);
  await env.DB.batch([
    env.DB.prepare(`UPDATE checklists SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`).bind(...keys.map((k) => fields[k]), id),
    auditStmt(env, user, "update", "checklists", id, JSON.stringify(fields), request, existing.is_sample)
  ]);
  return json({ job: await env.DB.prepare("SELECT * FROM checklists WHERE id = ?").bind(id).first() }, 200, request);
}

async function patchHkItem(id, request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const item = await env.DB.prepare("SELECT * FROM checklist_items WHERE id = ?").bind(id).first();
  if (!item) return json({ error: "Item not found." }, 404, request);
  const job = await env.DB.prepare("SELECT * FROM checklists WHERE id = ?").bind(item.checklist_id).first();
  if (user.role === "staff" && job && job.assigned_to !== user.id) return deny(request);
  const body = await readJson(request);
  const done = body.done ? 1 : 0;
  const notes = body.notes !== undefined ? String(body.notes || "").trim() : item.notes;
  await env.DB.prepare("UPDATE checklist_items SET done = ?, notes = ? WHERE id = ?").bind(done, notes, id).run();
  await audit(env, user, "update", "checklist_items", id, done ? "checked" : "unchecked", request, item.is_sample);
  return json({ item: await env.DB.prepare("SELECT * FROM checklist_items WHERE id = ?").bind(id).first() }, 200, request);
}

async function listTickets(env, request) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "";
  const clauses = [];
  const params = [];
  if (status && TICKET_STATUSES.includes(status)) { clauses.push("i.status = ?"); params.push(status); }
  let sql = `SELECT i.*, a.name AS area_name, u.name AS reporter_name, s.name AS assigned_name
             FROM issues i
             LEFT JOIN areas a ON a.id = i.area_id
             LEFT JOIN users u ON u.id = i.reported_by
             LEFT JOIN users s ON s.id = i.assigned_to`;
  if (clauses.length) sql += ` WHERE ${clauses.join(" AND ")}`;
  sql += " ORDER BY i.created_at DESC LIMIT 500";
  return json({ tickets: await listBy(env, request, sql, params), statuses: TICKET_STATUSES, priorities: TICKET_PRIORITIES }, 200, request);
}

async function createTicket(request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  const title = vStr(body && body.title, { label: "the issue title", max: 160 });
  const detail = vStr(body && body.detail, { label: "the details", required: false, max: 4000 });
  const priority = vOneOf(String(body && body.priority || "normal"), TICKET_PRIORITIES, "priority");
  if (title.error || detail.error || priority.error) return json({ error: title.error || detail.error || priority.error }, 400, request);
  const id = randomId();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO issues (id, area_id, event_id, title, detail, status, priority, reported_by, assigned_to, created_at, is_sample)
       VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, 0)`
    ).bind(id, body.area_id || null, body.event_id || null, title.value, detail.value, priority.value, user.id, body.assigned_to || null, isoNow()),
    auditStmt(env, user, "create", "issues", id, title.value, request)
  ]);
  return json({ ticket: await env.DB.prepare("SELECT * FROM issues WHERE id = ?").bind(id).first() }, 201, request);
}

async function patchTicket(id, request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const existing = await env.DB.prepare("SELECT * FROM issues WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Issue not found." }, 404, request);
  const body = await readJson(request);
  const fields = { updated_at: isoNow() };
  if (body.status !== undefined) {
    const status = vOneOf(String(body.status), TICKET_STATUSES, "status");
    if (status.error) return json({ error: status.error }, 400, request);
    fields.status = status.value;
    if (status.value === "resolved" || status.value === "closed") fields.resolved_at = isoNow();
  }
  if (body.priority !== undefined) {
    const priority = vOneOf(String(body.priority), TICKET_PRIORITIES, "priority");
    if (priority.error) return json({ error: priority.error }, 400, request);
    fields.priority = priority.value;
  }
  if (body.detail !== undefined) fields.detail = String(body.detail || "").trim();
  if (body.assigned_to !== undefined && user.role !== "staff") fields.assigned_to = body.assigned_to || null;
  const keys = Object.keys(fields);
  await env.DB.batch([
    env.DB.prepare(`UPDATE issues SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`).bind(...keys.map((k) => fields[k]), id),
    auditStmt(env, user, "update", "issues", id, JSON.stringify(fields), request, existing.is_sample)
  ]);
  return json({ ticket: await env.DB.prepare("SELECT * FROM issues WHERE id = ?").bind(id).first() }, 200, request);
}


function moveSigned(kind, qty) {
  const n = Number(qty) || 0;
  if (kind === "receive" || kind === "return") return Math.abs(n);
  if (kind === "issue" || kind === "damage" || kind === "loss") return -Math.abs(n);
  if (kind === "adjust") return n;
  if (kind === "transfer") return -Math.abs(n);
  return 0;
}

async function listInventoryItems(env, request) {
  const url = new URL(request.url);
  const category = url.searchParams.get("category") || "";
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const clauses = [];
  const params = [];
  if (category) { clauses.push("category = ?"); params.push(category); }
  if (q) { clauses.push("(LOWER(name) LIKE ? OR LOWER(IFNULL(sku,'')) LIKE ?)"); params.push(`%${q}%`, `%${q}%`); }
  let sql = "SELECT * FROM inventory_items";
  if (clauses.length) sql += ` WHERE ${clauses.join(" AND ")}`;
  sql += " ORDER BY category, name LIMIT 500";
  return json({ items: await listBy(env, request, sql, params) }, 200, request);
}

async function listStock(env, request) {
  const rows = await listBy(env, request, "SELECT * FROM v_stock_on_hand ORDER BY category, name");
  const low = rows.filter((row) => Number(row.qty_on_hand || 0) <= Number(row.reorder_level || 0));
  const locations = await listBy(env, request, "SELECT * FROM stock_locations ORDER BY name");
  return json({ stock: rows, low, locations }, 200, request);
}

async function createInventoryItem(request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  if (user.role === "staff") return deny(request);
  const body = await readJson(request);
  const name = vStr(body && body.name, { label: "the item name", max: 160 });
  const category = vStr(body && body.category, { label: "the category", max: 80 });
  const unit = vStr(body && body.unit || "pc", { label: "the unit", max: 20 });
  const qty = vInt(body && body.qty_on_hand, { label: "the quantity", min: 0, max: 1000000, required: false });
  const reorder = vInt(body && body.reorder_level, { label: "the reorder level", min: 0, max: 1000000, required: false });
  const cost = vInt(body && body.unit_cost, { label: "the unit cost", min: 0, max: 10000000, required: false, allowNull: true });
  if ([name, category, unit, qty, reorder, cost].some((f) => f.error)) return json({ error: (name.error || category.error || unit.error || qty.error || reorder.error || cost.error) }, 400, request);
  const id = randomId();
  const opening = qty.value || 0;
  const statements = [
    env.DB.prepare(
      `INSERT INTO inventory_items (id, name, category, unit, qty_on_hand, reorder_level, notes, sku, consumable, unit_cost, location_id, is_sample, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
    ).bind(id, name.value, category.value, unit.value, opening, reorder.value || 0, body.notes || "", body.sku || "", body.consumable ? 1 : 0, cost.value, body.location_id || null, isoNow())
  ];
  if (opening) {
    statements.push(env.DB.prepare(
      `INSERT INTO inventory_moves (id, item_id, kind, qty, signed_qty, event_id, notes, created_at, created_by, is_sample)
       VALUES (?, ?, 'receive', ?, ?, NULL, 'Opening quantity', ?, ?, 0)`
    ).bind(randomId(), id, opening, opening, isoNow(), user.id));
  }
  statements.push(auditStmt(env, user, "create", "inventory_items", id, name.value, request));
  await env.DB.batch(statements);
  return json({ item: await env.DB.prepare("SELECT * FROM inventory_items WHERE id = ?").bind(id).first() }, 201, request);
}

async function patchInventoryItem(id, request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  if (user.role === "staff") return deny(request);
  const existing = await env.DB.prepare("SELECT * FROM inventory_items WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Item not found." }, 404, request);
  const body = await readJson(request);
  const fields = { updated_at: isoNow() };
  for (const key of ["name", "category", "unit", "notes", "sku"]) {
    if (body[key] !== undefined) fields[key] = String(body[key] || "").trim();
  }
  if (body.reorder_level !== undefined) fields.reorder_level = Number(body.reorder_level) || 0;
  if (body.unit_cost !== undefined) fields.unit_cost = body.unit_cost === "" || body.unit_cost === null ? null : Number(body.unit_cost);
  if (body.consumable !== undefined) fields.consumable = body.consumable ? 1 : 0;
  if (body.location_id !== undefined) fields.location_id = body.location_id || null;
  const keys = Object.keys(fields);
  await env.DB.batch([
    env.DB.prepare(`UPDATE inventory_items SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`).bind(...keys.map((k) => fields[k]), id),
    auditStmt(env, user, "update", "inventory_items", id, JSON.stringify(fields), request, existing.is_sample)
  ]);
  return json({ item: await env.DB.prepare("SELECT * FROM inventory_items WHERE id = ?").bind(id).first() }, 200, request);
}

async function listMoves(env, request) {
  const url = new URL(request.url);
  const itemId = url.searchParams.get("item") || "";
  const eventId = url.searchParams.get("event") || "";
  const clauses = [];
  const params = [];
  if (itemId) { clauses.push("m.item_id = ?"); params.push(itemId); }
  if (eventId) { clauses.push("m.event_id = ?"); params.push(eventId); }
  let sql = `SELECT m.*, i.name AS item_name, i.unit, e.client AS event_client
             FROM inventory_moves m
             LEFT JOIN inventory_items i ON i.id = m.item_id
             LEFT JOIN events e ON e.id = m.event_id`;
  if (clauses.length) sql += ` WHERE ${clauses.join(" AND ")}`;
  sql += " ORDER BY m.created_at DESC LIMIT 500";
  return json({ moves: await listBy(env, request, sql, params), kinds: MOVE_KINDS }, 200, request);
}

async function createMove(request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  const kind = vOneOf(String(body && body.kind || ""), MOVE_KINDS, "movement type");
  const qty = vInt(body && body.qty, { label: "the quantity", min: kind && kind.value === "adjust" ? -1000000 : 1, max: 1000000 });
  if (kind.error || qty.error) return json({ error: kind.error || qty.error }, 400, request);
  if (user.role === "staff" && !["issue", "return"].includes(kind.value)) return deny(request);
  const item = await env.DB.prepare("SELECT * FROM inventory_items WHERE id = ?").bind(body.item_id).first();
  if (!item) return json({ error: "Item not found." }, 400, request);
  const signed = moveSigned(kind.value, qty.value);
  const nextQty = (item.qty_on_hand || 0) + signed;
  if (nextQty < 0) return json({ error: "There is not enough stock on hand for that movement." }, 409, request);
  const id = randomId();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO inventory_moves (id, item_id, kind, qty, signed_qty, event_id, notes, created_at, created_by, is_sample, location_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
    ).bind(id, item.id, kind.value, Math.abs(qty.value), signed, body.event_id || null, body.notes || "", isoNow(), user.id, body.location_id || item.location_id || null),
    env.DB.prepare("UPDATE inventory_items SET qty_on_hand = ?, updated_at = ? WHERE id = ?").bind(nextQty, isoNow(), item.id),
    auditStmt(env, user, "create", "inventory_moves", id, `${kind.value} ${item.name} ${signed}`, request)
  ]);
  return json({ move: await env.DB.prepare("SELECT * FROM inventory_moves WHERE id = ?").bind(id).first(), qty_on_hand: nextQty }, 201, request);
}

async function listAllocations(env, request) {
  const url = new URL(request.url);
  const eventId = url.searchParams.get("event") || "";
  const params = [];
  let sql = `SELECT a.*, i.name AS item_name, i.unit, e.client AS event_client, e.date AS event_date
             FROM event_item_allocations a
             LEFT JOIN inventory_items i ON i.id = a.item_id
             LEFT JOIN events e ON e.id = a.event_id`;
  if (eventId) { sql += " WHERE a.event_id = ?"; params.push(eventId); }
  sql += " ORDER BY e.date DESC";
  return json({ allocations: await listBy(env, request, sql, params) }, 200, request);
}

async function createAllocation(request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  if (user.role === "staff") return deny(request);
  const body = await readJson(request);
  const qty = vInt(body && body.qty, { label: "the quantity", min: 1, max: 100000 });
  if (qty.error) return json({ error: qty.error }, 400, request);
  if (!body.event_id || !body.item_id) return json({ error: "Please pick an event and an item." }, 400, request);
  const id = randomId();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO event_item_allocations (id, event_id, item_id, qty, returned_qty, damaged_qty, notes, is_sample, created_at, created_by)
       VALUES (?, ?, ?, ?, 0, 0, ?, 0, ?, ?)`
    ).bind(id, body.event_id, body.item_id, qty.value, body.notes || "", isoNow(), user.id),
    auditStmt(env, user, "create", "event_item_allocations", id, `${body.event_id} ${qty.value}`, request)
  ]);
  return json({ allocation: await env.DB.prepare("SELECT * FROM event_item_allocations WHERE id = ?").bind(id).first() }, 201, request);
}

async function listSuppliers(env, request) {
  return json({ suppliers: await listBy(env, request, "SELECT * FROM suppliers ORDER BY name") }, 200, request);
}

async function createSupplier(request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  if (user.role === "staff") return deny(request);
  const body = await readJson(request);
  const name = vStr(body && body.name, { label: "the supplier name", max: 160 });
  if (name.error) return json({ error: name.error }, 400, request);
  const id = randomId();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO suppliers (id, name, contact, category, notes, is_sample, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)").bind(id, name.value, body.contact || "", body.category || "", body.notes || "", isoNow()),
    auditStmt(env, user, "create", "suppliers", id, name.value, request)
  ]);
  return json({ supplier: await env.DB.prepare("SELECT * FROM suppliers WHERE id = ?").bind(id).first() }, 201, request);
}

async function patchSupplier(id, request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  if (user.role === "staff") return deny(request);
  const body = await readJson(request);
  const existing = await env.DB.prepare("SELECT * FROM suppliers WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Supplier not found." }, 404, request);
  const fields = {};
  for (const key of ["name", "contact", "category", "notes"]) {
    if (body[key] !== undefined) fields[key] = String(body[key] || "").trim();
  }
  const keys = Object.keys(fields);
  if (!keys.length) return json({ supplier: existing }, 200, request);
  await env.DB.prepare(`UPDATE suppliers SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`).bind(...keys.map((k) => fields[k]), id).run();
  return json({ supplier: await env.DB.prepare("SELECT * FROM suppliers WHERE id = ?").bind(id).first() }, 200, request);
}

async function listPOs(env, request) {
  const rows = await listBy(env, request, `SELECT p.*, s.name AS supplier_name FROM purchase_orders p LEFT JOIN suppliers s ON s.id = p.supplier_id ORDER BY p.created_at DESC LIMIT 200`);
  const ids = rows.map((row) => row.id);
  let lines = [];
  if (ids.length) lines = await listBy(env, request, `SELECT * FROM po_lines WHERE po_id IN (${ids.map(() => "?").join(",")})`, ids);
  const by = {};
  for (const line of lines) {
    if (!by[line.po_id]) by[line.po_id] = [];
    by[line.po_id].push(line);
  }
  return json({ orders: rows.map((row) => ({ ...row, lines: by[row.id] || [] })), statuses: PO_STATUSES }, 200, request);
}

async function createPO(request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  if (user.role === "staff") return deny(request);
  const body = await readJson(request);
  const lines = Array.isArray(body.lines) ? body.lines : [];
  if (!lines.length) return json({ error: "Please add at least one line." }, 400, request);
  const total = lines.reduce((sum, line) => sum + (Number(line.qty) || 0) * (Number(line.unit_cost) || 0), 0);
  const id = randomId();
  const number = await nextSerial(env, "pos");
  const statements = [
    env.DB.prepare(
      `INSERT INTO purchase_orders (id, number, supplier_id, status, ordered_at, expected_at, total, notes, created_at, created_by, is_sample, total_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
    ).bind(id, number, body.supplier_id || null, body.status && PO_STATUSES.includes(body.status) ? body.status : "draft", body.ordered_at || todayISO(), body.expected_at || null, total, body.notes || "", isoNow(), user.id, centsFromPesos(total))
  ];
  lines.forEach((line) => {
    const qty = Number(line.qty) || 1;
    const cost = Number(line.unit_cost) || 0;
    statements.push(env.DB.prepare(
      `INSERT INTO po_lines (id, po_id, item_id, label, qty, unit_cost, amount, is_sample, unit_cost_cents, amount_cents) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    ).bind(randomId(), id, line.item_id || null, String(line.label || "Item").slice(0, 200), qty, cost, qty * cost, centsFromPesos(cost), centsFromPesos(qty * cost)));
  });
  statements.push(auditStmt(env, user, "create", "purchase_orders", id, number, request));
  await env.DB.batch(statements);
  return json({ order: await env.DB.prepare("SELECT * FROM purchase_orders WHERE id = ?").bind(id).first() }, 201, request);
}

async function patchPO(id, request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  if (user.role === "staff") return deny(request);
  const existing = await env.DB.prepare("SELECT * FROM purchase_orders WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Purchase order not found." }, 404, request);
  const body = await readJson(request);
  const status = body.status ? vOneOf(String(body.status), PO_STATUSES, "status") : { value: existing.status };
  if (status.error) return json({ error: status.error }, 400, request);
  const statements = [
    env.DB.prepare("UPDATE purchase_orders SET status = ?, notes = ? WHERE id = ?").bind(status.value, body.notes !== undefined ? String(body.notes) : existing.notes, id)
  ];
  if (status.value === "received" && existing.status !== "received") {
    const lines = await listBy(env, request, "SELECT * FROM po_lines WHERE po_id = ? AND item_id IS NOT NULL", [id]);
    for (const line of lines) {
      const item = await env.DB.prepare("SELECT * FROM inventory_items WHERE id = ?").bind(line.item_id).first();
      if (!item) continue;
      const qty = Number(line.qty) || 0;
      statements.push(env.DB.prepare(
        `INSERT INTO inventory_moves (id, item_id, kind, qty, signed_qty, event_id, notes, created_at, created_by, is_sample)
         VALUES (?, ?, 'receive', ?, ?, NULL, ?, ?, ?, 0)`
      ).bind(randomId(), item.id, qty, qty, `PO ${existing.number}`, isoNow(), user.id));
      statements.push(env.DB.prepare("UPDATE inventory_items SET qty_on_hand = qty_on_hand + ?, updated_at = ? WHERE id = ?").bind(qty, isoNow(), item.id));
    }
  }
  statements.push(auditStmt(env, user, "update", "purchase_orders", id, status.value, request, existing.is_sample));
  await env.DB.batch(statements);
  return json({ order: await env.DB.prepare("SELECT * FROM purchase_orders WHERE id = ?").bind(id).first() }, 200, request);
}


async function listAccounts(env, request) {
  return json({ accounts: await listBy(env, request, "SELECT * FROM accounts ORDER BY type, code"), types: ACCOUNT_TYPES, categories: EXPENSE_CATEGORIES }, 200, request);
}

async function listExpenses(env, request) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  const category = url.searchParams.get("category") || "";
  const clauses = [];
  const params = [];
  if (from) { clauses.push("e.date >= ?"); params.push(from); }
  if (to) { clauses.push("e.date <= ?"); params.push(to); }
  if (category) { clauses.push("e.category = ?"); params.push(category); }
  let sql = `SELECT e.*, ev.client AS event_client, ev.title AS event_title, a.name AS account_name, s.name AS supplier_name
             FROM expenses e
             LEFT JOIN events ev ON ev.id = e.event_id
             LEFT JOIN accounts a ON a.id = e.account_id
             LEFT JOIN suppliers s ON s.id = e.supplier_id`;
  if (clauses.length) sql += ` WHERE ${clauses.join(" AND ")}`;
  sql += " ORDER BY e.date DESC LIMIT 500";
  const rows = await listBy(env, request, sql, params);
  const real = rows.filter((row) => !row.is_sample && !row.voided_at);
  const sample = rows.filter((row) => row.is_sample && !row.voided_at);
  const sum = (list) => list.reduce((n, row) => n + (row.amount || 0), 0);
  return json({ expenses: rows, totals: { real: sum(real), sample: sum(sample) }, categories: EXPENSE_CATEGORIES }, 200, request);
}

async function createExpense(request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  const date = vDate(body && body.date || todayISO(), { label: "the date" });
  const category = vOneOf(String(body && body.category || "other"), EXPENSE_CATEGORIES, "category");
  const amount = vInt(body && body.amount, { label: "the amount", min: 1, max: 100000000 });
  const vat = vInt(body && body.vat, { label: "the VAT", min: 0, max: 100000000, required: false });
  const payee = vStr(body && body.payee, { label: "the payee", required: false, max: 160 });
  const notes = vStr(body && body.notes, { label: "notes", required: false, max: 1000 });
  for (const field of [date, category, amount, vat, payee, notes]) {
    if (field.error) return json({ error: field.error }, 400, request);
  }
  const id = randomId();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO expenses (id, date, category, payee, amount, method, event_id, notes, created_at, created_by, is_sample, account_id, vat, receipt_no, supplier_id, amount_cents, vat_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`
    ).bind(id, date.value, category.value, payee.value, amount.value, body.method || "cash", body.event_id || null, notes.value, isoNow(), user.id, body.account_id || null, vat.value || 0, body.receipt_no || "", body.supplier_id || null, centsFromPesos(amount.value), centsFromPesos(vat.value || 0)),
    auditStmt(env, user, "create", "expenses", id, `${category.value} ${amount.value}`, request)
  ]);
  return json({ expense: await env.DB.prepare("SELECT * FROM expenses WHERE id = ?").bind(id).first() }, 201, request);
}

async function voidExpense(id, request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const existing = await env.DB.prepare("SELECT * FROM expenses WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Expense not found." }, 404, request);
  if (existing.voided_at) return json({ expense: existing }, 200, request);
  await env.DB.batch([
    env.DB.prepare("UPDATE expenses SET voided_at = ? WHERE id = ? AND voided_at IS NULL").bind(isoNow(), id),
    auditStmt(env, user, "void", "expenses", id, existing.amount, request, existing.is_sample)
  ]);
  return json({ expense: await env.DB.prepare("SELECT * FROM expenses WHERE id = ?").bind(id).first() }, 200, request);
}

async function listPetty(env, request) {
  const rows = await listBy(env, request, "SELECT * FROM petty_cash ORDER BY date DESC, created_at DESC LIMIT 500");
  const real = rows.filter((row) => !row.is_sample);
  const inAmt = real.filter((row) => row.kind === "in").reduce((s, r) => s + (r.amount || 0), 0);
  const outAmt = real.filter((row) => row.kind === "out").reduce((s, r) => s + (r.amount || 0), 0);
  const sample = rows.filter((row) => row.is_sample);
  const sIn = sample.filter((row) => row.kind === "in").reduce((s, r) => s + (r.amount || 0), 0);
  const sOut = sample.filter((row) => row.kind === "out").reduce((s, r) => s + (r.amount || 0), 0);
  return json({ entries: rows, totals: { in: inAmt, out: outAmt, balance: inAmt - outAmt }, sampleTotals: { in: sIn, out: sOut, balance: sIn - sOut } }, 200, request);
}

async function createPetty(request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  const date = vDate(body && body.date || todayISO(), { label: "the date" });
  const kind = vOneOf(String(body && body.kind || "out"), ["in", "out"], "type");
  const amount = vInt(body && body.amount, { label: "the amount", min: 1, max: 10000000 });
  const reason = vStr(body && body.reason, { label: "the reason", max: 400 });
  for (const field of [date, kind, amount, reason]) {
    if (field.error) return json({ error: field.error }, 400, request);
  }
  const id = randomId();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO petty_cash (id, date, kind, amount, reason, expense_id, created_at, created_by, is_sample, method, amount_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    ).bind(id, date.value, kind.value, amount.value, reason.value, body.expense_id || null, isoNow(), user.id, body.method || "cash", centsFromPesos(amount.value)),
    auditStmt(env, user, "create", "petty_cash", id, `${kind.value} ${amount.value}`, request)
  ]);
  return json({ entry: await env.DB.prepare("SELECT * FROM petty_cash WHERE id = ?").bind(id).first() }, 201, request);
}

function periodParams(request) {
  const url = new URL(request.url);
  const range = url.searchParams.get("range") || "monthly";
  const today = todayISO();
  let from = url.searchParams.get("from") || "";
  let to = url.searchParams.get("to") || today;
  if (!from) {
    if (range === "daily") from = today;
    else if (range === "weekly") {
      const d = new Date(`${today}T00:00:00+08:00`);
      const day = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - day);
      from = d.toISOString().slice(0, 10);
    } else from = `${today.slice(0, 8)}01`;
  }
  if (range === "daily") to = from;
  return { from, to, range };
}

async function pnlReport(env, request, user) {
  const { from, to, range } = periodParams(request);
  const payments = await listBy(env, request, "SELECT * FROM payments WHERE voided_at IS NULL AND received_at >= ? AND received_at <= ?", [from, to]);
  const expenses = await listBy(env, request, "SELECT * FROM expenses WHERE voided_at IS NULL AND date >= ? AND date <= ?", [from, to]);
  const split = (rows, isSample) => rows.filter((row) => Boolean(row.is_sample) === isSample);
  const incomeOf = (rows) => rows.reduce((s, r) => s + (r.kind === "refund" ? -r.amount : r.amount || 0), 0);
  const expOf = (rows) => rows.reduce((s, r) => s + (r.amount || 0), 0);
  const byCat = {};
  for (const row of expenses.filter((r) => !r.is_sample)) {
    byCat[row.category] = (byCat[row.category] || 0) + (row.amount || 0);
  }
  const income = incomeOf(split(payments, false));
  const expense = expOf(split(expenses, false));
  return json({
    from, to, range,
    income,
    expenses: expense,
    net: income - expense,
    byCategory: Object.keys(byCat).sort().map((k) => ({ category: k, amount: byCat[k] })),
    sample: { income: incomeOf(split(payments, true)), expenses: expOf(split(expenses, true)) }
  }, 200, request);
}

async function cashflowReport(env, request, user) {
  const { from, to, range } = periodParams(request);
  const payments = await listBy(env, request, "SELECT * FROM payments WHERE voided_at IS NULL AND received_at >= ? AND received_at <= ?", [from, to]);
  const expenses = await listBy(env, request, "SELECT * FROM expenses WHERE voided_at IS NULL AND date >= ? AND date <= ?", [from, to]);
  const petty = await listBy(env, request, "SELECT * FROM petty_cash WHERE date >= ? AND date <= ?", [from, to]);
  const days = {};
  const add = (date, field, amount, isSample) => {
    const key = String(date).slice(0, 10);
    if (!days[key]) days[key] = { date: key, in: 0, out: 0, sampleIn: 0, sampleOut: 0 };
    if (isSample) days[key][field === "in" ? "sampleIn" : "sampleOut"] += amount;
    else days[key][field] += amount;
  };
  for (const p of payments) add(p.received_at, p.kind === "refund" ? "out" : "in", p.amount || 0, p.is_sample);
  for (const e of expenses) add(e.date, "out", e.amount || 0, e.is_sample);
  for (const p of petty) add(p.date, p.kind === "in" ? "in" : "out", p.amount || 0, p.is_sample);
  const rows = Object.values(days).sort((a, b) => a.date.localeCompare(b.date));
  let balance = 0;
  const series = rows.map((row) => {
    balance += (row.in - row.out);
    return { ...row, net: row.in - row.out, running: balance };
  });
  return json({ from, to, range, days: series, totals: { in: series.reduce((s, r) => s + r.in, 0), out: series.reduce((s, r) => s + r.out, 0), net: balance } }, 200, request);
}

async function eventProfitList(env, request, user) {
  const url = new URL(request.url);
  const includeSample = url.searchParams.get("sample") === "1";
  const sql = includeSample
    ? "SELECT * FROM v_event_balance ORDER BY date"
    : "SELECT * FROM v_event_balance WHERE IFNULL(is_sample,0)=0 ORDER BY date";
  const balances = await listBy(env, request, sql);
  const expenses = await listBy(env, request, "SELECT event_id, is_sample, SUM(amount) AS direct FROM expenses WHERE voided_at IS NULL AND event_id IS NOT NULL GROUP BY event_id, is_sample");
  const labor = await listBy(env, request, `SELECT s.event_id, s.is_sample, SUM(IFNULL(p.daily_rate, IFNULL(p.rate, 0))) AS labor
    FROM shifts s LEFT JOIN staff_profiles p ON p.user_id = s.staff_id WHERE s.event_id IS NOT NULL GROUP BY s.event_id, s.is_sample`);
  const expMap = Object.fromEntries(expenses.map((r) => [r.event_id, r.direct || 0]));
  const labMap = Object.fromEntries(labor.map((r) => [r.event_id, r.labor || 0]));
  const rows = balances.map((row) => {
    const direct = expMap[row.event_id] || 0;
    const laborCost = labMap[row.event_id] || 0;
    const contract = row.contract_total || 0;
    const collected = row.collected || 0;
    const margin = contract - direct - laborCost;
    return { ...row, direct, labor: laborCost, consumables: 0, margin, collected };
  });
  return json({ events: rows }, 200, request);
}

async function eventProfitOne(env, request, user, id) {
  const list = await eventProfitList(env, { url: `https://x.local/api/accounting/event-profit?sample=1` }, user);
  const data = await list.json();
  const row = (data.events || []).find((item) => item.event_id === id);
  if (!row) return json({ error: "Event not found." }, 404, request);
  const expenses = await listBy(env, request, "SELECT * FROM expenses WHERE event_id = ? AND voided_at IS NULL ORDER BY date", [id]);
  return json({ event: row, expenses }, 200, request);
}

async function listHrStaff(env, request, user) {
  if (user.role === "staff") return deny(request);
  const rows = await listBy(env, request, `SELECT u.id, u.name, u.role, u.title, u.is_sample, u.is_active, p.daily_rate, p.hourly_rate, p.employment, p.start_date, p.notes, p.rate_type, p.rate, p.daily_rate_cents, p.hourly_rate_cents, p.rate_cents
    FROM users u LEFT JOIN staff_profiles p ON p.user_id = u.id
    WHERE u.role != 'owner' OR u.is_sample = 1
    ORDER BY u.name`);
  const staff = rows.filter((row) => row.role !== "owner").map((row) => withPesos(row, ["daily_rate", "hourly_rate", "rate"]));
  return json({ staff: isOwner(user) ? staff : staff.map((row) => stripMoneyFields(row, ["daily_rate", "hourly_rate", "rate"])) }, 200, request);
}

async function patchHrStaff(id, request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  if (id === user.id && user.role === "owner" && false) return deny(request);
  const person = await env.DB.prepare("SELECT id, role, is_sample FROM users WHERE id = ?").bind(id).first();
  if (!person) return json({ error: "Staff member not found." }, 404, request);
  if (person.role === "owner") return json({ error: "Owner payroll details are not kept here." }, 400, request);
  const body = await readJson(request);
  if (!isOwner(user) && (body.daily_rate !== undefined || body.hourly_rate !== undefined || body.rate !== undefined)) {
    return denyMoney(request);
  }
  if (!isOwner(user)) {
    body.daily_rate = undefined;
    body.hourly_rate = undefined;
    body.rate = undefined;
  }
  const daily = body.daily_rate === undefined || body.daily_rate === "" ? null : Number(body.daily_rate);
  const hourly = body.hourly_rate === undefined || body.hourly_rate === "" ? null : Number(body.hourly_rate);
  const rate = body.rate === undefined || body.rate === "" ? (daily || hourly) : Number(body.rate);
  const rateType = body.rate_type || (hourly && !daily ? "hourly" : "daily");
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO staff_profiles (user_id, daily_rate, hourly_rate, employment, start_date, notes, is_sample, rate_type, rate, created_at, daily_rate_cents, hourly_rate_cents, rate_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET daily_rate=excluded.daily_rate, hourly_rate=excluded.hourly_rate, employment=excluded.employment, start_date=excluded.start_date, notes=excluded.notes, rate_type=excluded.rate_type, rate=excluded.rate, daily_rate_cents=excluded.daily_rate_cents, hourly_rate_cents=excluded.hourly_rate_cents, rate_cents=excluded.rate_cents`
    ).bind(id, daily, hourly, body.employment || "", body.start_date || null, body.notes || "", person.is_sample || 0, rateType, rate, isoNow(), centsFromPesos(daily), centsFromPesos(hourly), centsFromPesos(rate)),
    auditStmt(env, user, "update", "staff_profiles", id, rateType, request, person.is_sample)
  ]);
  return json({ ok: true }, 200, request);
}

async function listPayroll(env, request, user) {
  const periods = await listBy(env, request, "SELECT * FROM payroll_periods ORDER BY start_date DESC LIMIT 50");
  const ids = periods.map((row) => row.id);
  let lines = [];
  if (ids.length) {
    lines = await listBy(env, request, `SELECT l.*, u.name AS staff_name FROM payroll_lines l LEFT JOIN users u ON u.id = l.user_id WHERE l.period_id IN (${ids.map(() => "?").join(",")}) ORDER BY u.name`, ids);
  }
  const by = {};
  for (const line of lines) {
    if (!by[line.period_id]) by[line.period_id] = [];
    by[line.period_id].push(line);
  }
  return json({ periods: periods.map((row) => ({ ...row, lines: by[row.id] || [] })), statuses: PAYROLL_STATUSES }, 200, request);
}

async function createPayrollPeriod(request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  const start = vDate(body && body.start_date, { label: "the start date" });
  const end = vDate(body && body.end_date, { label: "the end date" });
  if (start.error || end.error) return json({ error: start.error || end.error }, 400, request);
  const profiles = await listBy(env, request, `SELECT u.id, u.is_sample, p.daily_rate, p.rate FROM users u LEFT JOIN staff_profiles p ON p.user_id = u.id WHERE u.role != 'owner' AND IFNULL(u.is_active,1)=1`);
  const attendance = await listBy(env, request, "SELECT staff_id, date FROM attendance WHERE date >= ? AND date <= ? AND time_in IS NOT NULL", [start.value, end.value]);
  const advances = await listBy(env, request, "SELECT user_id, SUM(amount) AS amount FROM cash_advances WHERE status = 'open' AND date <= ? GROUP BY user_id", [end.value]);
  const advMap = Object.fromEntries(advances.map((row) => [row.user_id, row.amount || 0]));
  const daysMap = {};
  for (const row of attendance) daysMap[row.staff_id] = (daysMap[row.staff_id] || 0) + 1;
  const id = randomId();
  const statements = [
    env.DB.prepare(
      `INSERT INTO payroll_periods (id, start_date, end_date, status, notes, created_at, created_by, is_sample)
       VALUES (?, ?, ?, 'draft', ?, ?, ?, 0)`
    ).bind(id, start.value, end.value, body.notes || "", isoNow(), user.id)
  ];
  for (const person of profiles) {
    const daysWorked = daysMap[person.id] || 0;
    const daily = person.daily_rate || person.rate || 0;
    const gross = Math.round(daysWorked * daily);
    const sss = Math.round(gross * 0.045);
    const philhealth = Math.round(gross * 0.025);
    const pagibig = Math.min(100, Math.round(gross * 0.02));
    const wtax = 0;
    const adv = advMap[person.id] || 0;
    const net = Math.max(gross - sss - philhealth - pagibig - wtax - adv, 0);
    statements.push(env.DB.prepare(
      `INSERT INTO payroll_lines (id, period_id, user_id, days_worked, hours_worked, gross, sss, philhealth, pagibig, wtax, advances, other_deductions, net, notes, is_sample, gross_cents, sss_cents, philhealth_cents, pagibig_cents, wtax_cents, advances_cents, net_cents)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, 0, ?, '', ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(randomId(), id, person.id, daysWorked, gross, sss, philhealth, pagibig, wtax, adv, net, person.is_sample || 0, centsFromPesos(gross), centsFromPesos(sss), centsFromPesos(philhealth), centsFromPesos(pagibig), centsFromPesos(wtax), centsFromPesos(adv), centsFromPesos(net)));
  }
  statements.push(auditStmt(env, user, "create", "payroll_periods", id, `${start.value} ${end.value}`, request));
  await env.DB.batch(statements);
  return json({ period: await env.DB.prepare("SELECT * FROM payroll_periods WHERE id = ?").bind(id).first() }, 201, request);
}

async function patchPayrollPeriod(id, request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const existing = await env.DB.prepare("SELECT * FROM payroll_periods WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Payroll period not found." }, 404, request);
  const body = await readJson(request);
  const status = vOneOf(String(body.status || existing.status), PAYROLL_STATUSES, "status");
  if (status.error) return json({ error: status.error }, 400, request);
  const statements = [
    env.DB.prepare("UPDATE payroll_periods SET status = ?, notes = ? WHERE id = ?").bind(status.value, body.notes !== undefined ? String(body.notes) : existing.notes, id)
  ];
  if (status.value === "paid" && existing.status !== "paid") {
    statements.push(env.DB.prepare("UPDATE cash_advances SET status = 'deducted' WHERE status = 'open' AND user_id IN (SELECT user_id FROM payroll_lines WHERE period_id = ? AND advances > 0)").bind(id));
  }
  statements.push(auditStmt(env, user, "update", "payroll_periods", id, status.value, request, existing.is_sample));
  await env.DB.batch(statements);
  return json({ period: await env.DB.prepare("SELECT * FROM payroll_periods WHERE id = ?").bind(id).first() }, 200, request);
}

async function listAdvances(env, request) {
  const rows = await listBy(env, request, `SELECT a.*, u.name AS staff_name FROM cash_advances a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.date DESC LIMIT 300`);
  return json({ advances: rows, statuses: ADVANCE_STATUSES }, 200, request);
}

async function createAdvance(request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  const amount = vInt(body && body.amount, { label: "the amount", min: 1, max: 1000000 });
  const date = vDate(body && body.date || todayISO(), { label: "the date" });
  const reason = vStr(body && body.reason, { label: "the reason", required: false, max: 400 });
  if (amount.error || date.error || reason.error) return json({ error: amount.error || date.error || reason.error }, 400, request);
  if (!body.user_id) return json({ error: "Please pick a staff member." }, 400, request);
  const id = randomId();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO cash_advances (id, user_id, date, amount, reason, status, created_at, created_by, is_sample, amount_cents)
       VALUES (?, ?, ?, ?, ?, 'open', ?, ?, 0, ?)`
    ).bind(id, body.user_id, date.value, amount.value, reason.value, isoNow(), user.id, centsFromPesos(amount.value)),
    auditStmt(env, user, "create", "cash_advances", id, String(amount.value), request)
  ]);
  return json({ advance: await env.DB.prepare("SELECT * FROM cash_advances WHERE id = ?").bind(id).first() }, 201, request);
}

async function patchAdvance(id, request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const existing = await env.DB.prepare("SELECT * FROM cash_advances WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Advance not found." }, 404, request);
  const body = await readJson(request);
  const status = vOneOf(String(body.status || existing.status), ADVANCE_STATUSES, "status");
  if (status.error) return json({ error: status.error }, 400, request);
  await env.DB.batch([
    env.DB.prepare("UPDATE cash_advances SET status = ? WHERE id = ?").bind(status.value, id),
    auditStmt(env, user, "update", "cash_advances", id, status.value, request, existing.is_sample)
  ]);
  return json({ advance: await env.DB.prepare("SELECT * FROM cash_advances WHERE id = ?").bind(id).first() }, 200, request);
}

async function listLeave(env, request, user) {
  const clauses = [];
  const params = [];
  if (user.role === "staff") { clauses.push("l.user_id = ?"); params.push(user.id); }
  let sql = `SELECT l.*, u.name AS staff_name FROM leave_requests l LEFT JOIN users u ON u.id = l.user_id`;
  if (clauses.length) sql += ` WHERE ${clauses.join(" AND ")}`;
  sql += " ORDER BY l.start_date DESC LIMIT 300";
  return json({ requests: await listBy(env, request, sql, params), kinds: LEAVE_KINDS, statuses: LEAVE_STATUSES }, 200, request);
}

async function createLeave(request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  const staffId = user.role === "staff" ? user.id : (body.user_id || user.id);
  const kind = vOneOf(String(body && body.kind || "vacation"), LEAVE_KINDS, "leave type");
  const start = vDate(body && body.start_date, { label: "the start date" });
  const end = vDate(body && body.end_date || (body && body.start_date), { label: "the end date" });
  const reason = vStr(body && body.reason, { label: "the reason", required: false, max: 400 });
  if (kind.error || start.error || end.error || reason.error) return json({ error: kind.error || start.error || end.error || reason.error }, 400, request);
  const days = Math.max(1, Math.round((new Date(`${end.value}T00:00:00+08:00`) - new Date(`${start.value}T00:00:00+08:00`)) / 86400000) + 1);
  const id = randomId();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO leave_requests (id, user_id, kind, start_date, end_date, days, reason, status, created_at, is_sample)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, 0)`
    ).bind(id, staffId, kind.value, start.value, end.value, days, reason.value, isoNow()),
    auditStmt(env, user, "create", "leave_requests", id, kind.value, request)
  ]);
  return json({ request: await env.DB.prepare("SELECT * FROM leave_requests WHERE id = ?").bind(id).first() }, 201, request);
}

async function patchLeave(id, request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const existing = await env.DB.prepare("SELECT * FROM leave_requests WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Leave request not found." }, 404, request);
  const body = await readJson(request);
  if (user.role === "staff") {
    if (existing.user_id !== user.id) return deny(request);
    if (String(body.status) !== "cancelled") return json({ error: "You can only cancel your own leave request." }, 400, request);
  }
  const status = vOneOf(String(body.status || existing.status), LEAVE_STATUSES, "status");
  if (status.error) return json({ error: status.error }, 400, request);
  await env.DB.batch([
    env.DB.prepare("UPDATE leave_requests SET status = ?, decided_by = ?, decided_at = ? WHERE id = ?").bind(status.value, user.id, isoNow(), id),
    auditStmt(env, user, "update", "leave_requests", id, status.value, request, existing.is_sample)
  ]);
  return json({ request: await env.DB.prepare("SELECT * FROM leave_requests WHERE id = ?").bind(id).first() }, 200, request);
}

async function reportSummary(env, request, user) {
  const { from, to, range } = periodParams(request);
  const events = await listBy(env, request, "SELECT * FROM events WHERE date >= ? AND date <= ? ORDER BY date", [from, to]);
  const payments = user.role === "owner" ? await listBy(env, request, "SELECT * FROM payments WHERE voided_at IS NULL AND received_at >= ? AND received_at <= ?", [from, to]) : [];
  const expenses = user.role === "owner" ? await listBy(env, request, "SELECT * FROM expenses WHERE voided_at IS NULL AND date >= ? AND date <= ?", [from, to]) : [];
  const attendance = await listBy(env, request, "SELECT * FROM attendance WHERE date >= ? AND date <= ?", [from, to]);
  const realEv = events.filter((row) => !row.is_sample);
  const income = payments.filter((p) => !p.is_sample).reduce((s, p) => s + (p.kind === "refund" ? -p.amount : p.amount || 0), 0);
  const expense = expenses.filter((p) => !p.is_sample).reduce((s, p) => s + (p.amount || 0), 0);
  return json({
    from, to, range,
    events: realEv.length,
    sampleEvents: events.length - realEv.length,
    income: user.role === "owner" ? income : null,
    expenses: user.role === "owner" ? expense : null,
    net: user.role === "owner" ? income - expense : null,
    attendance: attendance.filter((row) => !row.is_sample).length,
    eventList: isOwner(user) ? events : events.map((row) => { const { fee, deposit, contract_total, ...rest } = row; return rest; })
  }, 200, request);
}

