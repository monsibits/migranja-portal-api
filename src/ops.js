/**
 * Operations modules: dashboard, sales, event sheets, housekeeping,
 * inventory, accounting, HR, and expanded reports.
 * Imported by src/index.js. A plain wrangler deploy includes these routes.
 */
import {
  allow,
  audit,
  auditStmt,
  dateVenueTaken,
  deny,
  eventColumns,
  eventsFromSql,
  isoNow,
  json,
  originAllowed,
  randomId,
  readJson,
  todayISO,
  vDate,
  vInt,
  vOneOf,
  vStr
} from "./index.js";


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

function requireBody(body, request) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "Please send the details as JSON." }, 400, request);
  }
  return null;
}

function clipText(value, max = 2000) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function actorSample(user, parent) {
  if (parent && (parent.is_sample === 1 || parent.is_sample === true)) return 1;
  if (user && (user.is_sample === 1 || user.is_sample === true)) return 1;
  return 0;
}

function withoutUnitCost(row) {
  if (!row) return row;
  const out = { ...row };
  delete out.unit_cost;
  delete out.unit_cost_cents;
  return out;
}

function presentItem(row, user) {
  return isOwner(user) ? row : withoutUnitCost(row);
}

async function mustRow(env, sql, id, label) {
  if (!id) return { error: `Please pick ${label}.` };
  const row = await env.DB.prepare(sql).bind(id).first();
  if (!row) {
    const name = String(label || "record").replace(/^(an?|the)\s+/i, "");
    const titled = name.charAt(0).toUpperCase() + name.slice(1);
    return { error: `${titled} not found.` };
  }
  return { row };
}

async function mustEvent(env, id) {
  return mustRow(env, "SELECT id, is_sample FROM events WHERE id = ?", id, "an event");
}

async function mustActiveStaff(env, id) {
  const found = await mustRow(env, "SELECT id, is_active, is_sample, role FROM users WHERE id = ?", id, "a staff member");
  if (found.error) return found;
  if (found.row.is_active === 0) return { error: "That staff member is no longer active." };
  return found;
}

async function mustArea(env, id) {
  return mustRow(env, "SELECT id, is_sample FROM areas WHERE id = ?", id, "an area");
}

async function mustItem(env, id) {
  return mustRow(env, "SELECT id, is_sample, qty_on_hand FROM inventory_items WHERE id = ?", id, "an item");
}

async function mustTemplate(env, id) {
  return mustRow(env, "SELECT id, is_sample FROM hk_templates WHERE id = ?", id, "a template");
}

async function mustVenue(env, id) {
  return mustRow(env, "SELECT id, is_sample FROM venues WHERE id = ?", id, "a venue");
}

function applyOpenAdvances(openList, remaining) {
  const appliedIds = [];
  let applied = 0;
  let left = Math.max(0, Number(remaining) || 0);
  for (const adv of openList || []) {
    const amt = Number(adv.amount) || 0;
    if (amt <= 0) continue;
    if (amt <= left) {
      applied += amt;
      left -= amt;
      appliedIds.push(adv.id);
    } else {
      break;
    }
  }
  return { applied, appliedIds };
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

export async function handleOps(request, env, url, user) {
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
      if (path === "/api/hr/leave" && user.role === "staff") {
        return entry.list(env, request, user);
      }
      if (!allow(user, entry.res, "read")) return deny(request);
      if (path === "/api/payments" && !isOwner(user)) return denyMoney(request);
      return entry.list(env, request, user);
    }
    if (method === "POST" && entry.create) {
      // Staff may post issue/return; createMove enforces kind.
      if (path === "/api/inventory/moves") {
        if (!allow(user, "inventory", "read")) return deny(request);
        return entry.create(request, env, user);
      }
      if (path === "/api/hr/leave" && user.role === "staff") {
        return entry.create(request, env, user);
      }
      if (!allow(user, entry.res, "write")) return deny(request);
      if (["/api/areas", "/api/hk/templates"].includes(path) && user.role === "staff") {
        return deny(request);
      }
      if (["/api/payments", "/api/quotes", "/api/contracts", "/api/packages"].includes(path) && !isOwner(user)) {
        return denyMoney(request);
      }
      return entry.create(request, env, user);
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
    if (parts[1] === "hk" && parts[2] === "templates" && parts.length === 4) {
      if (!allow(user, "housekeeping", "write")) return deny(request);
      if (user.role === "staff") return deny(request);
      return patchHkTemplate(parts[3], request, env, user);
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

async function nextSerial(env, key, sample = 0) {
  const spec = SERIAL_SPECS[key];
  if (!spec) throw new Error("Unknown serial");
  const prefix = sample ? `${spec.prefix}-S` : spec.prefix;
  const like = `${prefix}-%`;
  const sql = spec.table === "quotes" && spec.column === "number"
    ? (sample
      ? "SELECT number AS n FROM quotes WHERE number LIKE ? ORDER BY LENGTH(number) DESC, number DESC LIMIT 1"
      : "SELECT number AS n FROM quotes WHERE number LIKE ? AND number NOT LIKE 'MG-Q-S-%' ORDER BY LENGTH(number) DESC, number DESC LIMIT 1")
    : spec.table === "contracts" && spec.column === "number"
      ? (sample
        ? "SELECT number AS n FROM contracts WHERE number LIKE ? ORDER BY LENGTH(number) DESC, number DESC LIMIT 1"
        : "SELECT number AS n FROM contracts WHERE number LIKE ? AND number NOT LIKE 'MG-C-S-%' ORDER BY LENGTH(number) DESC, number DESC LIMIT 1")
      : spec.table === "payments" && spec.column === "receipt_no"
        ? (sample
          ? "SELECT receipt_no AS n FROM payments WHERE receipt_no LIKE ? ORDER BY LENGTH(receipt_no) DESC, receipt_no DESC LIMIT 1"
          : "SELECT receipt_no AS n FROM payments WHERE receipt_no LIKE ? AND receipt_no NOT LIKE 'MG-OR-S-%' ORDER BY LENGTH(receipt_no) DESC, receipt_no DESC LIMIT 1")
        : spec.table === "expenses" && spec.column === "receipt_no"
          ? (sample
            ? "SELECT receipt_no AS n FROM expenses WHERE receipt_no LIKE ? ORDER BY LENGTH(receipt_no) DESC, receipt_no DESC LIMIT 1"
            : "SELECT receipt_no AS n FROM expenses WHERE receipt_no LIKE ? AND receipt_no NOT LIKE 'MG-EX-S-%' ORDER BY LENGTH(receipt_no) DESC, receipt_no DESC LIMIT 1")
          : spec.table === "pos" || (spec.table === "purchase_orders" && spec.column === "number")
            ? (sample
              ? "SELECT number AS n FROM purchase_orders WHERE number LIKE ? ORDER BY LENGTH(number) DESC, number DESC LIMIT 1"
              : "SELECT number AS n FROM purchase_orders WHERE number LIKE ? AND number NOT LIKE 'MG-PO-S-%' ORDER BY LENGTH(number) DESC, number DESC LIMIT 1")
            : null;
  if (!sql) throw new Error("Unknown serial");
  const row = await env.DB.prepare(sql).bind(like).first();
  const current = row && row.n ? Number(String(row.n).split("-").pop()) : 0;
  const next = (Number.isFinite(current) ? current : 0) + 1;
  return `${prefix}-${String(next).padStart(4, "0")}`;
}

function isUniqueConstraintError(err) {
  return /UNIQUE constraint failed/i.test(String(err && err.message ? err.message : err || ""));
}

async function runWithSerialRetry(env, key, sample, request, work) {
  let last = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const number = await nextSerial(env, key, sample);
    try {
      return await work(number);
    } catch (err) {
      last = err;
      if (!isUniqueConstraintError(err)) throw err;
    }
  }
  return json({ error: "That document number is already in use. Please try again." }, 409, request);
}

function hoursBetween(timeIn, timeOut) {
  if (!timeIn || !timeOut) return 0;
  const [ih, im] = String(timeIn).split(":").map(Number);
  const [oh, om] = String(timeOut).split(":").map(Number);
  if (![ih, im, oh, om].every(Number.isFinite)) return 0;
  const start = ih * 60 + im;
  const end = oh * 60 + om;
  if (end <= start) return 0;
  return (end - start) / 60;
}

function parseItemLabels(raw) {
  if (raw == null || raw === "") return { labels: [] };
  if (!Array.isArray(raw)) return { error: "Please send the checklist items as a list." };
  if (raw.length > 100) return { error: "Please keep the checklist to 100 items or fewer." };
  const labels = [];
  for (const item of raw) {
    if (item == null) return { error: "Each checklist item needs a label." };
    if (typeof item === "string") {
      const text = item.trim();
      if (text) labels.push(text.slice(0, 200));
      continue;
    }
    if (typeof item === "object" && item.label != null) {
      const text = String(item.label).trim();
      if (text) labels.push(text.slice(0, 200));
      continue;
    }
    return { error: "Each checklist item needs a label." };
  }
  return { labels };
}

async function dashboard(env, request, user) {
  const today = todayISO();
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const { from, to, days } = monthRange(year, month);
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
    const n = year * 12 + (month - 1) - i;
    const y = Math.floor(n / 12);
    const m = (n % 12) + 1;
    months.push(`${y}-${String(m).padStart(2, "0")}`);
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
    lowStock: stock.filter((row) => Number(row.qty_on_hand || 0) <= Number(row.reorder_level || 0)).slice(0, 8).map((row) => presentItem(row, user))
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
  const missing = requireBody(body, request);
  if (missing) return missing;
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
  const sample = actorSample(user);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO clients (id, name, contact, email, company, notes, created_at, created_by, is_sample)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, name.value, contact.value, email.value, company.value, notes.value, now, user.id, sample),
    auditStmt(env, user, "create", "clients", id, name.value, request, sample)
  ]);
  const client = await env.DB.prepare("SELECT * FROM clients WHERE id = ?").bind(id).first();
  return json({ client }, 201, request);
}

async function patchClient(id, request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  const missing = requireBody(body, request);
  if (missing) return missing;
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
  const missing = requireBody(body, request);
  if (missing) return missing;
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
  const sample = actorSample(user);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO packages (id, name, venue, description, base_fee, included_pax, extra_pax_price, hours, inclusions, is_active, is_sample, created_at, created_by, base_fee_cents, extra_pax_price_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`
    ).bind(id, name.value, venue.value, description.value, base.value, pax.value, extra.value, hours.value, inclusions.value, sample, isoNow(), user.id, centsFromPesos(base.value), centsFromPesos(extra.value)),
    auditStmt(env, user, "create", "packages", id, name.value, request, sample)
  ]);
  return json({ package: await env.DB.prepare("SELECT * FROM packages WHERE id = ?").bind(id).first() }, 201, request);
}

async function patchPackage(id, request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  const missing = requireBody(body, request);
  if (missing) return missing;
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
  const missing = requireBody(body, request);
  if (missing) return missing;
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
  let clientId = body.client_id || null;
  let assignedTo = body.assigned_to || null;
  if (clientId) {
    const client = await env.DB.prepare("SELECT id FROM clients WHERE id = ?").bind(clientId).first();
    if (!client) return json({ error: "Please pick a valid client." }, 400, request);
  }
  if (assignedTo) {
    const person = await env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(assignedTo).first();
    if (!person) return json({ error: "Please pick a valid assignee." }, 400, request);
  }
  const id = randomId();
  const sample = actorSample(user);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO leads (id, name, contact, source, status, notes, request_id, client_id, assigned_to, event_date, venue, pax, type, created_at, created_by, is_sample)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, name.value, contact.value, source.value, status.value, notes.value, body.request_id || null, clientId, assignedTo, eventDate.value || null, venue.value, pax.value, type.value, isoNow(), user.id, sample),
    auditStmt(env, user, "create", "leads", id, name.value, request, sample)
  ]);
  return json({ lead: await env.DB.prepare("SELECT * FROM leads WHERE id = ?").bind(id).first() }, 201, request);
}

async function patchLead(id, request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  const missing = requireBody(body, request);
  if (missing) return missing;
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
  if (body.notes !== undefined) {
    const notes = vStr(body.notes, { label: "notes", required: false, max: 2000 });
    if (notes.error) return json({ error: notes.error }, 400, request);
    fields.notes = notes.value;
  }
  if (body.venue !== undefined) fields.venue = String(body.venue || "").trim();
  if (body.type !== undefined) fields.type = String(body.type || "").trim();
  if (body.event_date !== undefined) fields.event_date = body.event_date || null;
  if (body.pax !== undefined) fields.pax = body.pax === "" || body.pax === null ? null : Number(body.pax);
  if (body.client_id !== undefined) {
    if (!body.client_id) fields.client_id = null;
    else {
      const client = await env.DB.prepare("SELECT id FROM clients WHERE id = ?").bind(body.client_id).first();
      if (!client) return json({ error: "Please pick a valid client." }, 400, request);
      fields.client_id = body.client_id;
    }
  }
  if (body.assigned_to !== undefined) {
    if (!body.assigned_to) fields.assigned_to = null;
    else {
      const person = await env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(body.assigned_to).first();
      if (!person) return json({ error: "Please pick a valid assignee." }, 400, request);
      fields.assigned_to = body.assigned_to;
    }
  }
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
  const normalized = [];
  for (const line of lines || []) {
    const qty = Number(line.qty);
    const unit = Number(line.unit_price);
    if (!Number.isFinite(qty) || qty < 0 || !Number.isFinite(unit) || unit < 0) {
      return { error: "Line amounts must be zero or more." };
    }
    const amount = Math.round((qty * unit + Number.EPSILON) * 100) / 100;
    normalized.push({
      label: String(line.label || "Item").slice(0, 200),
      qty,
      unit_price: unit,
      amount,
      item_id: line.item_id || null
    });
  }
  const subtotal = normalized.reduce((sum, line) => sum + line.amount, 0);
  const off = Number(discount) || 0;
  if (!Number.isFinite(off) || off < 0) return { error: "The discount must be zero or more." };
  return { subtotal, discount: off, total: Math.max(subtotal - off, 0), lines: normalized };
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
  if (totals.error) return { error: totals.error };
  const now = isoNow();
  const statements = [
    env.DB.prepare(
      `INSERT INTO quotes (id, number, lead_id, request_id, event_id, client_id, client_name, contact, event_date, venue, package_id, items, subtotal, discount, total, status, valid_until, notes, created_at, created_by, is_sample, subtotal_cents, discount_cents, total_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, number, payload.lead_id || null, payload.request_id || null, payload.event_id || null, payload.client_id || null,
      payload.client_name, payload.contact || "", payload.event_date || null, payload.venue || "", payload.package_id || null,
      JSON.stringify(totals.lines || payload.lines || []), totals.subtotal, totals.discount, totals.total, payload.status, payload.valid_until || null,
      payload.notes || "", now, user.id, payload.is_sample ? 1 : actorSample(user), centsFromPesos(totals.subtotal), centsFromPesos(totals.discount), centsFromPesos(totals.total)
    )
  ];
  (totals.lines || payload.lines || []).forEach((line, index) => {
    const qty = Number(line.qty) || 0;
    const unit = Number(line.unit_price) || 0;
    statements.push(env.DB.prepare(
      `INSERT INTO quote_lines (id, quote_id, label, qty, unit_price, amount, sort_order, is_sample, unit_price_cents, amount_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(randomId(), id, String(line.label || "Item").slice(0, 200), qty, unit, qty * unit, index, payload.is_sample ? 1 : actorSample(user), centsFromPesos(unit), centsFromPesos(qty * unit)));
  });
  statements.push(auditStmt(env, user, "create", "quotes", id, number, request, payload.is_sample ? 1 : actorSample(user)));
  return { id, statements, totals };
}

async function createQuote(request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  const missing = requireBody(body, request);
  if (missing) return missing;
  const clientName = vStr(body && body.client_name, { label: "the client name", max: 120 });
  const status = vOneOf(String(body && body.status || "draft"), QUOTE_STATUSES, "quote status");
  const discount = vInt(body && body.discount, { label: "the discount", min: 0, max: 100000000, required: false });
  const notes = vStr(body && body.notes, { label: "notes", required: false, max: 2000 });
  const valid = vDate(body && body.valid_until, { label: "the valid-until date", required: false });
  const eventDate = vDate(body && body.event_date, { label: "the event date", required: false });
  for (const field of [clientName, status, discount, notes, valid, eventDate]) {
    if (field.error) return json({ error: field.error }, 400, request);
  }
  let lines = Array.isArray(body.lines) && body.lines.length
    ? body.lines
    : body.package_id
      ? [{ label: "Package", qty: 1, unit_price: Number(body.base_fee || 0) }]
      : [];
  if (!lines.length) return json({ error: "Please add at least one line to the quote." }, 400, request);
  const checked = quoteTotals(lines, discount.value || 0);
  if (checked.error) return json({ error: checked.error }, 400, request);
  lines = checked.lines;
  let sample = actorSample(user);
  if (body.lead_id) {
    const lead = await env.DB.prepare("SELECT is_sample FROM leads WHERE id = ?").bind(body.lead_id).first();
    if (lead) sample = actorSample(user, lead);
  }
  if (body.client_id) {
    const client = await env.DB.prepare("SELECT is_sample FROM clients WHERE id = ?").bind(body.client_id).first();
    if (client) sample = actorSample(user, client);
  }
  return runWithSerialRetry(env, "quotes", sample, request, async (number) => {
  const built = await insertQuoteStatements(env, user, request, {
    number,
    is_sample: sample,
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
  if (built.error) return json({ error: built.error }, 400, request);
  await env.DB.batch(built.statements);
  if (body.lead_id && status.value !== "draft") {
    await env.DB.prepare("UPDATE leads SET status = CASE WHEN status IN ('won','lost') THEN status ELSE 'quoted' END, updated_at = ? WHERE id = ?").bind(isoNow(), body.lead_id).run();
  }
  const quote = await env.DB.prepare("SELECT * FROM quotes WHERE id = ?").bind(built.id).first();
  const quoteLines = await listBy(env, request, "SELECT * FROM quote_lines WHERE quote_id = ? ORDER BY sort_order", [built.id]);
  return json({ quote: { ...quote, lines: quoteLines } }, 201, request);
  });
}

async function patchQuote(id, request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  const missing = requireBody(body, request);
  if (missing) return missing;
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
    if (totals.error) return json({ error: totals.error }, 400, request);
    fields.items = JSON.stringify(totals.lines);
    fields.subtotal = totals.subtotal;
    fields.discount = totals.discount;
    fields.total = totals.total;
    body.lines = totals.lines;
  } else if (body.discount !== undefined) {
    const totals = quoteTotals(JSON.parse(existing.items || "[]"), body.discount);
    if (totals.error) return json({ error: totals.error }, 400, request);
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
  const taken = await dateVenueTaken(env, date, venue, quote.event_id, quote.is_sample);
  if (taken && !quote.event_id) return json({ error: "That date and venue are already held by another event." }, 409, request);
  const now = isoNow();
  const eventId = quote.event_id || randomId();
  const contractId = randomId();
  const sample = actorSample(user, quote);
  const terms = "Fifty percent reservation, balance due seven days before the event.";
  return runWithSerialRetry(env, "contracts", sample, request, async (contractNo) => {
  const statements = [];
  if (!quote.event_id) {
    statements.push(env.DB.prepare(
      `INSERT INTO events (id, date, client, title, type, package, pax, venue, status, fee, deposit, contract_total, quote_id, client_id, package_id, created_at, created_by, is_sample)
       SELECT ?, q.event_date, q.client_name,
              CASE WHEN IFNULL(q.venue, '') != '' AND q.venue != 'Any' THEN q.client_name || ' event' ELSE 'Booked event' END,
              'Other', NULL, NULL, CASE WHEN IFNULL(q.venue, '') != '' THEN q.venue ELSE 'Any' END,
              'Confirmed', q.total, 0, q.total, q.id, q.client_id, q.package_id, ?, ?, q.is_sample
       FROM quotes q
       WHERE q.id = ? AND q.status != 'accepted' AND IFNULL(q.event_id, '') = ''
         AND NOT EXISTS (SELECT 1 FROM events e WHERE e.id = ? OR e.quote_id = q.id)
         AND NOT EXISTS (
           SELECT 1 FROM events e
           WHERE e.date = q.event_date
             AND e.status IN ('Confirmed', 'Tentative', 'Setup', 'Booked')
             AND IFNULL(e.is_sample, 0) = IFNULL(q.is_sample, 0)
             AND e.id != ?
             AND (
               CASE
                 WHEN IFNULL(q.venue, '') IN ('', 'Any') THEN 1
                 WHEN e.venue = q.venue OR e.venue = 'Any' THEN 1
                 ELSE 0
               END
             ) = 1
         )`
    ).bind(eventId, now, user.id, id, eventId, eventId));
    statements.push(env.DB.prepare(
      "UPDATE quotes SET status = 'accepted', event_id = ?, updated_at = ? WHERE id = ? AND status != 'accepted' AND EXISTS (SELECT 1 FROM events e WHERE e.id = ? AND e.quote_id = quotes.id)"
    ).bind(eventId, now, id, eventId));
  } else {
    statements.push(env.DB.prepare("UPDATE events SET quote_id = ?, contract_total = ?, fee = IFNULL(fee, ?), updated_at = ? WHERE id = ?").bind(id, quote.total, quote.total, now, eventId));
    statements.push(env.DB.prepare("UPDATE quotes SET status = 'accepted', event_id = ?, updated_at = ? WHERE id = ? AND status != 'accepted'").bind(eventId, now, id));
  }
  statements.push(env.DB.prepare(
    `INSERT INTO contracts (id, number, quote_id, event_id, client_id, client_name, event_date, venue, total, deposit_due, terms, status, created_at, created_by, is_sample, total_cents, deposit_due_cents)
     SELECT ?, ?, q.id, q.event_id, q.client_id, q.client_name, q.event_date,
            CASE WHEN IFNULL(q.venue, '') != '' THEN q.venue ELSE 'Any' END,
            q.total, CAST(ROUND(IFNULL(q.total, 0) * 0.5) AS INTEGER), ?, 'draft', ?, ?, q.is_sample,
            CAST(ROUND(IFNULL(q.total, 0) * 100) AS INTEGER), CAST(ROUND(IFNULL(q.total, 0) * 50) AS INTEGER)
     FROM quotes q
     WHERE q.id = ? AND q.status = 'accepted' AND q.event_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM contracts c WHERE c.quote_id = q.id)`
  ).bind(contractId, contractNo, terms, now, user.id, id));
  const results = await env.DB.batch(statements);
  const quoteChanges = results[1] && results[1].meta && results[1].meta.changes;
  if (quoteChanges !== 1) {
    return json({ error: "This quote could not be accepted. The date may already be held, or it was just accepted." }, 409, request);
  }
  const follow = [];
  if (quote.lead_id) {
    follow.push(env.DB.prepare("UPDATE leads SET status = 'won', updated_at = ? WHERE id = ?").bind(now, quote.lead_id));
  }
  follow.push(auditStmt(env, user, "accept", "quotes", id, `Event ${eventId} contract ${contractNo}`, request, quote.is_sample));
  await env.DB.batch(follow);
  const accepted = await env.DB.prepare("SELECT * FROM quotes WHERE id = ?").bind(id).first();
  return json({ ok: true, eventId: accepted.event_id || eventId, contractId, quote: accepted }, 200, request);
  });
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
  const missing = requireBody(body, request);
  if (missing) return missing;
  const clientName = vStr(body && body.client_name, { label: "the client name", max: 120 });
  const total = vInt(body && body.total, { label: "the contract total", min: 0, max: 100000000 });
  const depositDue = vInt(body && body.deposit_due, { label: "the reservation amount", min: 0, max: 100000000, required: false });
  const eventDate = vDate(body && body.event_date, { label: "the event date", required: false });
  const status = vOneOf(String(body && body.status || "draft"), CONTRACT_STATUSES, "contract status");
  for (const field of [clientName, total, depositDue, eventDate, status]) {
    if (field.error) return json({ error: field.error }, 400, request);
  }
  const id = randomId();
  const sample = actorSample(user);
  return runWithSerialRetry(env, "contracts", sample, request, async (number) => {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO contracts (id, number, quote_id, event_id, client_id, client_name, event_date, venue, total, deposit_due, terms, status, created_at, created_by, is_sample, total_cents, deposit_due_cents)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, number, body.quote_id || null, body.event_id || null, body.client_id || null, clientName.value, eventDate.value || null, body.venue || "", total.value, depositDue.value || Math.round((total.value || 0) * 0.5), body.terms || "", status.value, isoNow(), user.id, sample, centsFromPesos(total.value), centsFromPesos(depositDue.value || Math.round((total.value || 0) * 0.5))),
      auditStmt(env, user, "create", "contracts", id, number, request, sample)
    ]);
    return json({ contract: await env.DB.prepare("SELECT * FROM contracts WHERE id = ?").bind(id).first() }, 201, request);
  });
}

async function patchContract(id, request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  const missing = requireBody(body, request);
  if (missing) return missing;
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
  const missing = requireBody(body, request);
  if (missing) return missing;
  const amount = vInt(body && body.amount, { label: "the amount", min: 1, max: 100000000 });
  const kind = vOneOf(String(body && body.kind || "downpayment"), PAYMENT_KINDS, "payment kind");
  const method = vOneOf(String(body && body.method || "cash").trim().toLowerCase(), PAYMENT_METHODS, "payment method");
  const received = vDate(body && body.received_at || todayISO(), { label: "the date received" });
  const notes = vStr(body && body.notes, { label: "notes", required: false, max: 1000 });
  for (const field of [amount, kind, method, received, notes]) {
    if (field.error) return json({ error: field.error }, 400, request);
  }
  const id = randomId();
  const sample = actorSample(user);
  const assigned = body.receipt_no || body.or_number;
  const writePayment = async (receipt) => {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO payments (id, receipt_no, or_number, event_id, quote_id, contract_id, client_name, kind, amount, method, received_at, notes, created_at, created_by, is_sample, amount_cents)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, receipt, receipt, body.event_id || null, body.quote_id || null, body.contract_id || null, body.client_name || "", kind.value, amount.value, method.value, received.value, notes.value, isoNow(), user.id, sample, centsFromPesos(amount.value)),
      auditStmt(env, user, "create", "payments", id, `${receipt} ${amount.value}`, request, sample)
    ]);
    return json({ payment: await env.DB.prepare("SELECT * FROM payments WHERE id = ?").bind(id).first() }, 201, request);
  };
  if (assigned) {
    try {
      return await writePayment(assigned);
    } catch (err) {
      if (isUniqueConstraintError(err)) return json({ error: "That document number is already in use. Please try again." }, 409, request);
      throw err;
    }
  }
  return runWithSerialRetry(env, "payments", sample, request, writePayment);
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
  const event = await env.DB.prepare(`${eventsFromSql(user.role)} WHERE e.id = ?`).bind(id).first();
  if (!event) return json({ error: "Event not found." }, 404, request);
  const details = await env.DB.prepare("SELECT * FROM event_details WHERE event_id = ?").bind(id).first();
  const shifts = await listBy(env, request, `SELECT shifts.*, u.name AS staff_name FROM shifts LEFT JOIN users u ON u.id = shifts.staff_id WHERE shifts.event_id = ? ORDER BY shifts.start`, [id]);
  const allocations = await listBy(env, request, `SELECT a.*, i.name AS item_name, i.unit FROM event_item_allocations a LEFT JOIN inventory_items i ON i.id = a.item_id WHERE a.event_id = ?`, [id]);
  const jobs = await listBy(env, request, `SELECT c.*, u.name AS assigned_name, ar.name AS area_name FROM checklists c LEFT JOIN users u ON u.id = c.assigned_to LEFT JOIN areas ar ON ar.id = c.area_id WHERE c.event_id = ?`, [id]);
  let balance = null;
  if (isOwner(user)) {
    balance = await env.DB.prepare("SELECT * FROM v_event_balance WHERE event_id = ?").bind(id).first();
  }
  return json({ event, details: details || { event_id: id }, shifts, allocations, jobs, balance }, 200, request);
}

async function saveEventSheet(env, request, user, id) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const existing = await env.DB.prepare("SELECT * FROM events WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Event not found." }, 404, request);
  const body = await readJson(request);
  const missing = requireBody(body, request);
  if (missing) return missing;
  if (body.coordinator_id) {
    const coord = await mustActiveStaff(env, body.coordinator_id);
    if (coord.error) return json({ error: coord.error }, 400, request);
  }
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
  if (user.role === "staff") return deny(request);
  const body = await readJson(request);
  const missing = requireBody(body, request);
  if (missing) return missing;
  const name = vStr(body && body.name, { label: "the area name", max: 120 });
  const kind = vStr(body && body.kind, { label: "the area kind", required: false, max: 80 });
  const notes = vStr(body && body.notes, { label: "notes", required: false, max: 2000 });
  if (name.error || kind.error || notes.error) return json({ error: name.error || kind.error || notes.error }, 400, request);
  if (body.venue_id) {
    const venue = await mustVenue(env, body.venue_id);
    if (venue.error) return json({ error: venue.error }, 400, request);
  }
  const id = randomId();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO areas (id, name, kind, notes, venue_id, is_sample) VALUES (?, ?, ?, ?, ?, ?)").bind(id, name.value, kind.value || "", notes.value || "", body.venue_id || null, actorSample(user)),
    auditStmt(env, user, "create", "areas", id, name.value, request, actorSample(user))
  ]);
  return json({ area: await env.DB.prepare("SELECT * FROM areas WHERE id = ?").bind(id).first() }, 201, request);
}

async function patchArea(id, request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  if (user.role === "staff") return deny(request);
  const body = await readJson(request);
  const missing = requireBody(body, request);
  if (missing) return missing;
  const existing = await env.DB.prepare("SELECT * FROM areas WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Area not found." }, 404, request);
  const fields = {};
  if (body.name !== undefined) {
    const name = vStr(body.name, { label: "the area name", max: 120 });
    if (name.error) return json({ error: name.error }, 400, request);
    fields.name = name.value;
  }
  if (body.kind !== undefined) {
    const kind = vStr(body.kind, { label: "the area kind", required: false, max: 80 });
    if (kind.error) return json({ error: kind.error }, 400, request);
    fields.kind = kind.value || "";
  }
  if (body.notes !== undefined) {
    const notes = vStr(body.notes, { label: "notes", required: false, max: 2000 });
    if (notes.error) return json({ error: notes.error }, 400, request);
    fields.notes = notes.value || "";
  }
  if (body.venue_id !== undefined) {
    if (body.venue_id) {
      const venue = await mustVenue(env, body.venue_id);
      if (venue.error) return json({ error: venue.error }, 400, request);
    }
    fields.venue_id = body.venue_id || null;
  }
  const keys = Object.keys(fields);
  if (!keys.length) return json({ area: existing }, 200, request);
  await env.DB.batch([
    env.DB.prepare(`UPDATE areas SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`).bind(...keys.map((k) => fields[k]), id),
    auditStmt(env, user, "update", "areas", id, JSON.stringify(fields), request, existing.is_sample)
  ]);
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
  if (user.role === "staff") return deny(request);
  const body = await readJson(request);
  const missing = requireBody(body, request);
  if (missing) return missing;
  const name = vStr(body && body.name, { label: "the template name", max: 160 });
  const kind = vOneOf(String(body && body.kind || "pre"), HK_KINDS, "job kind");
  if (name.error || kind.error) return json({ error: (name.error || kind.error) }, 400, request);
  if (body.area_id) {
    const area = await mustArea(env, body.area_id);
    if (area.error) return json({ error: area.error }, 400, request);
  }
  const id = randomId();
  const sample = actorSample(user);
  const statements = [
    env.DB.prepare("INSERT INTO hk_templates (id, name, kind, area_id, is_sample, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(id, name.value, kind.value, body.area_id || null, sample, isoNow())
  ];
  if (body.items != null && body.items !== "") {
    const parsed = parseItemLabels(body.items);
    if (parsed.error) return json({ error: parsed.error }, 400, request);
    parsed.labels.forEach((text, index) => {
      statements.push(env.DB.prepare("INSERT INTO hk_template_items (id, template_id, label, sort_order, is_sample) VALUES (?, ?, ?, ?, ?)").bind(randomId(), id, text, index, sample));
    });
  }
  statements.push(auditStmt(env, user, "create", "hk_templates", id, name.value, request, sample));
  await env.DB.batch(statements);
  return json({ template: await env.DB.prepare("SELECT * FROM hk_templates WHERE id = ?").bind(id).first() }, 201, request);
}


async function patchHkTemplate(id, request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  if (user.role === "staff") return deny(request);
  const body = await readJson(request);
  const missing = requireBody(body, request);
  if (missing) return missing;
  const existing = await env.DB.prepare("SELECT * FROM hk_templates WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Template not found." }, 404, request);
  const fields = {};
  if (body.name !== undefined) {
    const name = vStr(body.name, { label: "the template name", max: 160 });
    if (name.error) return json({ error: name.error }, 400, request);
    fields.name = name.value;
  }
  if (body.kind !== undefined) {
    const kind = vOneOf(String(body.kind), HK_KINDS, "job kind");
    if (kind.error) return json({ error: kind.error }, 400, request);
    fields.kind = kind.value;
  }
  if (body.area_id !== undefined) {
    if (body.area_id) {
      const area = await mustArea(env, body.area_id);
      if (area.error) return json({ error: area.error }, 400, request);
    }
    fields.area_id = body.area_id || null;
  }
  const statements = [];
  const keys = Object.keys(fields);
  if (keys.length) {
    statements.push(env.DB.prepare(`UPDATE hk_templates SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`).bind(...keys.map((k) => fields[k]), id));
  }
  if (body.items !== undefined) {
    const parsed = parseItemLabels(body.items);
    if (parsed.error) return json({ error: parsed.error }, 400, request);
    statements.push(env.DB.prepare("DELETE FROM hk_template_items WHERE template_id = ?").bind(id));
    parsed.labels.forEach((text, index) => {
      statements.push(env.DB.prepare("INSERT INTO hk_template_items (id, template_id, label, sort_order, is_sample) VALUES (?, ?, ?, ?, ?)").bind(randomId(), id, text, index, existing.is_sample || 0));
    });
  }
  if (!statements.length) return json({ template: existing }, 200, request);
  statements.push(auditStmt(env, user, "update", "hk_templates", id, JSON.stringify(fields), request, existing.is_sample));
  await env.DB.batch(statements);
  return json({ template: await env.DB.prepare("SELECT * FROM hk_templates WHERE id = ?").bind(id).first() }, 200, request);
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
  const missing = requireBody(body, request);
  if (missing) return missing;
  const title = vStr(body && body.title, { label: "the job title", max: 160 });
  const kind = vOneOf(String(body && body.kind || "pre"), HK_KINDS, "job kind");
  const status = vOneOf(String(body && body.status || "pending"), HK_STATUSES, "job status");
  const due = vDate(body && body.due, { label: "the due date", required: false });
  const notes = vStr(body && body.notes, { label: "notes", required: false, max: 2000 });
  for (const field of [title, kind, status, due, notes]) {
    if (field.error) return json({ error: field.error }, 400, request);
  }
  if (body.event_id) {
    const ev = await mustEvent(env, body.event_id);
    if (ev.error) return json({ error: ev.error }, 400, request);
  }
  if (body.area_id) {
    const area = await mustArea(env, body.area_id);
    if (area.error) return json({ error: area.error }, 400, request);
  }
  if (body.assigned_to) {
    const staff = await mustActiveStaff(env, body.assigned_to);
    if (staff.error) return json({ error: staff.error }, 400, request);
  }
  if (body.template_id) {
    const tmpl = await mustTemplate(env, body.template_id);
    if (tmpl.error) return json({ error: tmpl.error }, 400, request);
  }
  const id = randomId();
  const sample = actorSample(user);
  const statements = [
    env.DB.prepare(
      `INSERT INTO checklists (id, event_id, area_id, kind, title, assigned_to, due, status, notes, created_at, created_by, is_sample)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, body.event_id || null, body.area_id || null, kind.value, title.value, body.assigned_to || null, due.value || null, status.value, notes.value || "", isoNow(), user.id, sample)
  ];
  let labels;
  if (body.items != null && body.items !== "") {
    const parsed = parseItemLabels(body.items);
    if (parsed.error) return json({ error: parsed.error }, 400, request);
    labels = parsed.labels;
  } else {
    labels = [];
  }
  if (body.template_id && !labels.length) {
    const tmpl = await listBy(env, request, "SELECT label, sort_order FROM hk_template_items WHERE template_id = ? ORDER BY sort_order", [body.template_id]);
    labels = tmpl.map((row) => row.label);
  }
  if (labels.length > 100) return json({ error: "Please keep the checklist to 100 items or fewer." }, 400, request);
  labels.forEach((text, index) => {
    if (!text) return;
    statements.push(env.DB.prepare("INSERT INTO checklist_items (id, checklist_id, label, done, notes, sort_order, is_sample) VALUES (?, ?, ?, 0, '', ?, ?)").bind(randomId(), id, String(text).slice(0, 200), index, sample));
  });
  statements.push(auditStmt(env, user, "create", "checklists", id, title.value, request, sample));
  await env.DB.batch(statements);
  return json({ job: await env.DB.prepare("SELECT * FROM checklists WHERE id = ?").bind(id).first() }, 201, request);
}

async function patchHkJob(id, request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const existing = await env.DB.prepare("SELECT * FROM checklists WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Job not found." }, 404, request);
  if (user.role === "staff" && existing.assigned_to !== user.id) return deny(request);
  const body = await readJson(request);
  const missing = requireBody(body, request);
  if (missing) return missing;
  const fields = {};
  if (body.status !== undefined) {
    const status = vOneOf(String(body.status), HK_STATUSES, "job status");
    if (status.error) return json({ error: status.error }, 400, request);
    fields.status = status.value;
  }
  if (body.notes !== undefined) {
    const notes = vStr(body.notes, { label: "notes", required: false, max: 2000 });
    if (notes.error) return json({ error: notes.error }, 400, request);
    fields.notes = notes.value || "";
  }
  if (body.assigned_to !== undefined && user.role !== "staff") {
    if (body.assigned_to) {
      const staff = await mustActiveStaff(env, body.assigned_to);
      if (staff.error) return json({ error: staff.error }, 400, request);
    }
    fields.assigned_to = body.assigned_to || null;
  }
  if (body.due !== undefined && user.role !== "staff") {
    const due = vDate(body.due, { label: "the due date", required: false });
    if (due.error) return json({ error: due.error }, 400, request);
    fields.due = due.value || null;
  }
  if (body.title !== undefined && user.role !== "staff") {
    const title = vStr(body.title, { label: "the job title", max: 160 });
    if (title.error) return json({ error: title.error }, 400, request);
    fields.title = title.value;
  }
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
  if (!job) {
    if (user.role === "staff") return deny(request);
  } else if (user.role === "staff" && job.assigned_to !== user.id) {
    return deny(request);
  }
  const body = await readJson(request);
  const missing = requireBody(body, request);
  if (missing) return missing;
  const done = body.done !== undefined ? (body.done ? 1 : 0) : item.done;
  const notesField = body.notes !== undefined ? vStr(body.notes, { label: "notes", required: false, max: 2000 }) : { value: item.notes };
  if (notesField.error) return json({ error: notesField.error }, 400, request);
  const notes = notesField.value;
  await env.DB.batch([
    env.DB.prepare("UPDATE checklist_items SET done = ?, notes = ? WHERE id = ?").bind(done, notes, id),
    auditStmt(env, user, "update", "checklist_items", id, done ? "checked" : "unchecked", request, item.is_sample)
  ]);
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
  const missing = requireBody(body, request);
  if (missing) return missing;
  const title = vStr(body && body.title, { label: "the issue title", max: 160 });
  const detail = vStr(body && body.detail, { label: "the details", required: false, max: 4000 });
  const priority = vOneOf(String(body && body.priority || "normal"), TICKET_PRIORITIES, "priority");
  if (title.error || detail.error || priority.error) return json({ error: title.error || detail.error || priority.error }, 400, request);
  const id = randomId();
  const sample = actorSample(user);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO issues (id, area_id, event_id, title, detail, status, priority, reported_by, assigned_to, created_at, is_sample)
       VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)`
    ).bind(id, body.area_id || null, body.event_id || null, title.value, detail.value, priority.value, user.id, body.assigned_to || null, isoNow(), sample),
    auditStmt(env, user, "create", "issues", id, title.value, request, sample)
  ]);
  return json({ ticket: await env.DB.prepare("SELECT * FROM issues WHERE id = ?").bind(id).first() }, 201, request);
}

async function patchTicket(id, request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const existing = await env.DB.prepare("SELECT * FROM issues WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Issue not found." }, 404, request);
  if (user.role === "staff" && existing.assigned_to !== user.id && existing.reported_by !== user.id && existing.created_by !== user.id) {
    return deny(request);
  }
  const body = await readJson(request);
  const missing = requireBody(body, request);
  if (missing) return missing;
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
  if (body.detail !== undefined) {
    const detail = vStr(body.detail, { label: "the details", required: false, max: 4000 });
    if (detail.error) return json({ error: detail.error }, 400, request);
    fields.detail = detail.value || "";
  }
  if (body.assigned_to !== undefined && user.role !== "staff") {
    if (body.assigned_to) {
      const staff = await mustActiveStaff(env, body.assigned_to);
      if (staff.error) return json({ error: staff.error }, 400, request);
    }
    fields.assigned_to = body.assigned_to || null;
  }
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

async function listInventoryItems(env, request, user) {
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
  const items = await listBy(env, request, sql, params);
  return json({ items: isOwner(user) ? items : items.map((row) => presentItem(row, user)) }, 200, request);
}

async function listStock(env, request, user) {
  const rows = await listBy(env, request, "SELECT * FROM v_stock_on_hand ORDER BY category, name");
  const visible = isOwner(user) ? rows : rows.map((row) => presentItem(row, user));
  const low = visible.filter((row) => Number(row.qty_on_hand || 0) <= Number(row.reorder_level || 0));
  const locations = await listBy(env, request, "SELECT * FROM stock_locations ORDER BY name");
  return json({ stock: visible, low, locations }, 200, request);
}

async function createInventoryItem(request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  if (user.role === "staff") return deny(request);
  const body = await readJson(request);
  const missing = requireBody(body, request);
  if (missing) return missing;
  if (!isOwner(user) && body.unit_cost !== undefined && body.unit_cost !== null && body.unit_cost !== "") {
    return denyMoney(request);
  }
  const name = vStr(body && body.name, { label: "the item name", max: 160 });
  const category = vStr(body && body.category, { label: "the category", max: 80 });
  const unit = vStr(body && body.unit || "pc", { label: "the unit", max: 20 });
  const qty = vInt(body && body.qty_on_hand, { label: "the quantity", min: 0, max: 1000000, required: false });
  const reorder = vInt(body && body.reorder_level, { label: "the reorder level", min: 0, max: 1000000, required: false });
  const notes = vStr(body && body.notes, { label: "notes", required: false, max: 2000 });
  const cost = isOwner(user)
    ? vInt(body && body.unit_cost, { label: "the unit cost", min: 0, max: 10000000, required: false, allowNull: true })
    : { value: null };
  if ([name, category, unit, qty, reorder, notes, cost].some((f) => f.error)) return json({ error: (name.error || category.error || unit.error || qty.error || reorder.error || notes.error || cost.error) }, 400, request);
  const id = randomId();
  const opening = qty.value || 0;
  const sample = actorSample(user);
  const statements = [
    env.DB.prepare(
      `INSERT INTO inventory_items (id, name, category, unit, qty_on_hand, reorder_level, notes, sku, consumable, unit_cost, location_id, is_sample, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, name.value, category.value, unit.value, opening, reorder.value || 0, notes.value || "", body.sku || "", body.consumable ? 1 : 0, cost.value, body.location_id || null, sample, isoNow())
  ];
  if (opening) {
    statements.push(env.DB.prepare(
      `INSERT INTO inventory_moves (id, item_id, kind, qty, signed_qty, event_id, notes, created_at, created_by, is_sample)
       VALUES (?, ?, 'receive', ?, ?, NULL, 'Opening quantity', ?, ?, ?)`
    ).bind(randomId(), id, opening, opening, isoNow(), user.id, sample));
  }
  statements.push(auditStmt(env, user, "create", "inventory_items", id, name.value, request, sample));
  await env.DB.batch(statements);
  const item = await env.DB.prepare("SELECT * FROM inventory_items WHERE id = ?").bind(id).first();
  return json({ item: presentItem(item, user) }, 201, request);
}

async function patchInventoryItem(id, request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  if (user.role === "staff") return deny(request);
  const existing = await env.DB.prepare("SELECT * FROM inventory_items WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Item not found." }, 404, request);
  const body = await readJson(request);
  const missing = requireBody(body, request);
  if (missing) return missing;
  if (!isOwner(user) && body.unit_cost !== undefined) return denyMoney(request);
  const fields = { updated_at: isoNow() };
  const limits = { name: 160, category: 80, unit: 40, notes: 2000, sku: 80 };
  for (const key of ["name", "category", "unit", "notes", "sku"]) {
    if (body[key] === undefined) continue;
    const parsed = vStr(body[key], { label: key, required: key === "name", max: limits[key] });
    if (parsed.error) return json({ error: parsed.error }, 400, request);
    fields[key] = parsed.value || "";
  }
  if (body.reorder_level !== undefined) {
    const level = vInt(body.reorder_level, { label: "the reorder level", min: 0, max: 1000000 });
    if (level.error) return json({ error: level.error }, 400, request);
    fields.reorder_level = level.value;
  }
  if (isOwner(user) && body.unit_cost !== undefined) {
    if (body.unit_cost === "" || body.unit_cost === null) fields.unit_cost = null;
    else {
      const cost = vInt(body.unit_cost, { label: "the unit cost", min: 0, max: 10000000 });
      if (cost.error) return json({ error: cost.error }, 400, request);
      fields.unit_cost = cost.value;
    }
  }
  if (body.consumable !== undefined) fields.consumable = body.consumable ? 1 : 0;
  if (body.location_id !== undefined) fields.location_id = body.location_id || null;
  const keys = Object.keys(fields);
  await env.DB.batch([
    env.DB.prepare(`UPDATE inventory_items SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`).bind(...keys.map((k) => fields[k]), id),
    auditStmt(env, user, "update", "inventory_items", id, JSON.stringify(isOwner(user) ? fields : withoutUnitCost(fields)), request, existing.is_sample)
  ]);
  const item = await env.DB.prepare("SELECT * FROM inventory_items WHERE id = ?").bind(id).first();
  return json({ item: presentItem(item, user) }, 200, request);
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
  const missing = requireBody(body, request);
  if (missing) return missing;
  const kind = vOneOf(String(body && body.kind || ""), MOVE_KINDS, "movement type");
  const qty = vInt(body && body.qty, { label: "the quantity", min: kind && kind.value === "adjust" ? -1000000 : 1, max: 1000000 });
  if (kind.error || qty.error) return json({ error: kind.error || qty.error }, 400, request);
  if (user.role === "staff" && !["issue", "return"].includes(kind.value)) return deny(request);
  const item = await env.DB.prepare("SELECT * FROM inventory_items WHERE id = ?").bind(body.item_id).first();
  if (!item) return json({ error: "Item not found." }, 400, request);
  if (body.event_id) {
    const ev = await mustEvent(env, body.event_id);
    if (ev.error) return json({ error: ev.error }, 400, request);
  }
  const signed = moveSigned(kind.value, qty.value);
  const notes = vStr(body && body.notes, { label: "notes", required: false, max: 2000 });
  if (notes.error) return json({ error: notes.error }, 400, request);
  const id = randomId();
  const now = isoNow();
  const sample = actorSample(user, item);
  const results = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO inventory_moves (id, item_id, kind, qty, signed_qty, event_id, notes, created_at, created_by, is_sample, location_id)
       SELECT ?, id, ?, ?, ?, ?, ?, ?, ?, ?, ?
       FROM inventory_items
       WHERE id = ? AND qty_on_hand + ? >= 0`
    ).bind(id, kind.value, Math.abs(qty.value), signed, body.event_id || null, notes.value || "", now, user.id, sample, body.location_id || item.location_id || null, item.id, signed),
    env.DB.prepare("UPDATE inventory_items SET qty_on_hand = qty_on_hand + ?, updated_at = ? WHERE id = ? AND EXISTS (SELECT 1 FROM inventory_moves WHERE id = ?)").bind(signed, now, item.id, id)
  ]);
  const inserted = results[0] && results[0].meta && results[0].meta.changes;
  if (inserted !== 1) return json({ error: "There is not enough stock on hand for that movement." }, 409, request);
  await audit(env, user, "create", "inventory_moves", id, `${kind.value} ${item.name} ${signed}`, request, sample);
  const updated = await env.DB.prepare("SELECT qty_on_hand FROM inventory_items WHERE id = ?").bind(item.id).first();
  return json({ move: await env.DB.prepare("SELECT * FROM inventory_moves WHERE id = ?").bind(id).first(), qty_on_hand: updated && updated.qty_on_hand }, 201, request);
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
  const missing = requireBody(body, request);
  if (missing) return missing;
  const qty = vInt(body && body.qty, { label: "the quantity", min: 1, max: 100000 });
  if (qty.error) return json({ error: qty.error }, 400, request);
  if (!body.event_id || !body.item_id) return json({ error: "Please pick an event and an item." }, 400, request);
  const ev = await mustEvent(env, body.event_id);
  if (ev.error) return json({ error: ev.error }, 400, request);
  const item = await mustItem(env, body.item_id);
  if (item.error) return json({ error: item.error }, 400, request);
  const id = randomId();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO event_item_allocations (id, event_id, item_id, qty, returned_qty, damaged_qty, notes, is_sample, created_at, created_by)
       VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, ?)`
    ).bind(id, body.event_id, body.item_id, qty.value, body.notes || "", actorSample(user, ev.row || ev), isoNow(), user.id),
    auditStmt(env, user, "create", "event_item_allocations", id, `${body.event_id} ${qty.value}`, request, actorSample(user, ev.row || ev))
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
  const missing = requireBody(body, request);
  if (missing) return missing;
  const name = vStr(body && body.name, { label: "the supplier name", max: 160 });
  if (name.error) return json({ error: name.error }, 400, request);
  const id = randomId();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO suppliers (id, name, contact, category, notes, is_sample, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, name.value, body.contact || "", body.category || "", body.notes || "", actorSample(user), isoNow()),
    auditStmt(env, user, "create", "suppliers", id, name.value, request, actorSample(user))
  ]);
  return json({ supplier: await env.DB.prepare("SELECT * FROM suppliers WHERE id = ?").bind(id).first() }, 201, request);
}

async function patchSupplier(id, request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  if (user.role === "staff") return deny(request);
  const body = await readJson(request);
  const missing = requireBody(body, request);
  if (missing) return missing;
  const existing = await env.DB.prepare("SELECT * FROM suppliers WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Supplier not found." }, 404, request);
  const fields = {};
  const limits = { name: 160, contact: 160, category: 80, notes: 2000 };
  for (const key of ["name", "contact", "category", "notes"]) {
    if (body[key] === undefined) continue;
    const parsed = vStr(body[key], { label: key, required: false, max: limits[key] });
    if (parsed.error) return json({ error: parsed.error }, 400, request);
    fields[key] = parsed.value || "";
  }
  const keys = Object.keys(fields);
  if (!keys.length) return json({ supplier: existing }, 200, request);
  await env.DB.batch([
    env.DB.prepare(`UPDATE suppliers SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`).bind(...keys.map((k) => fields[k]), id),
    auditStmt(env, user, "update", "suppliers", id, JSON.stringify(fields), request, existing.is_sample)
  ]);
  return json({ supplier: await env.DB.prepare("SELECT * FROM suppliers WHERE id = ?").bind(id).first() }, 200, request);
}

async function listPOs(env, request, user) {
  const rows = await listBy(env, request, `SELECT p.*, s.name AS supplier_name FROM purchase_orders p LEFT JOIN suppliers s ON s.id = p.supplier_id ORDER BY p.created_at DESC LIMIT 200`);
  const ids = rows.map((row) => row.id);
  let lines = [];
  if (ids.length) lines = await listBy(env, request, `SELECT * FROM po_lines WHERE po_id IN (${ids.map(() => "?").join(",")})`, ids);
  const by = {};
  for (const line of lines) {
    if (!by[line.po_id]) by[line.po_id] = [];
    by[line.po_id].push(line);
  }
  const poMoney = ["total", "total_cents"];
  const lineMoney = ["unit_cost", "amount", "unit_cost_cents", "amount_cents"];
  const orders = rows.map((row) => ({ ...row, lines: by[row.id] || [] }));
  const visible = isOwner(user)
    ? orders
    : orders.map((row) => ({
        ...stripMoneyFields(row, poMoney),
        lines: (row.lines || []).map((line) => stripMoneyFields(line, lineMoney))
      }));
  return json({ orders: visible, statuses: PO_STATUSES }, 200, request);
}

async function createPO(request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  if (user.role === "staff") return deny(request);
  const body = await readJson(request);
  const missing = requireBody(body, request);
  if (missing) return missing;
  const lines = Array.isArray(body.lines) ? body.lines : [];
  if (!lines.length) return json({ error: "Please add at least one line." }, 400, request);
  const hasMoney = body.total !== undefined && body.total !== null && body.total !== ""
    || lines.some((line) => line && (line.unit_cost !== undefined && line.unit_cost !== null && line.unit_cost !== "" || line.amount !== undefined && line.amount !== null && line.amount !== ""));
  if (hasMoney && !isOwner(user)) return denyMoney(request);
  const notes = vStr(body && body.notes, { label: "notes", required: false, max: 2000 });
  if (notes.error) return json({ error: notes.error }, 400, request);
  const total = isOwner(user) ? lines.reduce((sum, line) => sum + (Number(line.qty) || 0) * (Number(line.unit_cost) || 0), 0) : 0;
  const id = randomId();
  const sample = actorSample(user);
  return runWithSerialRetry(env, "pos", sample, request, async (number) => {
    const statements = [
      env.DB.prepare(
        `INSERT INTO purchase_orders (id, number, supplier_id, status, ordered_at, expected_at, total, notes, created_at, created_by, is_sample, total_cents)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, number, body.supplier_id || null, body.status && PO_STATUSES.includes(body.status) ? body.status : "draft", body.ordered_at || todayISO(), body.expected_at || null, total, notes.value, isoNow(), user.id, sample, centsFromPesos(total))
    ];
    lines.forEach((line) => {
      const qty = Number(line.qty) || 1;
      const cost = isOwner(user) ? (Number(line.unit_cost) || 0) : 0;
      statements.push(env.DB.prepare(
        `INSERT INTO po_lines (id, po_id, item_id, label, qty, unit_cost, amount, is_sample, unit_cost_cents, amount_cents) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(randomId(), id, line.item_id || null, String(line.label || "Item").slice(0, 200), qty, cost, qty * cost, sample, centsFromPesos(cost), centsFromPesos(qty * cost)));
    });
    statements.push(auditStmt(env, user, "create", "purchase_orders", id, number, request, sample));
    await env.DB.batch(statements);
    const order = await env.DB.prepare("SELECT * FROM purchase_orders WHERE id = ?").bind(id).first();
    return json({ order: isOwner(user) ? order : stripMoneyFields(order, ["total", "total_cents"]) }, 201, request);
  });
}

async function presentPO(row, user) {
  if (!row) return row;
  return isOwner(user) ? row : stripMoneyFields(row, ["total", "total_cents"]);
}

async function patchPO(id, request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  if (user.role === "staff") return deny(request);
  const existing = await env.DB.prepare("SELECT * FROM purchase_orders WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Purchase order not found." }, 404, request);
  const body = await readJson(request);
  const missing = requireBody(body, request);
  if (missing) return missing;
  const status = body.status ? vOneOf(String(body.status), PO_STATUSES, "status") : { value: existing.status };
  if (status.error) return json({ error: status.error }, 400, request);
  const notes = body.notes !== undefined ? vStr(body.notes, { label: "notes", required: false, max: 2000 }) : { value: existing.notes };
  if (notes.error) return json({ error: notes.error }, 400, request);
  if (existing.status === "received" && status.value !== "received") {
    return json({ error: "A received purchase order cannot be changed back. The stock has already been recorded." }, 400, request);
  }
  const now = isoNow();
  const present = async () => presentPO(await env.DB.prepare("SELECT * FROM purchase_orders WHERE id = ?").bind(id).first(), user);

  if (status.value === "received" && existing.status !== "received") {
    const claimed = await env.DB.prepare(
      "UPDATE purchase_orders SET status = 'received', notes = ? WHERE id = ? AND status != 'received'"
    ).bind(notes.value, id).run();
    if (!claimed || !claimed.meta || claimed.meta.changes !== 1) {
      return json({ error: "This purchase order was already received." }, 409, request);
    }
    const lines = await listBy(env, request, "SELECT * FROM po_lines WHERE po_id = ? AND item_id IS NOT NULL", [id]);
    const statements = [];
    for (const line of lines) {
      const qty = Number(line.qty) || 0;
      const marker = `PO ${existing.number}`;
      statements.push(env.DB.prepare(
        `INSERT INTO inventory_moves (id, item_id, kind, qty, signed_qty, event_id, notes, created_at, created_by, is_sample)
         SELECT ?, l.item_id, 'receive', l.qty, l.qty, NULL, ?, ?, ?, IFNULL(p.is_sample, 0)
         FROM po_lines l
         JOIN purchase_orders p ON p.id = l.po_id
         WHERE l.id = ? AND p.id = ? AND p.status = 'received'
           AND NOT EXISTS (
             SELECT 1 FROM inventory_moves m
             WHERE m.item_id = l.item_id AND m.kind = 'receive' AND m.notes = ?
           )`
      ).bind(randomId(), marker, now, user.id, line.id, id, marker));
      statements.push(env.DB.prepare(
        `UPDATE inventory_items SET qty_on_hand = qty_on_hand + ?, updated_at = ?
         WHERE id = ? AND EXISTS (
           SELECT 1 FROM inventory_moves m
           WHERE m.item_id = inventory_items.id AND m.kind = 'receive' AND m.notes = ? AND m.created_at = ?
         )`
      ).bind(qty, now, line.item_id, marker, now));
    }
    statements.push(auditStmt(env, user, "update", "purchase_orders", id, "received", request, existing.is_sample));
    if (statements.length) await env.DB.batch(statements);
    return json({ order: await present() }, 200, request);
  }

  await env.DB.batch([
    env.DB.prepare("UPDATE purchase_orders SET status = ?, notes = ? WHERE id = ?").bind(status.value, notes.value, id),
    auditStmt(env, user, "update", "purchase_orders", id, status.value, request, existing.is_sample)
  ]);
  return json({ order: await present() }, 200, request);
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
  const missing = requireBody(body, request);
  if (missing) return missing;
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
  const sample = actorSample(user);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO expenses (id, date, category, payee, amount, method, event_id, notes, created_at, created_by, is_sample, account_id, vat, receipt_no, supplier_id, amount_cents, vat_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, date.value, category.value, payee.value, amount.value, body.method || "cash", body.event_id || null, notes.value, isoNow(), user.id, sample, body.account_id || null, vat.value || 0, body.receipt_no || "", body.supplier_id || null, centsFromPesos(amount.value), centsFromPesos(vat.value || 0)),
    auditStmt(env, user, "create", "expenses", id, `${category.value} ${amount.value}`, request, sample)
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
  const missing = requireBody(body, request);
  if (missing) return missing;
  const date = vDate(body && body.date || todayISO(), { label: "the date" });
  const kind = vOneOf(String(body && body.kind || "out"), ["in", "out"], "type");
  const amount = vInt(body && body.amount, { label: "the amount", min: 1, max: 10000000 });
  const reason = vStr(body && body.reason, { label: "the reason", max: 400 });
  for (const field of [date, kind, amount, reason]) {
    if (field.error) return json({ error: field.error }, 400, request);
  }
  const id = randomId();
  const sample = actorSample(user);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO petty_cash (id, date, kind, amount, reason, expense_id, created_at, created_by, is_sample, method, amount_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, date.value, kind.value, amount.value, reason.value, body.expense_id || null, isoNow(), user.id, sample, body.method || "cash", centsFromPesos(amount.value)),
    auditStmt(env, user, "create", "petty_cash", id, `${kind.value} ${amount.value}`, request, sample)
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
  const balance = await env.DB.prepare("SELECT * FROM v_event_balance WHERE event_id = ?").bind(id).first();
  if (!balance) return json({ error: "Event not found." }, 404, request);
  const expenseRows = await listBy(env, request, "SELECT * FROM expenses WHERE event_id = ? AND voided_at IS NULL ORDER BY date", [id]);
  const laborRows = await listBy(env, request, `SELECT SUM(IFNULL(p.daily_rate, IFNULL(p.rate, 0))) AS labor
    FROM shifts s LEFT JOIN staff_profiles p ON p.user_id = s.staff_id WHERE s.event_id = ?`, [id]);
  const direct = expenseRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const laborCost = Number(laborRows[0] && laborRows[0].labor) || 0;
  const contract = Number(balance.contract_total) || 0;
  const event = {
    ...balance,
    direct,
    labor: laborCost,
    consumables: 0,
    margin: contract - direct - laborCost,
    collected: Number(balance.collected) || 0
  };
  return json({ event, expenses: expenseRows.map((row) => withPesos(row, ["amount"])) }, 200, request);
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
  const person = await env.DB.prepare("SELECT id, role, is_sample FROM users WHERE id = ?").bind(id).first();
  if (!person) return json({ error: "Staff member not found." }, 404, request);
  if (person.role === "owner") return json({ error: "Owner payroll details are not kept here." }, 400, request);
  const body = await readJson(request);
  const missing = requireBody(body, request);
  if (missing) return missing;
  if (!isOwner(user) && (body.daily_rate !== undefined || body.hourly_rate !== undefined || body.rate !== undefined || body.rate_type !== undefined)) {
    return denyMoney(request);
  }
  const fields = {};
  if (body.employment !== undefined) {
    const employment = vStr(body.employment, { label: "employment", required: false, max: 80 });
    if (employment.error) return json({ error: employment.error }, 400, request);
    fields.employment = employment.value || "";
  }
  if (body.start_date !== undefined) {
    const start = vDate(body.start_date, { label: "the start date", required: false });
    if (start.error) return json({ error: start.error }, 400, request);
    fields.start_date = start.value || null;
  }
  if (body.notes !== undefined) {
    const notes = vStr(body.notes, { label: "notes", required: false, max: 2000 });
    if (notes.error) return json({ error: notes.error }, 400, request);
    fields.notes = notes.value || "";
  }
  if (isOwner(user)) {
    for (const key of ["daily_rate", "hourly_rate", "rate"]) {
      if (body[key] === undefined) continue;
      if (body[key] === "" || body[key] === null) {
        fields[key] = null;
        fields[`${key}_cents`] = null;
        continue;
      }
      const parsed = vInt(body[key], { label: key.replace("_", " "), min: 0, max: 10000000 });
      if (parsed.error) return json({ error: parsed.error }, 400, request);
      fields[key] = parsed.value;
      fields[`${key}_cents`] = centsFromPesos(parsed.value);
    }
    if (body.rate_type !== undefined) {
      const rateType = vOneOf(String(body.rate_type), ["daily", "hourly"], "rate type");
      if (rateType.error) return json({ error: rateType.error }, 400, request);
      fields.rate_type = rateType.value;
    }
  }
  const keys = Object.keys(fields);
  if (!keys.length) return json({ ok: true }, 200, request);
  const placeholders = keys.map(() => "?").join(", ");
  const updates = keys.map((key) => `${key}=excluded.${key}`).join(", ");
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO staff_profiles (user_id, is_sample, created_at, ${keys.join(", ")})
       VALUES (?, ?, ?, ${placeholders})
       ON CONFLICT(user_id) DO UPDATE SET ${updates}`
    ).bind(id, person.is_sample || 0, isoNow(), ...keys.map((key) => fields[key])),
    auditStmt(env, user, "update", "staff_profiles", id, keys.join(","), request, person.is_sample)
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
    by[line.period_id].push({ ...line, contributionsEstimated: true });
  }
  return json({
    periods: periods.map((row) => ({ ...row, lines: by[row.id] || [], contributionEstimates: true })),
    statuses: PAYROLL_STATUSES,
    contributionEstimates: true,
    contributionNote: "SSS, PhilHealth, Pag-IBIG and withholding tax are estimates until official contribution tables are confirmed."
  }, 200, request);
}

async function createPayrollPeriod(request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  const missing = requireBody(body, request);
  if (missing) return missing;
  const start = vDate(body && body.start_date, { label: "the start date" });
  const end = vDate(body && body.end_date, { label: "the end date" });
  if (start.error || end.error) return json({ error: start.error || end.error }, 400, request);
  if (end.value < start.value) return json({ error: "The end date cannot be before the start date." }, 400, request);
  const sample = actorSample(user);
  const overlap = await env.DB.prepare(
    `SELECT id FROM payroll_periods
     WHERE IFNULL(is_sample,0) = ?
       AND status NOT IN ('void', 'cancelled')
       AND start_date <= ? AND end_date >= ?`
  ).bind(sample, end.value, start.value).first();
  if (overlap) return json({ error: "This payroll period overlaps an existing one." }, 409, request);
  const profiles = await listBy(env, request, `SELECT u.id, u.is_sample, p.daily_rate, p.rate, p.rate_type, p.hourly_rate FROM users u LEFT JOIN staff_profiles p ON p.user_id = u.id WHERE u.role != 'owner' AND IFNULL(u.is_active,1)=1 AND IFNULL(u.is_sample,0) = ?`, [sample]);
  const attendance = await listBy(env, request, "SELECT staff_id, date, time_in, time_out FROM attendance WHERE date >= ? AND date <= ? AND time_in IS NOT NULL", [start.value, end.value]);
  const reservedRows = await listBy(env, request,
    `SELECT l.advance_ids FROM payroll_lines l JOIN payroll_periods p ON p.id = l.period_id
     WHERE p.status IN ('draft', 'reviewed') AND IFNULL(p.is_sample,0) = ?`,
    [sample]
  );
  const reservedIds = new Set();
  for (const row of reservedRows) {
    for (const part of String(row.advance_ids || "").split(",")) {
      if (part.trim()) reservedIds.add(part.trim());
    }
  }
  const openAdvances = (await listBy(env, request, "SELECT id, user_id, amount, date FROM cash_advances WHERE status = 'open' AND date <= ? AND IFNULL(is_sample,0) = ? ORDER BY date, id", [end.value, sample]))
    .filter((row) => !reservedIds.has(row.id));
  const advByUser = {};
  for (const row of openAdvances) {
    if (!advByUser[row.user_id]) advByUser[row.user_id] = [];
    advByUser[row.user_id].push(row);
  }
  const daysMap = {};
  const hoursMap = {};
  for (const row of attendance) {
    if (!daysMap[row.staff_id]) daysMap[row.staff_id] = new Set();
    daysMap[row.staff_id].add(row.date);
    hoursMap[row.staff_id] = (hoursMap[row.staff_id] || 0) + hoursBetween(row.time_in, row.time_out);
  }
  const id = randomId();
  const statements = [
    env.DB.prepare(
      `INSERT INTO payroll_periods (id, start_date, end_date, status, notes, created_at, created_by, is_sample)
       VALUES (?, ?, ?, 'draft', ?, ?, ?, ?)`
    ).bind(id, start.value, end.value, clipText(body.notes || "", 2000), isoNow(), user.id, sample)
  ];
  for (const person of profiles) {
    const daysWorked = daysMap[person.id] ? daysMap[person.id].size : 0;
    const hoursWorked = Math.round((hoursMap[person.id] || 0) * 100) / 100;
    const isHourly = String(person.rate_type || "").toLowerCase() === "hourly";
    const hourly = Number(person.hourly_rate || (isHourly ? person.rate : 0) || 0);
    const daily = Number(person.daily_rate || (!isHourly ? person.rate : 0) || 0);
    const gross = Math.round(isHourly ? hoursWorked * hourly : daysWorked * daily);
    const sss = Math.round(gross * 0.045);
    const philhealth = Math.round(gross * 0.025);
    const pagibig = Math.min(100, Math.round(gross * 0.02));
    const wtax = 0;
    const afterGovt = gross - sss - philhealth - pagibig - wtax;
    const { applied, appliedIds } = applyOpenAdvances(advByUser[person.id] || [], Math.max(afterGovt, 0));
    const net = Math.max(afterGovt - applied, 0);
    statements.push(env.DB.prepare(
      `INSERT INTO payroll_lines (id, period_id, user_id, days_worked, hours_worked, gross, sss, philhealth, pagibig, wtax, advances, other_deductions, net, notes, is_sample, gross_cents, sss_cents, philhealth_cents, pagibig_cents, wtax_cents, advances_cents, net_cents, advance_ids, contributions_estimated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
    ).bind(randomId(), id, person.id, daysWorked, hoursWorked, gross, sss, philhealth, pagibig, wtax, applied, net, person.is_sample || 0, centsFromPesos(gross), centsFromPesos(sss), centsFromPesos(philhealth), centsFromPesos(pagibig), centsFromPesos(wtax), centsFromPesos(applied), centsFromPesos(net), appliedIds.join(",") || null));
  }
  statements.push(auditStmt(env, user, "create", "payroll_periods", id, `${start.value} ${end.value}`, request, sample));
  await env.DB.batch(statements);
  const period = await env.DB.prepare("SELECT * FROM payroll_periods WHERE id = ?").bind(id).first();
  return json({ period, contributionEstimates: true }, 201, request);
}

async function patchPayrollPeriod(id, request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const existing = await env.DB.prepare("SELECT * FROM payroll_periods WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Payroll period not found." }, 404, request);
  const body = await readJson(request);
  const missing = requireBody(body, request);
  if (missing) return missing;
  if (existing.status === "paid") return json({ error: "A paid payroll period is locked." }, 409, request);
  const status = vOneOf(String(body.status || existing.status), PAYROLL_STATUSES, "status");
  if (status.error) return json({ error: status.error }, 400, request);
  const statements = [
    env.DB.prepare("UPDATE payroll_periods SET status = ?, notes = ? WHERE id = ?").bind(status.value, body.notes !== undefined ? clipText(body.notes, 2000) : existing.notes, id)
  ];
  if (status.value === "paid" && existing.status !== "paid") {
    const lines = await listBy(env, request, "SELECT user_id, advances, advance_ids FROM payroll_lines WHERE period_id = ?", [id]);
    const ids = [];
    for (const line of lines) {
      String(line.advance_ids || "").split(",").map((part) => part.trim()).filter(Boolean).forEach((part) => ids.push(part));
    }
    if (ids.length) {
      statements.push(env.DB.prepare(`UPDATE cash_advances SET status = 'deducted' WHERE status = 'open' AND id IN (${ids.map(() => "?").join(",")})`).bind(...ids));
    }
  }
  statements.push(auditStmt(env, user, "update", "payroll_periods", id, status.value, request, existing.is_sample));
  await env.DB.batch(statements);
  return json({ period: await env.DB.prepare("SELECT * FROM payroll_periods WHERE id = ?").bind(id).first(), contributionEstimates: true }, 200, request);
}

async function listAdvances(env, request) {
  const rows = await listBy(env, request, `SELECT a.*, u.name AS staff_name FROM cash_advances a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.date DESC LIMIT 300`);
  return json({ advances: rows, statuses: ADVANCE_STATUSES }, 200, request);
}

async function createAdvance(request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  const missing = requireBody(body, request);
  if (missing) return missing;
  const amount = vInt(body && body.amount, { label: "the amount", min: 1, max: 1000000 });
  const date = vDate(body && body.date || todayISO(), { label: "the date" });
  const reason = vStr(body && body.reason, { label: "the reason", required: false, max: 400 });
  if (amount.error || date.error || reason.error) return json({ error: amount.error || date.error || reason.error }, 400, request);
  if (!body.user_id) return json({ error: "Please pick a staff member." }, 400, request);
  const person = await mustActiveStaff(env, body.user_id);
  if (person.error) return json({ error: person.error }, 400, request);
  const id = randomId();
  const sample = actorSample(user, person.row);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO cash_advances (id, user_id, date, amount, reason, status, created_at, created_by, is_sample, amount_cents)
       VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)`
    ).bind(id, body.user_id, date.value, amount.value, reason.value, isoNow(), user.id, sample, centsFromPesos(amount.value)),
    auditStmt(env, user, "create", "cash_advances", id, String(amount.value), request, sample)
  ]);
  return json({ advance: await env.DB.prepare("SELECT * FROM cash_advances WHERE id = ?").bind(id).first() }, 201, request);
}

async function patchAdvance(id, request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const existing = await env.DB.prepare("SELECT * FROM cash_advances WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Advance not found." }, 404, request);
  const body = await readJson(request);
  const missing = requireBody(body, request);
  if (missing) return missing;
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
  const missing = requireBody(body, request);
  if (missing) return missing;
  const staffId = user.role === "staff" ? user.id : (body.user_id || user.id);
  const person = await mustActiveStaff(env, staffId);
  if (person.error) return json({ error: person.error }, 400, request);
  const kind = vOneOf(String(body && body.kind || "vacation"), LEAVE_KINDS, "leave type");
  const start = vDate(body && body.start_date, { label: "the start date" });
  const end = vDate(body && body.end_date || (body && body.start_date), { label: "the end date" });
  const reason = vStr(body && body.reason, { label: "the reason", required: false, max: 400 });
  if (kind.error || start.error || end.error || reason.error) return json({ error: kind.error || start.error || end.error || reason.error }, 400, request);
  if (end.value < start.value) return json({ error: "The end date cannot be before the start date." }, 400, request);
  const days = Math.round((new Date(`${end.value}T00:00:00+08:00`) - new Date(`${start.value}T00:00:00+08:00`)) / 86400000) + 1;
  const id = randomId();
  const sample = actorSample(user, person.row);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO leave_requests (id, user_id, kind, start_date, end_date, days, reason, status, created_at, is_sample)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
    ).bind(id, staffId, kind.value, start.value, end.value, days, reason.value, isoNow(), sample),
    auditStmt(env, user, "create", "leave_requests", id, kind.value, request, sample)
  ]);
  return json({ request: await env.DB.prepare("SELECT * FROM leave_requests WHERE id = ?").bind(id).first() }, 201, request);
}

async function patchLeave(id, request, env, user) {
  if (!requireOrigin(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const existing = await env.DB.prepare("SELECT * FROM leave_requests WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Leave request not found." }, 404, request);
  const body = await readJson(request);
  const missing = requireBody(body, request);
  if (missing) return missing;
  const status = vOneOf(String(body.status || existing.status), LEAVE_STATUSES, "status");
  if (status.error) return json({ error: status.error }, 400, request);
  const next = status.value;
  const current = existing.status;
  const allowed = {
    pending: ["approved", "declined", "cancelled"],
    approved: ["cancelled"],
    declined: [],
    cancelled: []
  };
  if (next !== current && !(allowed[current] || []).includes(next)) {
    return json({ error: "This leave request is already decided and cannot be changed." }, 400, request);
  }
  const deciding = next === "approved" || next === "declined";
  if (user.role === "staff") {
    if (existing.user_id !== user.id) return deny(request);
    if (next !== "cancelled") return json({ error: "You can only cancel your own leave request." }, 400, request);
  } else if (deciding) {
    if (existing.user_id === user.id) {
      return json({ error: "You cannot approve or decline your own leave request." }, 400, request);
    }
    const subject = await env.DB.prepare("SELECT id, role FROM users WHERE id = ?").bind(existing.user_id).first();
    const subjectRole = subject && subject.role;
    if (subjectRole === "admin" && user.role !== "owner") {
      return json({ error: "Only the owner can decide an admin's leave." }, 403, request);
    }
    if (subjectRole === "owner" && user.role !== "owner") {
      return json({ error: "Only the owner can decide an owner's leave." }, 403, request);
    }
  } else if (user.role !== "owner" && user.role !== "admin" && existing.user_id !== user.id) {
    return deny(request);
  }
  await env.DB.batch([
    env.DB.prepare("UPDATE leave_requests SET status = ?, decided_by = ?, decided_at = ? WHERE id = ?").bind(next, user.id, isoNow(), id),
    auditStmt(env, user, "update", "leave_requests", id, `${current}→${next}`, request, existing.is_sample)
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

