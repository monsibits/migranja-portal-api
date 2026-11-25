/**
 * Mi Granja staff portal and booking API.
 * Data lives in a private D1 database. Secrets are Worker bindings, never in source.
 */

const ALLOWED_ORIGINS = [
  "https://www.migranjaevents.com",
  "https://migranjaevents.com"
];

const COOKIE = "mg_session";
const TZ = "Asia/Manila";
const PBKDF2_ITERATIONS = 100000;
const SESSION_DAYS = 30;
const MAX_PUBLIC_POSTS_PER_HOUR = 8;
const HELD_STATUSES = new Set(["Confirmed", "Tentative", "Setup", "Booked"]);
const ACL = {
  events: { read: ["owner", "admin"], write: ["owner", "admin"] },
  requests: { read: ["owner", "admin"], write: ["owner", "admin"] },
  schedule: { read: ["owner", "admin", "staff"], write: ["owner", "admin"] },
  tasks: { read: ["owner", "admin", "staff"], write: ["owner", "admin"] },
  attendance: { read: ["owner", "admin", "staff"], write: ["owner", "admin", "staff"] },
  announcements: { read: ["owner", "admin", "staff"], write: ["owner", "admin"] },
  finances: { read: ["owner"], write: ["owner"] },
  users: { read: ["owner"], write: ["owner"] }
};

export default {
  async fetch(request, env) {
    try {
      return await handle(request, env);
    } catch (err) {
      console.error(JSON.stringify({ level: "error", message: String(err && err.message ? err.message : err) }));
      return json({ error: "Something went wrong. Please try again." }, 500, request);
    }
  }
};

async function handle(request, env) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }), request);

  if (url.pathname === "/api/health" && request.method === "GET") {
    return json({ ok: true }, 200, request);
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
  if (url.pathname === "/api/auth/me" && request.method === "GET") {
    const user = await requireUser(request, env);
    if (user instanceof Response) return user;
    return json({ user: publicUser(user) }, 200, request);
  }
  if (url.pathname === "/api/auth/password" && request.method === "POST") {
    return changePassword(request, env);
  }

  const user = await requireUser(request, env);
  if (user instanceof Response) return user;

  if (url.pathname === "/api/events" && request.method === "GET") {
    if (!allow(user, "events", "read")) return deny(request);
    return listEvents(env, request);
  }
  if (url.pathname === "/api/events" && request.method === "POST") {
    if (!allow(user, "events", "write")) return deny(request);
    return createEvent(request, env, user);
  }
  if (url.pathname.startsWith("/api/events/") && request.method === "PATCH") {
    if (!allow(user, "events", "write")) return deny(request);
    return patchEvent(url.pathname.split("/").pop(), request, env);
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
    return createShift(request, env);
  }

  if (url.pathname === "/api/tasks" && request.method === "GET") {
    if (!allow(user, "tasks", "read")) return deny(request);
    return listTasks(env, request, user);
  }
  if (url.pathname === "/api/tasks" && request.method === "POST") {
    if (!allow(user, "tasks", "write")) return deny(request);
    return createTask(request, env);
  }
  if (url.pathname.startsWith("/api/tasks/") && request.method === "PATCH") {
    return patchTask(url.pathname.split("/").pop(), request, env, user);
  }

  if (url.pathname === "/api/attendance" && request.method === "GET") {
    if (!allow(user, "attendance", "read")) return deny(request);
    return listAttendance(env, request, user);
  }
  if (url.pathname === "/api/attendance/clock" && request.method === "POST") {
    if (!allow(user, "attendance", "write")) return deny(request);
    return clock(env, request, user);
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

  if (url.pathname === "/api/users" && request.method === "GET") {
    if (!allow(user, "users", "read")) return deny(request);
    return listUsers(env, request);
  }
  if (url.pathname === "/api/users" && request.method === "POST") {
    if (!allow(user, "users", "write")) return deny(request);
    return createUser(request, env);
  }
  if (url.pathname.startsWith("/api/users/") && request.method === "PATCH") {
    if (!allow(user, "users", "write")) return deny(request);
    return patchUser(url.pathname.split("/").pop(), request, env, user);
  }

  return json({ error: "Not found" }, 404, request);
}

function allow(user, resource, action) {
  return (ACL[resource] && ACL[resource][action] || []).includes(user.role);
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
    mustChangePassword: Boolean(user.must_change_password)
  };
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "Cache-Control": "no-store"
  };
}

function cors(response, request) {
  const headers = corsHeaders(request);
  for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
  return response;
}

function json(body, status, request) {
  return cors(new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  }), request);
}

function originAllowed(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin);
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
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function nowTime() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
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

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(hash);
}

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const encoder = new TextEncoder();
  const aa = encoder.encode(a);
  const bb = encoder.encode(b);
  if (aa.length !== bb.length) return false;
  let out = 0;
  for (let i = 0; i < aa.length; i += 1) out |= aa[i] ^ bb[i];
  return out === 0;
}

async function hashPassword(password, saltHex) {
  const salt = hexToBytes(saltHex);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    key,
    256
  );
  return bytesToHex(bits);
}

function hexToBytes(hex) {
  const clean = hex.length % 2 === 0 ? hex : `0${hex}`;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function newSalt() {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
}

function validPassword(password) {
  if (typeof password !== "string" || password.length < 10) {
    return "Use at least 10 characters.";
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Use both letters and numbers.";
  }
  return null;
}

function cookieFrom(request, name) {
  const header = request.headers.get("Cookie") || "";
  const parts = header.split(";").map((p) => p.trim());
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx) === name) return decodeURIComponent(part.slice(idx + 1));
  }
  return "";
}

function sessionIdFromRequest(request) {
  const auth = request.headers.get("Authorization") || "";
  const match = /^Bearer\s+(\S+)/i.exec(auth);
  if (match) return match[1];
  return cookieFrom(request, COOKIE);
}

async function requireUser(request, env) {
  const sessionId = sessionIdFromRequest(request);
  if (!sessionId) return json({ error: "Please sign in.", code: "unauthenticated" }, 401, request);
  const row = await env.DB.prepare(
    `SELECT s.id AS session_id, s.expires_at, u.id, u.email, u.name, u.role, u.title, u.must_change_password
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = ?`
  ).bind(sessionId).first();
  if (!row) return json({ error: "Please sign in.", code: "unauthenticated" }, 401, request);
  if (row.expires_at < isoNow()) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
    return json({ error: "Your session has ended. Please sign in again.", code: "session_expired" }, 401, request);
  }
  return row;
}

async function getCalendar(url, env, request) {
  const year = Number(url.searchParams.get("year"));
  const month = Number(url.searchParams.get("month"));
  if (!year || month < 1 || month > 12) {
    return json({ error: "Please pick a valid month." }, 400, request);
  }
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const end = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
  const events = await env.DB.prepare(
    "SELECT date, status FROM events WHERE date >= ? AND date < ?"
  ).bind(start, end).all();
  const requests = await env.DB.prepare(
    "SELECT date, status FROM requests WHERE date >= ? AND date < ? AND status = 'pending'"
  ).bind(start, end).all();
  const days = {};
  for (const event of events.results || []) {
    if (HELD_STATUSES.has(event.status)) days[event.date] = "booked";
  }
  for (const req of requests.results || []) {
    if (!days[req.date]) days[req.date] = "pending";
  }
  return json({ year, month, days }, 200, request);
}

async function rateLimit(env, key) {
  const hour = isoNow().slice(0, 13);
  const row = await env.DB.prepare("SELECT count, window_start FROM rate_limits WHERE key = ?").bind(key).first();
  if (!row || row.window_start !== hour) {
    await env.DB.prepare(
      "INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = 1, window_start = ?"
    ).bind(key, hour, hour).run();
    return true;
  }
  if (row.count >= MAX_PUBLIC_POSTS_PER_HOUR) return false;
  await env.DB.prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?").bind(key).run();
  return true;
}

async function createPublicRequest(request, env) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (!(await rateLimit(env, `req:${ip}`))) {
    return json({ error: "Please wait a little before sending another request." }, 429, request);
  }
  const body = await readJson(request);
  if (!body) return json({ error: "Please complete the form." }, 400, request);
  const date = String(body.date || "").trim();
  const name = String(body.name || "").trim();
  const contact = String(body.contact || "").trim();
  const type = String(body.type || "").trim();
  const venue = String(body.venue || "Any").trim();
  const notes = String(body.notes || "").trim().slice(0, 500);
  const pax = Number(body.pax);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < todayISO()) {
    return json({ error: "Please pick a future available date." }, 400, request);
  }
  if (!name || name.length > 80 || !contact || contact.length > 80) {
    return json({ error: "Please enter your name and a mobile number or email." }, 400, request);
  }
  if (!type || Number.isNaN(pax) || pax < 1 || pax > 500) {
    return json({ error: "Please enter the event type and number of guests." }, 400, request);
  }
  const status = await dateStatus(env, date);
  if (status !== "available") {
    return json({ error: "That date is no longer available. Please pick another." }, 409, request);
  }
  const id = randomId();
  await env.DB.prepare(
    `INSERT INTO requests (id, date, name, contact, type, pax, venue, notes, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
  ).bind(id, date, name, contact, type, pax, venue, notes, isoNow()).run();
  return json({ ok: true, id, date, status: "pending" }, 201, request);
}

async function dateStatus(env, iso) {
  const booked = await env.DB.prepare(
    "SELECT 1 FROM events WHERE date = ? AND status IN ('Confirmed', 'Tentative', 'Setup', 'Booked') LIMIT 1"
  ).bind(iso).first();
  if (booked) return "booked";
  const pending = await env.DB.prepare(
    "SELECT 1 FROM requests WHERE date = ? AND status = 'pending' LIMIT 1"
  ).bind(iso).first();
  if (pending) return "pending";
  return "available";
}

async function setupOwner(request, env) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (!(await rateLimit(env, `setup:${ip}`))) {
    return json({ error: "Please wait a little and try again." }, 429, request);
  }
  const body = await readJson(request);
  if (!body) return json({ error: "Please complete the form." }, 400, request);
  const token = String(body.token || "").trim();
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!token || !name || !email || !email.includes("@")) {
    return json({ error: "Please enter your name, email, and the setup code." }, 400, request);
  }
  const pwdError = validPassword(password);
  if (pwdError) return json({ error: pwdError }, 400, request);
  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare(
    "SELECT id, token_hash, expires_at, used_at FROM setup_tokens WHERE purpose = 'owner_setup' AND used_at IS NULL ORDER BY created_at DESC LIMIT 1"
  ).first();
  if (!row || row.expires_at < isoNow() || !timingSafeEqual(row.token_hash, tokenHash)) {
    return json({ error: "That setup code is not valid or has already been used." }, 400, request);
  }
  const existingOwner = await env.DB.prepare("SELECT id FROM users WHERE role = 'owner' AND password_hash IS NOT NULL").first();
  if (existingOwner) {
    return json({ error: "The owner account has already been set up. Please sign in." }, 409, request);
  }
  const salt = newSalt();
  const hash = await hashPassword(password, salt);
  const now = isoNow();
  const existing = await env.DB.prepare("SELECT id FROM users WHERE role = 'owner'").first();
  const id = existing ? existing.id : randomId();
  if (existing) {
    await env.DB.prepare(
      `UPDATE users SET email = ?, name = ?, title = 'Owner', password_hash = ?, password_salt = ?, password_set_at = ?, must_change_password = 0 WHERE id = ?`
    ).bind(email, name, hash, salt, now, id).run();
  } else {
    await env.DB.prepare(
      `INSERT INTO users (id, email, name, role, title, password_hash, password_salt, password_set_at, must_change_password, created_at)
       VALUES (?, ?, ?, 'owner', 'Owner', ?, ?, ?, 0, ?)`
    ).bind(id, email, name, hash, salt, now, now).run();
  }
  await env.DB.prepare("UPDATE setup_tokens SET used_at = ? WHERE id = ?").bind(now, row.id).run();
  const session = await createSession(env, id);
  return json({ ok: true, user: { id, email, name, role: "owner", title: "Owner", mustChangePassword: false }, token: session.id, expiresAt: session.expiresAt }, 200, request);
}

async function login(request, env) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (!(await rateLimit(env, `login:${ip}`))) {
    return json({ error: "Too many tries. Please wait a little and try again." }, 429, request);
  }
  const body = await readJson(request);
  if (!body) return json({ error: "Please enter your email and password." }, 400, request);
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
  const dummySalt = "00".repeat(16);
  const hash = user && user.password_hash && user.password_salt
    ? await hashPassword(password, user.password_salt)
    : await hashPassword(password, dummySalt);
  const ok = user && user.password_hash && timingSafeEqual(user.password_hash, hash);
  if (!ok) return json({ error: "Email or password is not right." }, 401, request);
  const session = await createSession(env, user.id);
  return json({ ok: true, user: publicUser(user), token: session.id, expiresAt: session.expiresAt }, 200, request);
}

async function createSession(env, userId) {
  const id = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400 * 1000).toISOString();
  await env.DB.prepare(
    "INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
  ).bind(id, userId, isoNow(), expiresAt).run();
  return { id, expiresAt };
}

async function logout(request, env) {
  const sessionId = sessionIdFromRequest(request);
  if (sessionId) await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
  return json({ ok: true }, 200, request);
}

async function changePassword(request, env) {
  const user = await requireUser(request, env);
  if (user instanceof Response) return user;
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
  await env.DB.prepare(
    "UPDATE users SET password_hash = ?, password_salt = ?, password_set_at = ?, must_change_password = 0 WHERE id = ?"
  ).bind(nextHash, salt, isoNow(), user.id).run();
  return json({ ok: true }, 200, request);
}

async function listEvents(env, request) {
  const { results } = await env.DB.prepare("SELECT * FROM events ORDER BY date ASC").all();
  return json({ events: results || [] }, 200, request);
}

async function createEvent(request, env, user) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  if (!body || !/^\d{4}-\d{2}-\d{2}$/.test(String(body.date || ""))) {
    return json({ error: "Please enter a date." }, 400, request);
  }
  const id = randomId();
  await env.DB.prepare(
    `INSERT INTO events (id, date, client, title, type, package, pax, venue, status, fee, deposit, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    String(body.date),
    String(body.client || "").trim(),
    String(body.title || "").trim(),
    String(body.type || "").trim(),
    String(body.package || "").trim(),
    Number(body.pax) || 0,
    String(body.venue || "").trim(),
    String(body.status || "Confirmed"),
    body.fee === null || body.fee === "" ? null : Number(body.fee),
    body.deposit === null || body.deposit === "" ? null : Number(body.deposit),
    isoNow(),
    user.id
  ).run();
  const event = await env.DB.prepare("SELECT * FROM events WHERE id = ?").bind(id).first();
  return json({ event }, 201, request);
}

async function patchEvent(id, request, env) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  if (!body) return json({ error: "Nothing to update." }, 400, request);
  const existing = await env.DB.prepare("SELECT * FROM events WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Event not found." }, 404, request);
  const fields = ["date", "client", "title", "type", "package", "pax", "venue", "status", "fee", "deposit"];
  const updates = [];
  const values = [];
  for (const field of fields) {
    if (body[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(body[field]);
    }
  }
  if (!updates.length) return json({ event: existing }, 200, request);
  values.push(id);
  await env.DB.prepare(`UPDATE events SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();
  const event = await env.DB.prepare("SELECT * FROM events WHERE id = ?").bind(id).first();
  return json({ event }, 200, request);
}

async function listRequests(env, request) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM requests ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, date ASC"
  ).all();
  return json({ requests: results || [] }, 200, request);
}

async function decideRequest(id, request, env, user) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  const decision = body && body.decision;
  if (decision !== "approved" && decision !== "declined") {
    return json({ error: "Please approve or decline this request." }, 400, request);
  }
  const req = await env.DB.prepare("SELECT * FROM requests WHERE id = ?").bind(id).first();
  if (!req || req.status !== "pending") return json({ error: "This request is no longer pending." }, 409, request);
  const now = isoNow();
  await env.DB.prepare(
    "UPDATE requests SET status = ?, decided_at = ?, decided_by = ? WHERE id = ?"
  ).bind(decision, now, user.id, id).run();
  if (decision === "approved") {
    await env.DB.prepare(
      `INSERT INTO events (id, date, client, title, type, package, pax, venue, status, fee, deposit, from_request, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Confirmed', NULL, NULL, ?, ?, ?)`
    ).bind(
      randomId(),
      req.date,
      req.name,
      req.type || "Booking request",
      req.type,
      "From booking request",
      req.pax,
      req.venue || "To be assigned",
      req.id,
      now,
      user.id
    ).run();
  }
  const updated = await env.DB.prepare("SELECT * FROM requests WHERE id = ?").bind(id).first();
  return json({ request: updated }, 200, request);
}

async function listShifts(env, request, user) {
  const sql = user.role === "staff"
    ? "SELECT * FROM shifts WHERE staff_id = ? ORDER BY date ASC, start ASC"
    : "SELECT * FROM shifts ORDER BY date ASC, start ASC";
  const stmt = user.role === "staff" ? env.DB.prepare(sql).bind(user.id) : env.DB.prepare(sql);
  const { results } = await stmt.all();
  return json({ shifts: results || [] }, 200, request);
}

async function createShift(request, env) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  if (!body || !body.date || !body.staffId || !body.start || !body.end) {
    return json({ error: "Please enter the date, staff member, and time." }, 400, request);
  }
  const id = randomId();
  await env.DB.prepare(
    `INSERT INTO shifts (id, date, staff_id, start, end, role, event_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, body.date, body.staffId, body.start, body.end, body.role || "", body.eventId || null, isoNow()).run();
  const shift = await env.DB.prepare("SELECT * FROM shifts WHERE id = ?").bind(id).first();
  return json({ shift }, 201, request);
}

async function listTasks(env, request, user) {
  const sql = user.role === "staff"
    ? "SELECT * FROM tasks WHERE staff_id = ? ORDER BY due ASC"
    : "SELECT * FROM tasks ORDER BY due ASC";
  const stmt = user.role === "staff" ? env.DB.prepare(sql).bind(user.id) : env.DB.prepare(sql);
  const { results } = await stmt.all();
  return json({ tasks: results || [] }, 200, request);
}

async function createTask(request, env) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  if (!body || !body.title || !body.staffId) {
    return json({ error: "Please enter a task and the staff member." }, 400, request);
  }
  const id = randomId();
  await env.DB.prepare(
    `INSERT INTO tasks (id, event_id, staff_id, title, due, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?)`
  ).bind(id, body.eventId || null, body.staffId, String(body.title).trim(), body.due || null, isoNow()).run();
  const task = await env.DB.prepare("SELECT * FROM tasks WHERE id = ?").bind(id).first();
  return json({ task }, 201, request);
}

async function patchTask(id, request, env, user) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const task = await env.DB.prepare("SELECT * FROM tasks WHERE id = ?").bind(id).first();
  if (!task) return json({ error: "Task not found." }, 404, request);
  if (user.role === "staff" && task.staff_id !== user.id) return deny(request);
  const body = await readJson(request) || {};
  if (body.status && !["open", "done"].includes(body.status)) {
    return json({ error: "Status must be open or done." }, 400, request);
  }
  const status = body.status || (task.status === "done" ? "open" : "done");
  await env.DB.prepare("UPDATE tasks SET status = ? WHERE id = ?").bind(status, id).run();
  const updated = await env.DB.prepare("SELECT * FROM tasks WHERE id = ?").bind(id).first();
  return json({ task: updated }, 200, request);
}

async function listAttendance(env, request, user) {
  const sql = user.role === "staff"
    ? "SELECT * FROM attendance WHERE staff_id = ? ORDER BY date DESC"
    : "SELECT * FROM attendance ORDER BY date DESC, time_in DESC";
  const stmt = user.role === "staff" ? env.DB.prepare(sql).bind(user.id) : env.DB.prepare(sql);
  const { results } = await stmt.all();
  return json({ attendance: results || [] }, 200, request);
}

async function clock(env, request, user) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const today = todayISO();
  const time = nowTime();
  const open = await env.DB.prepare(
    "SELECT * FROM attendance WHERE staff_id = ? AND date = ? AND (time_out IS NULL OR time_out = '')"
  ).bind(user.id, today).first();
  if (open) {
    await env.DB.prepare("UPDATE attendance SET time_out = ? WHERE id = ?").bind(time, open.id).run();
  } else {
    await env.DB.prepare(
      "INSERT INTO attendance (id, staff_id, date, time_in, time_out) VALUES (?, ?, ?, ?, NULL)"
    ).bind(randomId(), user.id, today, time).run();
  }
  const { results } = await env.DB.prepare(
    "SELECT * FROM attendance WHERE staff_id = ? ORDER BY date DESC"
  ).bind(user.id).all();
  return json({ attendance: results || [] }, 200, request);
}

async function listAnnouncements(env, request) {
  const { results } = await env.DB.prepare("SELECT * FROM announcements ORDER BY date DESC").all();
  return json({ announcements: results || [] }, 200, request);
}

async function createAnnouncement(request, env, user) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  if (!body || !body.title || !body.body) return json({ error: "Please enter a title and message." }, 400, request);
  const id = randomId();
  const date = body.date || todayISO();
  await env.DB.prepare(
    "INSERT INTO announcements (id, date, title, body, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(id, date, String(body.title).trim(), String(body.body).trim(), isoNow(), user.id).run();
  const item = await env.DB.prepare("SELECT * FROM announcements WHERE id = ?").bind(id).first();
  return json({ announcement: item }, 201, request);
}

async function listFinances(env, request) {
  const { results } = await env.DB.prepare(
    "SELECT id, date, client, title, fee, deposit, status FROM events ORDER BY date ASC"
  ).all();
  const events = results || [];
  const fees = events.reduce((sum, event) => sum + (event.fee || 0), 0);
  const deposits = events.reduce((sum, event) => sum + (event.deposit || 0), 0);
  return json({ events, totals: { fees, deposits, balance: fees - deposits } }, 200, request);
}

async function listUsers(env, request) {
  const { results } = await env.DB.prepare(
    "SELECT id, email, name, role, title, created_at, password_set_at FROM users ORDER BY name ASC"
  ).all();
  return json({ users: results || [] }, 200, request);
}

async function createUser(request, env) {
  if (!originAllowed(request)) return json({ error: "This request is not allowed from that page." }, 403, request);
  const body = await readJson(request);
  if (!body) return json({ error: "Please enter the new user's details." }, 400, request);
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const role = String(body.role || "staff");
  const title = String(body.title || "").trim();
  const password = String(body.password || "");
  if (!name || !email || !email.includes("@")) {
    return json({ error: "Please enter a name and email." }, 400, request);
  }
  if (!["owner", "admin", "staff"].includes(role)) {
    return json({ error: "Role must be owner, admin, or staff." }, 400, request);
  }
  const pwdError = validPassword(password);
  if (pwdError) return json({ error: pwdError }, 400, request);
  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) return json({ error: "That email is already in use." }, 409, request);
  const salt = newSalt();
  const hash = await hashPassword(password, salt);
  const id = randomId();
  const now = isoNow();
  await env.DB.prepare(
    `INSERT INTO users (id, email, name, role, title, password_hash, password_salt, password_set_at, must_change_password, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
  ).bind(id, email, name, role, title, hash, salt, now, now).run();
  const user = await env.DB.prepare(
    "SELECT id, email, name, role, title, created_at FROM users WHERE id = ?"
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
  if (body.name) { updates.push("name = ?"); values.push(String(body.name).trim()); }
  if (body.title !== undefined) { updates.push("title = ?"); values.push(String(body.title).trim()); }
  if (body.role) {
    if (!["owner", "admin", "staff"].includes(body.role)) {
      return json({ error: "Role must be owner, admin, or staff." }, 400, request);
    }
    updates.push("role = ?");
    values.push(body.role);
  }
  if (!updates.length) return json({ user: publicUser(existing) }, 200, request);
  values.push(id);
  await env.DB.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();
  const user = await env.DB.prepare(
    "SELECT id, email, name, role, title, created_at FROM users WHERE id = ?"
  ).bind(id).first();
  return json({ user }, 200, request);
}
