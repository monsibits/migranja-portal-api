/**
 * Mi Granja staff portal and booking API.
 * Data lives in a private D1 database. Secrets are Worker bindings, never in source.
 */

const ALLOWED_ORIGINS = [
  "https://www.migranjaevents.com",
  "https://migranjaevents.com"
];

const TZ = "Asia/Manila";
const PBKDF2_ITERATIONS = 100000;
const PASSWORD_ALGO = "pbkdf2-sha256-100000";
const SESSION_DAYS = 30;
const SESSION_IDLE_DAYS = 7;
const TEMP_PASSWORD_HOURS = 72;
const MAX_PUBLIC_POSTS_PER_HOUR = 8;
const PENDING_PER_DATE = 8;
const PENDING_DAYS = 7;
const LOGIN_WINDOW_MINUTES = 15;
const LOGIN_MAX_PER_IP = 10;
const LOGIN_MAX_PER_ACCOUNT = 5;
const LOGIN_TURNSTILE_AFTER = 3;
const TURNSTILE_SITE_KEY = "0x4AAAAAAGSrpXsnJmbKqvfS";
const HELD_STATUSES = new Set(["Confirmed", "Tentative", "Setup", "Booked"]);
const EVENT_STATUSES = ["Confirmed", "Tentative", "Setup", "Booked", "Completed", "Cancelled"];
const REQUEST_STATUSES = ["pending", "approved", "declined", "expired"];
const EVENT_TYPES = ["Wedding", "Debut", "Birthday", "Christening", "Corporate", "Other"];
const VENUES = ["Any", "Ballroom", "The Nook", "Amore Garden"];
const SHIFT_ROLES = ["Venue manager", "Event coordinator", "Floor supervisor", "Staff", "Kitchen", "Other"];
const COMMON_PASSWORDS = new Set([
  "password123", "password1234", "admin12345", "qwerty12345", "iloveyou123",
  "welcome123", "changeme123", "letmein123", "1234567890", "123456789a",
  "migranja123", "philippines1", "password1!", "abc1234567"
]);

const ACL = {
  events: { read: ["owner", "admin"], write: ["owner", "admin"] },
  requests: { read: ["owner", "admin"], write: ["owner", "admin"] },
  schedule: { read: ["owner", "admin", "staff"], write: ["owner", "admin"] },
  tasks: { read: ["owner", "admin", "staff"], write: ["owner", "admin"] },
  attendance: { read: ["owner", "admin", "staff"], write: ["owner", "admin", "staff"] },
  announcements: { read: ["owner", "admin", "staff"], write: ["owner", "admin"] },
  finances: { read: ["owner"], write: ["owner"] },
  users: { read: ["owner"], write: ["owner"] },
  reports: { read: ["owner", "admin"], write: ["owner"] },
  audit: { read: ["owner"], write: ["owner"] }
};

const ALLOW_WHILE_PASSWORD_CHANGE = new Set([
  "GET /api/auth/me",
  "POST /api/auth/password",
  "POST /api/auth/logout",
  "POST /api/auth/logout-all"
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const requestId = request.headers.get("CF-Ray") || randomId();
    try {
      return await handle(request, env, url, requestId);
    } catch (err) {
      console.error(JSON.stringify({
        level: "error",
        requestId,
        path: url.pathname,
        method: request.method,
        message: String(err && err.message ? err.message : err)
      }));
      return json({ error: "Something went wrong. Please try again.", requestId }, 500, request);
    }
  }
};

async function handle(request, env, url, requestId) {
  if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }), request);

  if (url.pathname === "/api/health" && request.method === "GET") {
    return json({ ok: true }, 200, request);
  }
  if (url.pathname === "/api/config" && request.method === "GET") {
    return json({ turnstileSiteKey: TURNSTILE_SITE_KEY }, 200, request);
  }
  if (url.pathname === "/api/calendar" && request.method === "GET") {
    return getCalendar(url, env, request);
  }
  if (url.pathname === "/api/requests" && request.method === "POST") {
    return createPublicRequest(request, env);
  }
  if (url.pathname === "/api/auth/setup" && request.method === "POST") {
    return setupOwner(request, env);
  }
  if (url.pathname === "/api/auth/login" && request.method === "POST") {
    return login(request, env);
  }
  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    return logout(request, env);
  }

  const user = await requireUser(request, env);
  if (user instanceof Response) return user;

  if (user.must_change_password) {
    const key = `${request.method} ${url.pathname}`;
    if (!ALLOW_WHILE_PASSWORD_CHANGE.has(key)) {
      return json({
        error: "Please set a new password before continuing.",
        code: "password_change_required"
      }, 403, request);
    }
  }

  if (url.pathname === "/api/auth/me" && request.method === "GET") {
    return json({ user: publicUser(user) }, 200, request);
  }
  if (url.pathname === "/api/auth/password" && request.method === "POST") {
    return changePassword(request, env, user);
  }
  if (url.pathname === "/api/auth/logout-all" && request.method === "POST") {
    return logoutAll(env, request, user);
  }
  if (url.pathname === "/api/directory" && request.method === "GET") {
    return listDirectory(env, request);
  }

  if (url.pathname === "/api/events" && request.method === "GET") {
    if (!allow(user, "events", "read")) return deny(request);
    return listEvents(env, request, user);
  }
  if (url.pathname === "/api/events" && request.method === "POST") {
    if (!allow(user, "events", "write")) return deny(request);
    return createEvent(request, env, user);
  }
  if (url.pathname.startsWith("/api/events/") && request.method === "PATCH") {
    if (!allow(user, "events", "write")) return deny(request);
    return patchEvent(url.pathname.split("/").pop(), request, env, user);
  }

  if (url.pathname === "/api/requests" && request.method === "GET") {
    if (!allow(user, "requests", "read")) return deny(request);
    return listRequests(env, request);
  }
  if (url.pathname.startsWith("/api/requests/") && url.pathname.endsWith("/decide") && request.method === "POST") {
    if (!allow(user, "requests", "write")) return deny(request);
    const id = url.pathname.split("/")[3];
    return decideRequest(id, request, env, user);
  }

  if (url.pathname === "/api/shifts" && request.method === "GET") {
    if (!allow(user, "schedule", "read")) return deny(request);
    return listShifts(env, request, user);
  }
  if (url.pathname === "/api/shifts" && request.method === "POST") {
    if (!allow(user, "schedule", "write")) return deny(request);
    return createShift(request, env, user);
  }
  if (url.pathname.startsWith("/api/shifts/") && request.method === "PATCH") {
    if (!allow(user, "schedule", "write")) return deny(request);
    return patchShift(url.pathname.split("/").pop(), request, env, user);
  }
  if (url.pathname.startsWith("/api/shifts/") && request.method === "DELETE") {
    if (!allow(user, "schedule", "write")) return deny(request);
    return deleteShift(url.pathname.split("/").pop(), request, env, user);
  }

  if (url.pathname === "/api/tasks" && request.method === "GET") {
    if (!allow(user, "tasks", "read")) return deny(request);
    return listTasks(env, request, user);
  }
  if (url.pathname === "/api/tasks" && request.method === "POST") {
    if (!allow(user, "tasks", "write")) return deny(request);
    return createTask(request, env, user);
  }
  if (url.pathname.startsWith("/api/tasks/") && request.method === "PATCH") {
    return patchTask(url.pathname.split("/").pop(), request, env, user);
  }
  if (url.pathname.startsWith("/api/tasks/") && request.method === "DELETE") {
    if (!allow(user, "tasks", "write")) return deny(request);
    return deleteTask(url.pathname.split("/").pop(), request, env, user);
  }

  if (url.pathname === "/api/attendance" && request.method === "GET") {
    if (!allow(user, "attendance", "read")) return deny(request);
    return listAttendance(env, request, user);
  }
  if (url.pathname === "/api/attendance/clock" && request.method === "POST") {
    if (!allow(user, "attendance", "write")) return deny(request);
    return clock(env, request, user);
  }
  if (url.pathname.startsWith("/api/attendance/") && request.method === "PATCH") {
    if (user.role === "staff") return deny(request);
    if (!allow(user, "attendance", "write")) return deny(request);
    return patchAttendance(url.pathname.split("/").pop(), request, env, user);
  }

  if (url.pathname === "/api/announcements" && request.method === "GET") {
    if (!allow(user, "announcements", "read")) return deny(request);
    return listAnnouncements(env, request);
  }
  if (url.pathname === "/api/announcements" && request.method === "POST") {
    if (!allow(user, "announcements", "write")) return deny(request);
    return createAnnouncement(request, env, user);
  }

  if (url.pathname === "/api/finances" && request.method === "GET") {
    if (!allow(user, "finances", "read")) return deny(request);
    return listFinances(env, request);
  }

  if (url.pathname === "/api/reports/export" && request.method === "GET") {
    if (user.role !== "owner" && user.role !== "admin") return deny(request);
    return exportReport(url, env, request, user);
  }

  if (url.pathname === "/api/users" && request.method === "GET") {
    if (!allow(user, "users", "read")) return deny(request);
    return listUsers(env, request);
  }
  if (url.pathname === "/api/users" && request.method === "POST") {
    if (!allow(user, "users", "write")) return deny(request);
    return createUser(request, env, user);
  }
  if (url.pathname.startsWith("/api/users/") && url.pathname.endsWith("/logout") && request.method === "POST") {
    if (!allow(user, "users", "write")) return deny(request);
    return revokeUserSessions(url.pathname.split("/")[3], request, env, user);
  }
  if (url.pathname.startsWith("/api/users/") && request.method === "PATCH") {
    if (!allow(user, "users", "write")) return deny(request);
    return patchUser(url.pathname.split("/")[3], request, env, user);
  }

  if (url.pathname === "/api/sample" && request.method === "GET") {
    if (user.role !== "owner") return deny(request);
    return sampleStatus(env, request);
  }
  if (url.pathname === "/api/sample/remove" && request.method === "POST") {
    if (user.role !== "owner") return deny(request);
    return removeSample(request, env, user);
  }
  if (url.pathname === "/api/audit" && request.method === "GET") {
    if (!allow(user, "audit", "read")) return deny(request);
    return listAudit(env, request);
  }

  return json({ error: "Not found." }, 404, request);
}

function allow(user, resource, action) {
  const rule = ACL[resource];
  if (!rule) return false;
  return (rule[action] || []).includes(user.role);
}

function deny(request) {
  return json({ error: "You do not have access to this." }, 403, request);
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    title: user.title,
    mustChangePassword: Boolean(user.must_change_password),
    isSample: Boolean(user.is_sample),
    isActive: user.is_active !== 0
  };
}

function originAllowed(request) {
  const origin = request.headers.get("Origin") || "";
  return !origin || ALLOWED_ORIGINS.includes(origin);
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin",
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer"
  };
}

function cors(response, request) {
  const headers = corsHeaders(request);
  const next = new Response(response.body, response);
  for (const [key, value] of Object.entries(headers)) next.headers.set(key, value);
  return next;
}

function json(body, status, request) {
  return cors(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    }),
    request
  );
}

function fileResponse(body, filename, type, request) {
  return cors(
    new Response(body, {
      status: 200,
      headers: {
        "Content-Type": type,
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    }),
    request
  );
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function todayISO() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());
}

function nowTime() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false
  }).format(new Date());
}

function isoNow() {
  return new Date().toISOString();
}

function randomId() {
  return crypto.randomUUID();
}

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  const clean = hex.length % 2 === 0 ? hex : `0${hex}`;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function sha256Hex(text) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return bytesToHex(hash);
}

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hashPassword(password, saltHex) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: hexToBytes(saltHex), iterations: PBKDF2_ITERATIONS },
    key,
    256
  );
  return bytesToHex(bits);
}

function newSalt() {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
}

function validPassword(password) {
  if (typeof password !== "string" || password.length < 10) return "Use at least 10 characters.";
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return "Use both letters and numbers.";
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return "Please choose a less common password.";
  return null;
}

function bearerToken(request) {
  const auth = request.headers.get("Authorization") || "";
  const match = /^Bearer\s+(\S+)/i.exec(auth);
  return match ? match[1] : "";
}

function clientIp(request) {
  const ip = (request.headers.get("CF-Connecting-IP") || "").trim();
  if (ip) return ip;
  const ray = request.headers.get("CF-Ray") || "";
  const country = request.headers.get("CF-IPCountry") || "";
  const ua = request.headers.get("User-Agent") || "";
  return `noip:${country}:${(ray || ua).slice(0, 24)}`;
}

function vStr(value, { label, min = 1, max = 200, required = true } = {}) {
  const text = String(value ?? "").trim();
  if (!text) return required ? { error: `Please enter ${label}.` } : { value: "" };
  if (text.length < min || text.length > max) return { error: `${label[0].toUpperCase()}${label.slice(1)} must be at most ${max} characters.` };
  return { value: text };
}

function vInt(value, { label, min = 0, max = 100000000, required = true, allowNull = false } = {}) {
  if (value === null || value === undefined || value === "") {
    if (allowNull || !required) return { value: null };
    return { error: `Please enter ${label}.` };
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    return { error: `${label[0].toUpperCase()}${label.slice(1)} must be a whole number from ${min} to ${max}.` };
  }
  return { value: n };
}

function vDate(value, { label = "the date", required = true } = {}) {
  const text = String(value ?? "").trim();
  if (!text) return required ? { error: `Please enter ${label}.` } : { value: "" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return { error: `Please enter a valid ${label}.` };
  const [y, m, d] = text.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== m || dt.getUTCDate() !== d) {
    return { error: `Please enter a valid ${label}.` };
  }
  return { value: text };
}

function vTime(value, label = "the time") {
  const text = String(value ?? "").trim();
  if (!/^\d{2}:\d{2}$/.test(text)) return { error: `Please enter a valid ${label}.` };
  const [h, m] = text.split(":").map(Number);
  if (h > 23 || m > 59) return { error: `Please enter a valid ${label}.` };
  return { value: text };
}

function vOneOf(value, options, label) {
  if (!options.includes(value)) return { error: `Please pick a valid ${label}.` };
  return { value };
}

function vContact(value) {
  const text = String(value ?? "").trim();
  if (!text) return { error: "Please enter a valid email or Philippine mobile number." };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) && text.length <= 80) return { value: text };
  const digits = text.replace(/[^\d+]/g, "");
  if (/^(?:\+?63|0)9\d{9}$/.test(digits)) return { value: text };
  return { error: "Please enter a valid email or Philippine mobile number." };
}

function vEmail(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) || text.length > 120) {
    return { error: "Please enter a valid email." };
  }
  return { value: text };
}

function normalizeEventStatus(value) {
  if (!value) return "Confirmed";
  const found = EVENT_STATUSES.find((item) => item.toLowerCase() === String(value).trim().toLowerCase());
  return found || null;
}

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsv(rows, columns) {
  const header = columns.map((col) => csvEscape(col.label)).join(",");
  const lines = (rows || []).map((row) => columns.map((col) => csvEscape(row[col.key])).join(","));
  return `\uFEFF${header}\n${lines.join("\n")}\n`;
}

function toExcelXml(rows, columns, sheetName) {
  const header = columns.map((col) => `<Cell><Data ss:Type="String">${xmlEscape(col.label)}</Data></Cell>`).join("");
  const body = (rows || []).map((row) => {
    const cells = columns.map((col) => `<Cell><Data ss:Type="String">${xmlEscape(row[col.key])}</Data></Cell>`).join("");
    return `<Row>${cells}</Row>`;
  }).join("");
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="${xmlEscape(sheetName)}"><Table><Row>${header}</Row>${body}</Table></Worksheet>
</Workbook>`;
}

function xmlEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

async function audit(env, user, action, entity, entityId, detail, request, isSample = 0) {
  try {
    await env.DB.prepare(
      `INSERT INTO audit_log (id, at, user_id, role, action, entity, entity_id, detail, ip, is_sample)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      randomId(),
      isoNow(),
      user && user.id ? user.id : null,
      user && user.role ? user.role : null,
      action,
      entity,
      entityId || null,
      detail ? String(detail).slice(0, 2000) : null,
      request ? clientIp(request) : null,
      isSample ? 1 : 0
    ).run();
  } catch (err) {
    console.error(JSON.stringify({ level: "warn", message: "audit_failed", error: String(err && err.message ? err.message : err) }));
  }
}

function auditStmt(env, user, action, entity, entityId, detail, request, isSample = 0) {
  return env.DB.prepare(
    `INSERT INTO audit_log (id, at, user_id, role, action, entity, entity_id, detail, ip, is_sample)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    randomId(),
    isoNow(),
    user && user.id ? user.id : null,
    user && user.role ? user.role : null,
    action,
    entity,
    entityId || null,
    detail ? String(detail).slice(0, 2000) : null,
    request ? clientIp(request) : null,
    isSample ? 1 : 0
  );
}

async function expirePendings(env) {
  const cutoff = new Date(Date.now() - PENDING_DAYS * 86400 * 1000).toISOString();
  await env.DB.prepare(
    "UPDATE requests SET status = 'expired' WHERE status = 'pending' AND created_at < ?"
  ).bind(cutoff).run();
}

async function completePastEvents(env) {
  const today = todayISO();
  await env.DB.prepare(
    `UPDATE events SET status = 'Completed'
     WHERE date < ? AND status IN ('Confirmed', 'Setup', 'Booked')`
  ).bind(today).run();
}

async function dateVenueTaken(env, date, venue, exceptId) {
  const venueValue = venue || "Any";
  const except = exceptId || "";
  if (venueValue === "Any") {
    return env.DB.prepare(
      `SELECT id FROM events
       WHERE date = ? AND status IN ('Confirmed', 'Tentative', 'Setup', 'Booked')
         AND IFNULL(is_sample, 0) = 0 AND id != ?
       LIMIT 1`
    ).bind(date, except).first();
  }
  return env.DB.prepare(
    `SELECT id FROM events
     WHERE date = ? AND status IN ('Confirmed', 'Tentative', 'Setup', 'Booked')
       AND IFNULL(is_sample, 0) = 0 AND (venue = ? OR venue = 'Any') AND id != ?
     LIMIT 1`
  ).bind(date, venueValue, except).first();
}

async function bumpFailLimit(env, key, max) {
  const windowStart = String(Math.floor(Date.now() / (LOGIN_WINDOW_MINUTES * 60 * 1000)));
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN window_start = excluded.window_start THEN count + 1 ELSE 1 END,
       window_start = excluded.window_start
     RETURNING count`
  ).bind(key, windowStart).first();
  const count = Number(row && row.count) || 1;
  return { count, blocked: count > max };
}

async function postHourLimit(env, key, max) {
  const hour = isoNow().slice(0, 13);
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN window_start = excluded.window_start THEN count + 1 ELSE 1 END,
       window_start = excluded.window_start
     RETURNING count`
  ).bind(key, hour).first();
  const count = Number(row && row.count) || 1;
  return count <= max;
}

async function verifyTurnstile(env, request, token) {
  const secret = env.TURNSTILE_SECRET;
  if (!secret) return { ok: false, error: "Booking checks are not ready. Please try again in a few minutes." };
  const ip = request.headers.get("CF-Connecting-IP") || "";
  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", String(token || ""));
  if (ip) body.set("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const data = await res.json().catch(() => ({}));
  if (!data.success) return { ok: false, error: "Please confirm you are not a robot, then send again." };
  return { ok: true };
}

async function requireUser(request, env) {
  const token = bearerToken(request);
  if (!token) return json({ error: "Please sign in.", code: "unauthenticated" }, 401, request);
  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare(
    `SELECT s.id AS session_id, s.expires_at, s.last_seen_at, s.created_at AS session_created_at,
            u.id, u.email, u.name, u.role, u.title, u.must_change_password, u.password_set_at,
            u.is_sample, u.is_active
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?`
  ).bind(tokenHash).first();
  if (!row) return json({ error: "Please sign in.", code: "unauthenticated" }, 401, request);
  if (row.expires_at < isoNow()) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(row.session_id).run();
    return json({ error: "Your session has ended. Please sign in again.", code: "session_expired" }, 401, request);
  }
  const lastSeen = Date.parse(row.last_seen_at || row.session_created_at || 0);
  if (Number.isFinite(lastSeen) && Date.now() - lastSeen > SESSION_IDLE_DAYS * 86400 * 1000) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(row.session_id).run();
    return json({ error: "Your session has ended. Please sign in again.", code: "session_expired" }, 401, request);
  }
  if (row.is_active === 0) {
    await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(row.id).run();
    return json({ error: "This account is no longer active.", code: "inactive" }, 403, request);
  }
  if (!row.last_seen_at || Date.now() - Date.parse(row.last_seen_at) > 5 * 60 * 1000) {
    await env.DB.prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").bind(isoNow(), row.session_id).run();
  }
  return row;
}

async function createSession(env, userId) {
  const token = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256Hex(token);
  const id = randomId();
  const now = isoNow();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400 * 1000).toISOString();
  await env.DB.prepare(
    "INSERT INTO sessions (id, token_hash, user_id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(id, tokenHash, userId, now, expiresAt, now).run();
  return { token, expiresAt };
}

async function revokeSessions(env, userId, exceptSessionId) {
  if (exceptSessionId) {
    await env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND id != ?").bind(userId, exceptSessionId).run();
    return;
  }
  await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId).run();
}

async function getCalendar(url, env, request) {
  await expirePendings(env);
  await completePastEvents(env);
  const year = Number(url.searchParams.get("year"));
  const month = Number(url.searchParams.get("month"));
  const thisYear = Number(todayISO().slice(0, 4));
  if (!Number.isInteger(year) || year < thisYear - 2 || year > thisYear + 5 || month < 1 || month > 12) {
    return json({ error: "Please pick a valid month." }, 400, request);
  }
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const end = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
  const events = await env.DB.prepare(
    `SELECT date, status FROM events
     WHERE date >= ? AND date < ? AND IFNULL(is_sample, 0) = 0`
  ).bind(start, end).all();
  const days = {};
  for (const event of events.results || []) {
    if (HELD_STATUSES.has(event.status)) days[event.date] = "booked";
  }
  return json({ year, month, days }, 200, request);
}

async function dateStatus(env, iso) {
  const booked = await env.DB.prepare(
    `SELECT 1 FROM events
     WHERE date = ? AND status IN ('Confirmed', 'Tentative', 'Setup', 'Booked')
       AND IFNULL(is_sample, 0) = 0
     LIMIT 1`
  ).bind(iso).first();
  return booked ? "booked" : "available";
}

async function createPublicRequest(request, env) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  await expirePendings(env);
  const ip = clientIp(request);
  if (!(await postHourLimit(env, `req:${ip}`, MAX_PUBLIC_POSTS_PER_HOUR))) {
    return json({ error: "Please wait a little before sending another request." }, 429, request);
  }
  const body = await readJson(request);
  if (!body) return json({ error: "Please complete the form." }, 400, request);
  if (String(body.company || body.website || "").trim()) {
    return json({ error: "Please complete the form." }, 400, request);
  }
  const turned = await verifyTurnstile(env, request, body.turnstileToken);
  if (!turned.ok) return json({ error: turned.error }, 400, request);
  const date = vDate(body.date, { label: "a date" });
  const name = vStr(body.name, { label: "your name", max: 80 });
  const contact = vContact(body.contact);
  const type = vOneOf(String(body.type || "").trim(), EVENT_TYPES, "event type");
  const venue = vOneOf(String(body.venue || "Any").trim(), VENUES, "venue");
  const pax = vInt(body.pax, { label: "the number of guests", min: 1, max: 500 });
  const notes = vStr(body.notes, { label: "notes", required: false, max: 500 });
  const pkg = vStr(body.package, { label: "package", required: false, max: 80 });
  for (const field of [date, name, contact, type, venue, pax, notes, pkg]) {
    if (field.error) return json({ error: field.error }, 400, request);
  }
  if (date.value < todayISO()) {
    return json({ error: "Please pick a future available date." }, 400, request);
  }
  if (await dateStatus(env, date.value) === "booked") {
    return json({ error: "That date is no longer available. Please pick another." }, 409, request);
  }
  const pendingCount = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM requests WHERE date = ? AND status = 'pending' AND IFNULL(is_sample, 0) = 0"
  ).bind(date.value).first();
  if (Number(pendingCount && pendingCount.n) >= PENDING_PER_DATE) {
    return json({ error: "Too many requests are already waiting for that date. Please pick another day or try again later." }, 429, request);
  }
  const id = randomId();
  await env.DB.prepare(
    `INSERT INTO requests (id, date, name, contact, type, pax, venue, notes, package, status, created_at, is_sample)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, 0)`
  ).bind(id, date.value, name.value, contact.value, type.value, pax.value, venue.value, notes.value, pkg.value, isoNow()).run();
  return json({ ok: true, id, date: date.value, status: "pending" }, 201, request);
}

async function setupOwner(request, env) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  if (!(await postHourLimit(env, `setup:${clientIp(request)}`, 8))) {
    return json({ error: "Please wait a little and try again." }, 429, request);
  }
  const body = await readJson(request);
  if (!body) return json({ error: "Please complete the form." }, 400, request);
  const token = String(body.token || "").trim();
  const name = vStr(body.name, { label: "your name", max: 80 });
  const email = vEmail(body.email);
  const password = String(body.password || "");
  if (!token) return json({ error: "Please enter your name, email, and the setup code." }, 400, request);
  if (name.error) return json({ error: name.error }, 400, request);
  if (email.error) return json({ error: email.error }, 400, request);
  const pwdError = validPassword(password);
  if (pwdError) return json({ error: pwdError }, 400, request);
  const tokenHash = await sha256Hex(token);
  const now = isoNow();
  const used = await env.DB.prepare(
    `UPDATE setup_tokens
     SET used_at = ?
     WHERE purpose = 'owner_setup' AND used_at IS NULL AND expires_at >= ? AND token_hash = ?
     RETURNING id`
  ).bind(now, now, tokenHash).first();
  if (!used) {
    return json({ error: "That setup code is not valid or has already been used." }, 400, request);
  }
  const existingOwner = await env.DB.prepare("SELECT id FROM users WHERE role = 'owner' AND password_hash IS NOT NULL").first();
  if (existingOwner) {
    return json({ error: "The owner account has already been set up. Please sign in." }, 409, request);
  }
  const salt = newSalt();
  const hash = await hashPassword(password, salt);
  const existing = await env.DB.prepare("SELECT id FROM users WHERE role = 'owner'").first();
  const id = existing ? existing.id : randomId();
  if (existing) {
    await env.DB.prepare(
      `UPDATE users SET email = ?, name = ?, title = 'Owner', password_hash = ?, password_salt = ?, password_set_at = ?, must_change_password = 0, is_active = 1 WHERE id = ?`
    ).bind(email.value, name.value, hash, salt, now, id).run();
  } else {
    await env.DB.prepare(
      `INSERT INTO users (id, email, name, role, title, password_hash, password_salt, password_set_at, must_change_password, is_active, created_at)
       VALUES (?, ?, ?, 'owner', 'Owner', ?, ?, ?, 0, 1, ?)`
    ).bind(id, email.value, name.value, hash, salt, now, now).run();
  }
  const session = await createSession(env, id);
  return json({
    ok: true,
    user: { id, email: email.value, name: name.value, role: "owner", title: "Owner", mustChangePassword: false },
    token: session.token,
    expiresAt: session.expiresAt
  }, 200, request);
}

async function login(request, env) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request) || {};
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const ipKey = `loginfail:ip:${clientIp(request)}`;
  const acctKey = `loginfail:acct:${email || "blank"}`;
  const ipState = await env.DB.prepare("SELECT count, window_start FROM rate_limits WHERE key = ?").bind(ipKey).first();
  const acctState = await env.DB.prepare("SELECT count, window_start FROM rate_limits WHERE key = ?").bind(acctKey).first();
  const windowStart = String(Math.floor(Date.now() / (LOGIN_WINDOW_MINUTES * 60 * 1000)));
  const ipCount = ipState && ipState.window_start === windowStart ? Number(ipState.count) : 0;
  const acctCount = acctState && acctState.window_start === windowStart ? Number(acctState.count) : 0;
  const needTurnstile = ipCount >= LOGIN_TURNSTILE_AFTER || acctCount >= LOGIN_TURNSTILE_AFTER;
  if (ipCount >= LOGIN_MAX_PER_IP || acctCount >= LOGIN_MAX_PER_ACCOUNT) {
    return json({ error: "Too many tries. Please wait 15 minutes and try again.", code: "locked" }, 429, request);
  }
  if (needTurnstile) {
    const turned = await verifyTurnstile(env, request, body.turnstileToken);
    if (!turned.ok) {
      return json({ error: turned.error, code: "turnstile_required" }, 401, request);
    }
  }
  const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
  const dummySalt = "00".repeat(16);
  const hash = user && user.password_hash && user.password_salt
    ? await hashPassword(password, user.password_salt)
    : await hashPassword(password, dummySalt);
  const ok = user && user.password_hash && timingSafeEqual(user.password_hash, hash);
  if (!ok) {
    const ipFail = await bumpFailLimit(env, ipKey, LOGIN_MAX_PER_IP);
    const acctFail = await bumpFailLimit(env, acctKey, LOGIN_MAX_PER_ACCOUNT);
    const nextNeed = ipFail.count >= LOGIN_TURNSTILE_AFTER || acctFail.count >= LOGIN_TURNSTILE_AFTER;
    if (ipFail.blocked || acctFail.blocked) {
      return json({ error: "Too many tries. Please wait 15 minutes and try again.", code: "locked" }, 429, request);
    }
    return json({
      error: "Email or password is not right.",
      code: nextNeed ? "turnstile_required" : "auth_failed"
    }, 401, request);
  }
  if (user.is_active === 0) {
    return json({ error: "This account is no longer active.", code: "inactive" }, 403, request);
  }
  if (user.must_change_password && user.password_set_at) {
    const age = Date.now() - Date.parse(user.password_set_at);
    if (Number.isFinite(age) && age > TEMP_PASSWORD_HOURS * 3600 * 1000) {
      return json({
        error: "This temporary password has expired. Ask the owner to set a new one.",
        code: "temp_password_expired"
      }, 403, request);
    }
  }
  const session = await createSession(env, user.id);
  return json({ ok: true, user: publicUser(user), token: session.token, expiresAt: session.expiresAt }, 200, request);
}

async function logout(request, env) {
  const token = bearerToken(request);
  if (token) {
    const tokenHash = await sha256Hex(token);
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
  }
  return json({ ok: true }, 200, request);
}

async function logoutAll(env, request, user) {
  await revokeSessions(env, user.id);
  await audit(env, user, "logout_all", "sessions", user.id, "Signed out everywhere", request);
  return json({ ok: true }, 200, request);
}

async function changePassword(request, env, user) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  if (!body) return json({ error: "Please enter your current and new password." }, 400, request);
  const current = String(body.current || "");
  const next = String(body.next || "");
  const pwdError = validPassword(next);
  if (pwdError) return json({ error: pwdError }, 400, request);
  const row = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first();
  const hash = row && row.password_salt ? await hashPassword(current, row.password_salt) : "";
  if (!row || !timingSafeEqual(row.password_hash || "", hash)) {
    return json({ error: "Your current password is not right." }, 400, request);
  }
  const salt = newSalt();
  const nextHash = await hashPassword(next, salt);
  const now = isoNow();
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE users SET password_hash = ?, password_salt = ?, password_set_at = ?, must_change_password = 0 WHERE id = ?"
    ).bind(nextHash, salt, now, user.id),
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id),
    auditStmt(env, user, "password_change", "users", user.id, "Password changed; sessions revoked", request)
  ]);
  const session = await createSession(env, user.id);
  return json({ ok: true, token: session.token, expiresAt: session.expiresAt }, 200, request);
}

function eventColumns(role) {
  const base = "e.id, e.date, e.client, e.title, e.type, e.package, e.pax, e.venue, e.status, e.from_request, e.created_at, e.created_by, e.is_sample";
  if (role === "owner") return `${base}, e.fee, e.deposit`;
  return base;
}

async function listEvents(env, request, user) {
  await completePastEvents(env);
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "";
  const range = url.searchParams.get("range") || "";
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 200, 1), 500);
  let sql = `SELECT ${eventColumns(user.role)} FROM events e`;
  const clauses = [];
  const params = [];
  if (status && EVENT_STATUSES.includes(status)) {
    clauses.push("e.status = ?");
    params.push(status);
  }
  const today = todayISO();
  if (range === "upcoming") {
    clauses.push("e.date >= ?");
    params.push(today);
  } else if (range === "past") {
    clauses.push("e.date < ?");
    params.push(today);
  }
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) { clauses.push("e.date >= ?"); params.push(from); }
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) { clauses.push("e.date <= ?"); params.push(to); }
  if (q) {
    clauses.push("(LOWER(IFNULL(e.client,'')) LIKE ? OR LOWER(IFNULL(e.title,'')) LIKE ? OR LOWER(IFNULL(e.venue,'')) LIKE ?)");
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (clauses.length) sql += ` WHERE ${clauses.join(" AND ")}`;
  sql += " ORDER BY e.date ASC LIMIT ?";
  params.push(limit);
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json({ events: results || [] }, 200, request);
}

function readEventBody(body, { partial = false } = {}) {
  const out = {};
  if (!partial || body.date !== undefined) {
    const date = vDate(body.date, { label: "a date" });
    if (date.error) return date;
    out.date = date.value;
  }
  if (!partial || body.client !== undefined) {
    const client = vStr(body.client, { label: "the client name", max: 120 });
    if (client.error) return client;
    out.client = client.value;
  }
  if (!partial || body.title !== undefined) {
    const title = vStr(body.title, { label: "the title", max: 160 });
    if (title.error) return title;
    out.title = title.value;
  }
  if (!partial || body.type !== undefined) {
    const type = vOneOf(String(body.type || "").trim(), EVENT_TYPES, "event type");
    if (type.error) return type;
    out.type = type.value;
  }
  if (!partial || body.package !== undefined) {
    const pkg = vStr(body.package, { label: "the package", required: false, max: 80 });
    if (pkg.error) return pkg;
    out.package = pkg.value;
  }
  if (!partial || body.pax !== undefined) {
    const pax = vInt(body.pax, { label: "the guest count", min: 0, max: 2000, required: false, allowNull: true });
    if (pax.error) return pax;
    out.pax = pax.value;
  }
  if (!partial || body.venue !== undefined) {
    const venue = vOneOf(String(body.venue || "Any").trim(), VENUES, "venue");
    if (venue.error) return venue;
    out.venue = venue.value;
  }
  if (!partial || body.status !== undefined) {
    const status = normalizeEventStatus(body.status);
    if (!status) return { error: "Please pick a valid status." };
    out.status = status;
  }
  if (!partial || body.fee !== undefined) {
    const fee = vInt(body.fee, { label: "the fee", min: 0, max: 100000000, required: false, allowNull: true });
    if (fee.error) return fee;
    out.fee = fee.value;
  }
  if (!partial || body.deposit !== undefined) {
    const deposit = vInt(body.deposit, { label: "the deposit", min: 0, max: 100000000, required: false, allowNull: true });
    if (deposit.error) return deposit;
    out.deposit = deposit.value;
  }
  return { value: out };
}

async function createEvent(request, env, user) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  if (!body) return json({ error: "Please enter a date." }, 400, request);
  const parsed = readEventBody(body);
  if (parsed.error) return json({ error: parsed.error }, 400, request);
  const ev = parsed.value;
  ev.status = ev.status || "Confirmed";
  if (HELD_STATUSES.has(ev.status)) {
    const taken = await dateVenueTaken(env, ev.date, ev.venue);
    if (taken) return json({ error: "That date and venue are already held by another event." }, 409, request);
  }
  const id = randomId();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO events (id, date, client, title, type, package, pax, venue, status, fee, deposit, created_at, created_by, is_sample)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
    ).bind(id, ev.date, ev.client, ev.title, ev.type, ev.package || "", ev.pax, ev.venue, ev.status, ev.fee, ev.deposit, isoNow(), user.id),
    auditStmt(env, user, "create", "events", id, `${ev.date} ${ev.client}`, request)
  ]);
  const event = await env.DB.prepare(`SELECT ${eventColumns(user.role)} FROM events e WHERE e.id = ?`).bind(id).first();
  return json({ event }, 201, request);
}

async function patchEvent(id, request, env, user) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  if (!body) return json({ error: "Nothing to update." }, 400, request);
  const existing = await env.DB.prepare("SELECT * FROM events WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Event not found." }, 404, request);
  const parsed = readEventBody(body, { partial: true });
  if (parsed.error) return json({ error: parsed.error }, 400, request);
  const ev = parsed.value;
  const nextDate = ev.date || existing.date;
  const nextVenue = ev.venue || existing.venue;
  const nextStatus = ev.status || existing.status;
  if (HELD_STATUSES.has(nextStatus)) {
    const taken = await dateVenueTaken(env, nextDate, nextVenue, id);
    if (taken) return json({ error: "That date and venue are already held by another event." }, 409, request);
  }
  const fields = Object.keys(ev);
  if (!fields.length) {
    const event = await env.DB.prepare(`SELECT ${eventColumns(user.role)} FROM events e WHERE e.id = ?`).bind(id).first();
    return json({ event }, 200, request);
  }
  const sets = fields.map((field) => `${field} = ?`);
  const values = fields.map((field) => ev[field]);
  values.push(id);
  await env.DB.batch([
    env.DB.prepare(`UPDATE events SET ${sets.join(", ")} WHERE id = ?`).bind(...values),
    auditStmt(env, user, ev.status === "Cancelled" ? "cancel" : "update", "events", id, JSON.stringify(ev), request, existing.is_sample)
  ]);
  const event = await env.DB.prepare(`SELECT ${eventColumns(user.role)} FROM events e WHERE e.id = ?`).bind(id).first();
  return json({ event }, 200, request);
}

async function listRequests(env, request) {
  await expirePendings(env);
  const { results } = await env.DB.prepare(
    `SELECT * FROM requests
     ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 WHEN 'declined' THEN 2 ELSE 3 END, date ASC`
  ).all();
  return json({ requests: results || [] }, 200, request);
}

async function decideRequest(id, request, env, user) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  await expirePendings(env);
  const body = await readJson(request);
  const decision = body && body.decision;
  if (decision !== "approved" && decision !== "declined") {
    return json({ error: "Please approve or decline this request." }, 400, request);
  }
  let reason = "";
  if (decision === "declined") {
    const parsed = vStr(body.reason || body.decline_reason, { label: "a reason", min: 3, max: 500 });
    if (parsed.error) return json({ error: "Please enter a reason for declining." }, 400, request);
    reason = parsed.value;
  }
  const req = await env.DB.prepare("SELECT * FROM requests WHERE id = ?").bind(id).first();
  if (!req || req.status !== "pending") return json({ error: "This request is no longer pending." }, 409, request);
  const now = isoNow();
  if (decision === "approved") {
    const taken = await dateVenueTaken(env, req.date, req.venue);
    if (taken) return json({ error: "That date and venue are already held by another event." }, 409, request);
    const eventId = randomId();
    const statements = [
      env.DB.prepare(
        "UPDATE requests SET status = 'approved', decided_at = ?, decided_by = ?, decline_reason = NULL WHERE id = ? AND status = 'pending'"
      ).bind(now, user.id, id),
      env.DB.prepare(
        `INSERT INTO events (id, date, client, title, type, package, pax, venue, status, fee, deposit, from_request, created_at, created_by, is_sample)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Confirmed', NULL, NULL, ?, ?, ?, ?)`
      ).bind(
        eventId,
        req.date,
        req.name,
        req.type || "Booking request",
        req.type,
        req.package || "From booking request",
        req.pax,
        req.venue || "Any",
        req.id,
        now,
        user.id,
        req.is_sample ? 1 : 0
      ),
      auditStmt(env, user, "approve", "requests", id, `Created event ${eventId}`, request, req.is_sample)
    ];
    const results = await env.DB.batch(statements);
    const changes = results[0] && results[0].meta && results[0].meta.changes;
    if (changes !== 1) return json({ error: "This request is no longer pending." }, 409, request);
  } else {
    const results = await env.DB.batch([
      env.DB.prepare(
        "UPDATE requests SET status = 'declined', decided_at = ?, decided_by = ?, decline_reason = ? WHERE id = ? AND status = 'pending'"
      ).bind(now, user.id, reason, id),
      auditStmt(env, user, "decline", "requests", id, reason, request, req.is_sample)
    ]);
    const changes = results[0] && results[0].meta && results[0].meta.changes;
    if (changes !== 1) return json({ error: "This request is no longer pending." }, 409, request);
  }
  const updated = await env.DB.prepare("SELECT * FROM requests WHERE id = ?").bind(id).first();
  return json({ request: updated }, 200, request);
}

async function listDirectory(env, request) {
  const { results } = await env.DB.prepare(
    "SELECT id, name, role, title, is_sample FROM users WHERE IFNULL(is_active, 1) = 1 ORDER BY name ASC"
  ).all();
  return json({ people: results || [] }, 200, request);
}

async function listShifts(env, request, user) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  const clauses = [];
  const params = [];
  if (user.role === "staff") {
    clauses.push("shifts.staff_id = ?");
    params.push(user.id);
  }
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) { clauses.push("shifts.date >= ?"); params.push(from); }
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) { clauses.push("shifts.date <= ?"); params.push(to); }
  let sql = `SELECT shifts.*, u.name AS staff_name, e.title AS event_title, e.venue AS event_venue, e.client AS event_client
             FROM shifts
             LEFT JOIN users u ON u.id = shifts.staff_id
             LEFT JOIN events e ON e.id = shifts.event_id`;
  if (clauses.length) sql += ` WHERE ${clauses.join(" AND ")}`;
  sql += " ORDER BY shifts.date ASC, shifts.start ASC LIMIT 500";
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json({ shifts: results || [] }, 200, request);
}

async function createShift(request, env, user) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  if (!body) return json({ error: "Please enter the date, staff member, and time." }, 400, request);
  const date = vDate(body.date, { label: "a date" });
  const staffId = vStr(body.staffId, { label: "the staff member", max: 80 });
  const start = vTime(body.start, "start time");
  const end = vTime(body.end, "end time");
  const role = vStr(body.role, { label: "the assignment", required: false, max: 80 });
  const eventId = vStr(body.eventId, { label: "the event", required: false, max: 80 });
  for (const field of [date, staffId, start, end, role, eventId]) {
    if (field.error) return json({ error: field.error }, 400, request);
  }
  const staff = await env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(staffId.value).first();
  if (!staff) return json({ error: "Staff member not found." }, 400, request);
  const id = randomId();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO shifts (id, date, staff_id, start, end, role, event_id, created_at, is_sample)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`
    ).bind(id, date.value, staffId.value, start.value, end.value, role.value, eventId.value || null, isoNow()),
    auditStmt(env, user, "create", "shifts", id, `${date.value} ${staffId.value}`, request)
  ]);
  const shift = await env.DB.prepare("SELECT * FROM shifts WHERE id = ?").bind(id).first();
  return json({ shift }, 201, request);
}

async function patchShift(id, request, env, user) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  const existing = await env.DB.prepare("SELECT * FROM shifts WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Shift not found." }, 404, request);
  const fields = {};
  if (body.date !== undefined) {
    const date = vDate(body.date, { label: "a date" });
    if (date.error) return json({ error: date.error }, 400, request);
    fields.date = date.value;
  }
  if (body.staffId !== undefined) fields.staff_id = String(body.staffId);
  if (body.start !== undefined) {
    const start = vTime(body.start, "start time");
    if (start.error) return json({ error: start.error }, 400, request);
    fields.start = start.value;
  }
  if (body.end !== undefined) {
    const end = vTime(body.end, "end time");
    if (end.error) return json({ error: end.error }, 400, request);
    fields.end = end.value;
  }
  if (body.role !== undefined) fields.role = String(body.role).trim();
  if (body.eventId !== undefined) fields.event_id = body.eventId || null;
  const keys = Object.keys(fields);
  if (!keys.length) return json({ shift: existing }, 200, request);
  await env.DB.batch([
    env.DB.prepare(`UPDATE shifts SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`).bind(...keys.map((k) => fields[k]), id),
    auditStmt(env, user, "update", "shifts", id, JSON.stringify(fields), request, existing.is_sample)
  ]);
  const shift = await env.DB.prepare("SELECT * FROM shifts WHERE id = ?").bind(id).first();
  return json({ shift }, 200, request);
}

async function deleteShift(id, request, env, user) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const existing = await env.DB.prepare("SELECT * FROM shifts WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Shift not found." }, 404, request);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM shifts WHERE id = ?").bind(id),
    auditStmt(env, user, "delete", "shifts", id, existing.date, request, existing.is_sample)
  ]);
  return json({ ok: true }, 200, request);
}

async function listTasks(env, request, user) {
  const clauses = [];
  const params = [];
  if (user.role === "staff") {
    clauses.push("tasks.staff_id = ?");
    params.push(user.id);
  }
  let sql = `SELECT tasks.*, u.name AS staff_name, e.title AS event_title
             FROM tasks
             LEFT JOIN users u ON u.id = tasks.staff_id
             LEFT JOIN events e ON e.id = tasks.event_id`;
  if (clauses.length) sql += ` WHERE ${clauses.join(" AND ")}`;
  sql += " ORDER BY tasks.due ASC LIMIT 500";
  const stmt = params.length ? env.DB.prepare(sql).bind(...params) : env.DB.prepare(sql);
  const { results } = await stmt.all();
  return json({ tasks: results || [] }, 200, request);
}

async function createTask(request, env, user) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  if (!body) return json({ error: "Please enter a task and the staff member." }, 400, request);
  const title = vStr(body.title, { label: "the task", max: 200 });
  const staffId = vStr(body.staffId, { label: "the staff member", max: 80 });
  const due = vDate(body.due, { label: "the due date", required: false });
  const eventId = vStr(body.eventId, { label: "the event", required: false, max: 80 });
  for (const field of [title, staffId, due, eventId]) {
    if (field.error) return json({ error: field.error }, 400, request);
  }
  const id = randomId();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO tasks (id, event_id, staff_id, title, due, status, created_at, is_sample)
       VALUES (?, ?, ?, ?, ?, 'open', ?, 0)`
    ).bind(id, eventId.value || null, staffId.value, title.value, due.value || null, isoNow()),
    auditStmt(env, user, "create", "tasks", id, title.value, request)
  ]);
  const task = await env.DB.prepare("SELECT * FROM tasks WHERE id = ?").bind(id).first();
  return json({ task }, 201, request);
}

async function patchTask(id, request, env, user) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const existing = await env.DB.prepare("SELECT * FROM tasks WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Task not found." }, 404, request);
  if (user.role === "staff" && existing.staff_id !== user.id) return deny(request);
  const body = await readJson(request) || {};
  let status = existing.status;
  if (body.status) status = body.status;
  else status = existing.status === "done" ? "open" : "done";
  if (status !== "open" && status !== "done") return json({ error: "Status must be open or done." }, 400, request);
  await env.DB.prepare("UPDATE tasks SET status = ? WHERE id = ?").bind(status, id).run();
  const task = await env.DB.prepare("SELECT * FROM tasks WHERE id = ?").bind(id).first();
  return json({ task }, 200, request);
}

async function deleteTask(id, request, env, user) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const existing = await env.DB.prepare("SELECT * FROM tasks WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Task not found." }, 404, request);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM tasks WHERE id = ?").bind(id),
    auditStmt(env, user, "delete", "tasks", id, existing.title, request, existing.is_sample)
  ]);
  return json({ ok: true }, 200, request);
}

async function listAttendance(env, request, user) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  const staffId = url.searchParams.get("staff") || "";
  const clauses = [];
  const params = [];
  if (user.role === "staff") {
    clauses.push("attendance.staff_id = ?");
    params.push(user.id);
  } else if (staffId) {
    clauses.push("attendance.staff_id = ?");
    params.push(staffId);
  }
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) { clauses.push("attendance.date >= ?"); params.push(from); }
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) { clauses.push("attendance.date <= ?"); params.push(to); }
  let sql = `SELECT attendance.*, u.name AS staff_name
             FROM attendance
             LEFT JOIN users u ON u.id = attendance.staff_id`;
  if (clauses.length) sql += ` WHERE ${clauses.join(" AND ")}`;
  sql += " ORDER BY attendance.date DESC, staff_name ASC LIMIT 500";
  const stmt = params.length ? env.DB.prepare(sql).bind(...params) : env.DB.prepare(sql);
  const { results } = await stmt.all();
  const rows = results || [];
  if (url.searchParams.get("format") === "csv" && user.role !== "staff") {
    const csv = toCsv(rows, [
      { key: "date", label: "Date" },
      { key: "staff_name", label: "Staff" },
      { key: "time_in", label: "Time in" },
      { key: "time_out", label: "Time out" }
    ]);
    return fileResponse(csv, "attendance.csv", "text/csv; charset=utf-8", request);
  }
  return json({ attendance: rows }, 200, request);
}

async function clock(env, request, user) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const today = todayISO();
  const time = nowTime();
  const open = await env.DB.prepare(
    "SELECT * FROM attendance WHERE staff_id = ? AND date = ? AND time_out IS NULL ORDER BY time_in DESC LIMIT 1"
  ).bind(user.id, today).first();
  if (open) {
    await env.DB.prepare("UPDATE attendance SET time_out = ? WHERE id = ?").bind(time, open.id).run();
  } else {
    await env.DB.prepare(
      "INSERT INTO attendance (id, staff_id, date, time_in, time_out, is_sample) VALUES (?, ?, ?, ?, NULL, 0)"
    ).bind(randomId(), user.id, today, time).run();
  }
  const { results } = await env.DB.prepare(
    "SELECT attendance.*, u.name AS staff_name FROM attendance LEFT JOIN users u ON u.id = attendance.staff_id WHERE attendance.staff_id = ? ORDER BY date DESC"
  ).bind(user.id).all();
  return json({ attendance: results || [] }, 200, request);
}

async function patchAttendance(id, request, env, user) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  if (!body) return json({ error: "Nothing to update." }, 400, request);
  const existing = await env.DB.prepare("SELECT * FROM attendance WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Attendance row not found." }, 404, request);
  const fields = {};
  if (body.time_in !== undefined) {
    const timeIn = vTime(body.time_in, "time in");
    if (timeIn.error) return json({ error: timeIn.error }, 400, request);
    fields.time_in = timeIn.value;
  }
  if (body.time_out !== undefined) {
    if (body.time_out === "" || body.time_out === null) fields.time_out = null;
    else {
      const timeOut = vTime(body.time_out, "time out");
      if (timeOut.error) return json({ error: timeOut.error }, 400, request);
      fields.time_out = timeOut.value;
    }
  }
  if (body.date !== undefined) {
    const date = vDate(body.date, { label: "a date" });
    if (date.error) return json({ error: date.error }, 400, request);
    fields.date = date.value;
  }
  const keys = Object.keys(fields);
  if (!keys.length) return json({ attendance: existing }, 200, request);
  const note = vStr(body.note, { label: "a reason", min: 3, max: 300 });
  if (note.error) return json({ error: note.error }, 400, request);
  await env.DB.batch([
    env.DB.prepare(`UPDATE attendance SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`).bind(...keys.map((k) => fields[k]), id),
    auditStmt(env, user, "correct", "attendance", id, JSON.stringify({ before: { time_in: existing.time_in, time_out: existing.time_out, date: existing.date }, after: fields, note: note.value }), request, existing.is_sample)
  ]);
  const row = await env.DB.prepare(
    "SELECT attendance.*, u.name AS staff_name FROM attendance LEFT JOIN users u ON u.id = attendance.staff_id WHERE attendance.id = ?"
  ).bind(id).first();
  return json({ attendance: row }, 200, request);
}

async function listAnnouncements(env, request) {
  const { results } = await env.DB.prepare("SELECT * FROM announcements ORDER BY date DESC LIMIT 200").all();
  return json({ announcements: results || [] }, 200, request);
}

async function createAnnouncement(request, env, user) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  if (!body) return json({ error: "Please enter a title and message." }, 400, request);
  const title = vStr(body.title, { label: "a title", max: 160 });
  const bodyText = vStr(body.body, { label: "a message", max: 2000 });
  const date = vDate(body.date || todayISO(), { label: "a date" });
  for (const field of [title, bodyText, date]) {
    if (field.error) return json({ error: field.error }, 400, request);
  }
  const id = randomId();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO announcements (id, date, title, body, created_at, created_by, is_sample) VALUES (?, ?, ?, ?, ?, ?, 0)"
    ).bind(id, date.value, title.value, bodyText.value, isoNow(), user.id),
    auditStmt(env, user, "create", "announcements", id, title.value, request)
  ]);
  const item = await env.DB.prepare("SELECT * FROM announcements WHERE id = ?").bind(id).first();
  return json({ announcement: item }, 201, request);
}

async function listFinances(env, request) {
  const { results } = await env.DB.prepare(
    "SELECT id, date, client, title, fee, deposit, status, is_sample FROM events ORDER BY date ASC"
  ).all();
  const events = results || [];
  const real = events.filter((event) => !event.is_sample);
  const sample = events.filter((event) => event.is_sample);
  const sum = (rows) => ({
    fees: rows.reduce((total, event) => total + (event.fee || 0), 0),
    deposits: rows.reduce((total, event) => total + (event.deposit || 0), 0)
  });
  const realSum = sum(real);
  const sampleSum = sum(sample);
  return json({
    events,
    totals: { ...realSum, balance: realSum.fees - realSum.deposits },
    sampleTotals: { ...sampleSum, balance: sampleSum.fees - sampleSum.deposits },
    includesSample: sample.length > 0
  }, 200, request);
}

async function listUsers(env, request) {
  const { results } = await env.DB.prepare(
    "SELECT id, email, name, role, title, created_at, password_set_at, is_sample, is_active FROM users ORDER BY name ASC"
  ).all();
  return json({ users: results || [] }, 200, request);
}

async function createUser(request, env, actor) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  if (!body) return json({ error: "Please complete the form." }, 400, request);
  const name = vStr(body.name, { label: "the name", max: 80 });
  const email = vEmail(body.email);
  const title = vStr(body.title, { label: "the title", required: false, max: 80 });
  const role = vOneOf(String(body.role || "staff"), ["owner", "admin", "staff"], "role");
  const password = String(body.password || "");
  for (const field of [name, email, title, role]) {
    if (field.error) return json({ error: field.error }, 400, request);
  }
  const pwdError = validPassword(password);
  if (pwdError) return json({ error: pwdError }, 400, request);
  const exists = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email.value).first();
  if (exists) return json({ error: "That email already has an account." }, 409, request);
  const salt = newSalt();
  const hash = await hashPassword(password, salt);
  const id = randomId();
  const now = isoNow();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO users (id, email, name, role, title, password_hash, password_salt, password_set_at, must_change_password, is_active, is_sample, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 0, ?)`
    ).bind(id, email.value, name.value, role.value, title.value, hash, salt, now, now),
    auditStmt(env, actor, "create", "users", id, `${email.value} ${role.value}`, request)
  ]);
  const user = await env.DB.prepare(
    "SELECT id, email, name, role, title, created_at, is_sample, is_active FROM users WHERE id = ?"
  ).bind(id).first();
  return json({ user }, 201, request);
}

async function patchUser(id, request, env, actor) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  if (!body) return json({ error: "Nothing to update." }, 400, request);
  const existing = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "User not found." }, 404, request);
  if (existing.role === "owner" && body.role && body.role !== "owner" && existing.id === actor.id) {
    return json({ error: "You cannot remove your own owner role." }, 400, request);
  }
  const updates = [];
  const values = [];
  let revoke = false;
  if (body.name) {
    const name = vStr(body.name, { label: "the name", max: 80 });
    if (name.error) return json({ error: name.error }, 400, request);
    updates.push("name = ?");
    values.push(name.value);
  }
  if (body.title !== undefined) {
    updates.push("title = ?");
    values.push(String(body.title || "").trim());
  }
  if (body.role) {
    const role = vOneOf(body.role, ["owner", "admin", "staff"], "role");
    if (role.error) return json({ error: role.error }, 400, request);
    updates.push("role = ?");
    values.push(role.value);
    if (role.value !== existing.role) revoke = true;
  }
  if (body.is_active !== undefined) {
    const active = body.is_active ? 1 : 0;
    updates.push("is_active = ?");
    values.push(active);
    if (active === 0) revoke = true;
  }
  if (body.password) {
    const pwdError = validPassword(String(body.password));
    if (pwdError) return json({ error: pwdError }, 400, request);
    const salt = newSalt();
    const hash = await hashPassword(String(body.password), salt);
    updates.push("password_hash = ?", "password_salt = ?", "password_set_at = ?", "must_change_password = 1");
    values.push(hash, salt, isoNow());
    revoke = true;
  }
  if (!updates.length) return json({ user: publicUser(existing) }, 200, request);
  values.push(id);
  const statements = [
    env.DB.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).bind(...values),
    auditStmt(env, actor, "update", "users", id, JSON.stringify({ ...body, password: body.password ? "[set]" : undefined }), request, existing.is_sample)
  ];
  if (revoke) statements.push(env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id));
  await env.DB.batch(statements);
  const user = await env.DB.prepare(
    "SELECT id, email, name, role, title, created_at, is_sample, is_active FROM users WHERE id = ?"
  ).bind(id).first();
  return json({ user }, 200, request);
}

async function revokeUserSessions(id, request, env, actor) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  await revokeSessions(env, id);
  await audit(env, actor, "logout_all", "sessions", id, "Owner signed this user out everywhere", request);
  return json({ ok: true }, 200, request);
}

async function sampleStatus(env, request) {
  const tables = ["users", "events", "requests", "shifts", "tasks", "announcements", "attendance"];
  const counts = {};
  let hasSample = false;
  for (const table of tables) {
    const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE IFNULL(is_sample, 0) = 1`).first();
    counts[table] = Number(row && row.n) || 0;
    if (counts[table]) hasSample = true;
  }
  return json({ hasSample, counts }, 200, request);
}

async function removeSample(request, env, user) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const blockers = await env.DB.prepare(
    `SELECT 'events' AS src, id FROM events WHERE IFNULL(is_sample, 0) = 0 AND created_by IN (SELECT id FROM users WHERE is_sample = 1)
     UNION ALL
     SELECT 'requests', id FROM requests WHERE IFNULL(is_sample, 0) = 0 AND decided_by IN (SELECT id FROM users WHERE is_sample = 1)
     UNION ALL
     SELECT 'shifts', id FROM shifts WHERE IFNULL(is_sample, 0) = 0 AND staff_id IN (SELECT id FROM users WHERE is_sample = 1)
     UNION ALL
     SELECT 'tasks', id FROM tasks WHERE IFNULL(is_sample, 0) = 0 AND staff_id IN (SELECT id FROM users WHERE is_sample = 1)
     UNION ALL
     SELECT 'attendance', id FROM attendance WHERE IFNULL(is_sample, 0) = 0 AND staff_id IN (SELECT id FROM users WHERE is_sample = 1)`
  ).all();
  const found = blockers.results || [];
  if (found.length) {
    return json({
      error: "Some real records still refer to a sample staff account. Please reassign or edit those first.",
      code: "sample_in_use",
      references: found.slice(0, 20)
    }, 409, request);
  }
  const results = await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE IFNULL(is_sample, 0) = 1 AND role != 'owner')"),
    env.DB.prepare("DELETE FROM attendance WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM tasks WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM shifts WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM announcements WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM events WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM requests WHERE IFNULL(is_sample, 0) = 1"),
    env.DB.prepare("DELETE FROM users WHERE IFNULL(is_sample, 0) = 1 AND role != 'owner'"),
    auditStmt(env, user, "remove_sample", "sample", null, "Owner removed sample data", request)
  ]);
  const failed = results.some((row) => row && row.success === false);
  if (failed) return json({ error: "Could not remove all sample data. Please try again." }, 500, request);
  return sampleStatus(env, request);
}

async function listAudit(env, request) {
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 200, 1), 500);
  const { results } = await env.DB.prepare(
    "SELECT * FROM audit_log ORDER BY at DESC LIMIT ?"
  ).bind(limit).all();
  return json({ entries: results || [] }, 200, request);
}

async function exportReport(url, env, request, user) {
  const table = url.searchParams.get("table") || "";
  const format = url.searchParams.get("format") || "csv";
  const allow = {
    events: user.role === "owner" || user.role === "admin",
    requests: user.role === "owner" || user.role === "admin",
    attendance: user.role === "owner" || user.role === "admin",
    finances: user.role === "owner"
  };
  if (!allow[table]) return json({ error: "Please pick a report you can download." }, 400, request);
  let rows = [];
  let columns = [];
  if (table === "events") {
    const sql = user.role === "owner"
      ? "SELECT date, client, title, type, package, pax, venue, status, fee, deposit, is_sample FROM events WHERE IFNULL(is_sample,0)=0 ORDER BY date"
      : "SELECT date, client, title, type, package, pax, venue, status, is_sample FROM events WHERE IFNULL(is_sample,0)=0 ORDER BY date";
    rows = (await env.DB.prepare(sql).all()).results || [];
    columns = [
      { key: "date", label: "Date" }, { key: "client", label: "Client" }, { key: "title", label: "Title" },
      { key: "type", label: "Type" }, { key: "package", label: "Package" }, { key: "pax", label: "Pax" },
      { key: "venue", label: "Venue" }, { key: "status", label: "Status" }
    ];
    if (user.role === "owner") {
      columns.push({ key: "fee", label: "Fee" }, { key: "deposit", label: "Deposit" });
    }
  } else if (table === "requests") {
    rows = (await env.DB.prepare(
      "SELECT date, name, contact, type, package, pax, venue, status, created_at, decline_reason, is_sample FROM requests WHERE IFNULL(is_sample,0)=0 ORDER BY date"
    ).all()).results || [];
    columns = [
      { key: "date", label: "Event date" }, { key: "name", label: "Name" }, { key: "contact", label: "Contact" },
      { key: "type", label: "Type" }, { key: "package", label: "Package" }, { key: "pax", label: "Pax" },
      { key: "venue", label: "Venue" }, { key: "status", label: "Status" }, { key: "created_at", label: "Submitted" },
      { key: "decline_reason", label: "Decline reason" }
    ];
  } else if (table === "attendance") {
    rows = (await env.DB.prepare(
      `SELECT attendance.date, u.name AS staff_name, attendance.time_in, attendance.time_out
       FROM attendance LEFT JOIN users u ON u.id = attendance.staff_id
       WHERE IFNULL(attendance.is_sample,0)=0
       ORDER BY attendance.date DESC`
    ).all()).results || [];
    columns = [
      { key: "date", label: "Date" }, { key: "staff_name", label: "Staff" },
      { key: "time_in", label: "Time in" }, { key: "time_out", label: "Time out" }
    ];
  } else if (table === "finances") {
    rows = (await env.DB.prepare(
      "SELECT date, client, title, fee, deposit, status FROM events WHERE IFNULL(is_sample,0)=0 ORDER BY date"
    ).all()).results || [];
    columns = [
      { key: "date", label: "Date" }, { key: "client", label: "Client" }, { key: "title", label: "Title" },
      { key: "fee", label: "Fee" }, { key: "deposit", label: "Deposit" }, { key: "status", label: "Status" }
    ];
  }
  await audit(env, user, "export", table, null, `${format} download`, request);
  if (format === "xlsx") {
    return fileResponse(toExcelXml(rows, columns, table), `${table}.xls`, "application/vnd.ms-excel", request);
  }
  return fileResponse(toCsv(rows, columns), `${table}.csv`, "text/csv; charset=utf-8", request);
}
