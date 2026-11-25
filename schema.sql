-- Live schema of migranja-portal after 0002_round2.
-- Generated 2026-11-26. Do not hand-edit the production database; add a new numbered migration instead.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'staff')),
  title TEXT,
  password_hash TEXT,
  password_salt TEXT,
  password_set_at TEXT,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  is_sample INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  password_algo TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  token_hash TEXT,
  last_seen_at TEXT
);

CREATE TABLE IF NOT EXISTS setup_tokens (
  id TEXT PRIMARY KEY,
  purpose TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  client TEXT,
  title TEXT,
  type TEXT,
  package TEXT,
  pax INTEGER,
  venue TEXT,
  status TEXT NOT NULL,
  fee INTEGER,
  deposit INTEGER,
  from_request TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0,
  client_id TEXT,
  package_id TEXT,
  quote_id TEXT,
  coordinator_id TEXT,
  contract_total INTEGER,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  name TEXT NOT NULL,
  contact TEXT NOT NULL,
  type TEXT,
  pax INTEGER,
  venue TEXT,
  notes TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  decided_at TEXT,
  decided_by TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0,
  decline_reason TEXT,
  package TEXT
);

CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  start TEXT NOT NULL,
  end TEXT NOT NULL,
  role TEXT,
  event_id TEXT,
  created_at TEXT NOT NULL,
  is_sample INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (staff_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  event_id TEXT,
  staff_id TEXT NOT NULL,
  title TEXT NOT NULL,
  due TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  is_sample INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (staff_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL,
  date TEXT NOT NULL,
  time_in TEXT,
  time_out TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (staff_id) REFERENCES users(id),
  shift_id TEXT,
  late_minutes INTEGER,
  ot_minutes INTEGER,
  corrected_at TEXT,
  corrected_by TEXT
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  window_start TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  user_id TEXT,
  role TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  detail TEXT,
  ip TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0,
  ua TEXT
);

CREATE TABLE IF NOT EXISTS packages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  venue TEXT,
  description TEXT,
  base_fee INTEGER NOT NULL DEFAULT 0,
  inclusions TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_sample INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  included_pax INTEGER,
  extra_pax_price INTEGER,
  hours INTEGER,
  updated_at TEXT,
  created_by TEXT,
  base_fee_cents INTEGER,
  extra_pax_price_cents INTEGER
);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT,
  source TEXT,
  status TEXT NOT NULL,
  notes TEXT,
  request_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  created_by TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0,
  client_id TEXT,
  assigned_to TEXT,
  event_date TEXT,
  venue TEXT,
  pax INTEGER,
  type TEXT
);

CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL,
  lead_id TEXT,
  request_id TEXT,
  event_id TEXT,
  client_name TEXT NOT NULL,
  contact TEXT,
  event_date TEXT,
  venue TEXT,
  package_id TEXT,
  items TEXT NOT NULL,
  subtotal INTEGER NOT NULL DEFAULT 0,
  discount INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  valid_until TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0,
  client_id TEXT,
  updated_at TEXT,
  subtotal_cents INTEGER,
  discount_cents INTEGER,
  total_cents INTEGER
);

CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL,
  quote_id TEXT,
  event_id TEXT,
  client_name TEXT NOT NULL,
  event_date TEXT,
  venue TEXT,
  total INTEGER NOT NULL DEFAULT 0,
  deposit_due INTEGER NOT NULL DEFAULT 0,
  terms TEXT,
  status TEXT NOT NULL,
  signed_at TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0,
  client_id TEXT,
  updated_at TEXT,
  total_cents INTEGER,
  deposit_due_cents INTEGER
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  receipt_no TEXT NOT NULL,
  event_id TEXT,
  quote_id TEXT,
  contract_id TEXT,
  client_name TEXT,
  kind TEXT NOT NULL,
  amount INTEGER NOT NULL,
  method TEXT,
  received_at TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0,
  voided_at TEXT,
  voided_by TEXT,
  or_number TEXT,
  amount_cents INTEGER
);

CREATE TABLE IF NOT EXISTS event_details (
  event_id TEXT PRIMARY KEY,
  headcount INTEGER,
  menu TEXT,
  setup TEXT,
  timeline TEXT,
  notes TEXT,
  updated_at TEXT,
  coordinator_id TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0,
  created_at TEXT,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS areas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT,
  notes TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0,
  venue_id TEXT
);

CREATE TABLE IF NOT EXISTS checklists (
  id TEXT PRIMARY KEY,
  event_id TEXT,
  area_id TEXT,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  assigned_to TEXT,
  due TEXT,
  status TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS checklist_items (
  id TEXT PRIMARY KEY,
  checklist_id TEXT NOT NULL,
  label TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_sample INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS issues (
  id TEXT PRIMARY KEY,
  area_id TEXT,
  event_id TEXT,
  title TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL,
  priority TEXT,
  reported_by TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0,
  assigned_to TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'pc',
  qty_on_hand INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  sku TEXT,
  consumable INTEGER NOT NULL DEFAULT 0,
  unit_cost INTEGER,
  location_id TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS inventory_moves (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  qty INTEGER NOT NULL,
  event_id TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0,
  location_id TEXT,
  signed_qty INTEGER
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  category TEXT NOT NULL,
  payee TEXT,
  amount INTEGER NOT NULL,
  method TEXT,
  event_id TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0,
  account_id TEXT,
  vat INTEGER NOT NULL DEFAULT 0,
  receipt_no TEXT,
  approved_by TEXT,
  voided_at TEXT,
  supplier_id TEXT,
  amount_cents INTEGER,
  vat_cents INTEGER
);

CREATE TABLE IF NOT EXISTS petty_cash (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  kind TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT,
  expense_id TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0,
  method TEXT,
  amount_cents INTEGER
);

CREATE TABLE IF NOT EXISTS staff_profiles (
  user_id TEXT PRIMARY KEY,
  daily_rate INTEGER,
  hourly_rate INTEGER,
  employment TEXT,
  start_date TEXT,
  notes TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0,
  rate_type TEXT,
  rate INTEGER,
  created_at TEXT,
  daily_rate_cents INTEGER,
  hourly_rate_cents INTEGER,
  rate_cents INTEGER
);

CREATE TABLE IF NOT EXISTS payroll_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  days_worked REAL,
  hours_worked REAL,
  gross INTEGER NOT NULL DEFAULT 0,
  deductions INTEGER NOT NULL DEFAULT 0,
  net INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS export_tokens (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  label TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS venues (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT,
  capacity INTEGER,
  notes TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT,
  email TEXT,
  company TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  created_by TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quote_lines (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL,
  label TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL DEFAULT 0,
  amount INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_sample INTEGER NOT NULL DEFAULT 0,
  unit_price_cents INTEGER,
  amount_cents INTEGER
);

CREATE TABLE IF NOT EXISTS payment_schedule (
  id TEXT PRIMARY KEY,
  event_id TEXT,
  contract_id TEXT,
  kind TEXT NOT NULL,
  due_date TEXT,
  amount INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  amount_cents INTEGER
);

CREATE TABLE IF NOT EXISTS hk_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  area_id TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hk_template_items (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_sample INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT,
  category TEXT,
  notes TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  notes TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS event_item_allocations (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 0,
  returned_qty INTEGER NOT NULL DEFAULT 0,
  damaged_qty INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL,
  supplier_id TEXT,
  status TEXT NOT NULL,
  ordered_at TEXT,
  expected_at TEXT,
  total INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER
);

CREATE TABLE IF NOT EXISTS po_lines (
  id TEXT PRIMARY KEY,
  po_id TEXT NOT NULL,
  item_id TEXT,
  label TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  unit_cost INTEGER NOT NULL DEFAULT 0,
  amount INTEGER NOT NULL DEFAULT 0,
  is_sample INTEGER NOT NULL DEFAULT 0,
  unit_cost_cents INTEGER,
  amount_cents INTEGER
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  is_sample INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS payroll_periods (
  id TEXT PRIMARY KEY,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS payroll_lines (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  days_worked REAL,
  hours_worked REAL,
  gross INTEGER NOT NULL DEFAULT 0,
  sss INTEGER NOT NULL DEFAULT 0,
  philhealth INTEGER NOT NULL DEFAULT 0,
  pagibig INTEGER NOT NULL DEFAULT 0,
  wtax INTEGER NOT NULL DEFAULT 0,
  advances INTEGER NOT NULL DEFAULT 0,
  other_deductions INTEGER NOT NULL DEFAULT 0,
  net INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0,
  gross_cents INTEGER,
  sss_cents INTEGER,
  philhealth_cents INTEGER,
  pagibig_cents INTEGER,
  wtax_cents INTEGER,
  advances_cents INTEGER,
  other_deductions_cents INTEGER,
  net_cents INTEGER
);

CREATE TABLE IF NOT EXISTS cash_advances (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT,
  status TEXT NOT NULL,
  payroll_line_id TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0,
  amount_cents INTEGER
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  days REAL,
  reason TEXT,
  status TEXT NOT NULL,
  decided_by TEXT,
  decided_at TEXT,
  created_at TEXT NOT NULL,
  is_sample INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS d1_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);

CREATE INDEX IF NOT EXISTS idx_requests_date ON requests(date);

CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);

CREATE INDEX IF NOT EXISTS idx_shifts_staff ON shifts(staff_id, date);

CREATE INDEX IF NOT EXISTS idx_tasks_staff ON tasks(staff_id);

CREATE INDEX IF NOT EXISTS idx_attendance_staff ON attendance(staff_id, date);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);

CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log(at);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity, entity_id);

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);

CREATE INDEX IF NOT EXISTS idx_payments_event ON payments(event_id);

CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(received_at);

CREATE INDEX IF NOT EXISTS idx_checklists_assigned ON checklists(assigned_to, status);

CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);

CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory_items(category);

CREATE INDEX IF NOT EXISTS idx_moves_item ON inventory_moves(item_id);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);

CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);

CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to);

CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(status);

CREATE INDEX IF NOT EXISTS idx_quote_lines_quote ON quote_lines(quote_id);

CREATE INDEX IF NOT EXISTS idx_payments_voided ON payments(voided_at);

CREATE INDEX IF NOT EXISTS idx_hk_templates_kind ON hk_templates(kind);

CREATE INDEX IF NOT EXISTS idx_allocations_event ON event_item_allocations(event_id);

CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(type);

CREATE INDEX IF NOT EXISTS idx_payroll_lines_period ON payroll_lines(period_id);

CREATE INDEX IF NOT EXISTS idx_advances_user ON cash_advances(user_id);

CREATE INDEX IF NOT EXISTS idx_leave_user ON leave_requests(user_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_events_from_request
  ON events(from_request)
  WHERE from_request IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS trg_payments_amount_ai AFTER INSERT ON payments
WHEN NEW.amount_cents IS NULL AND NEW.amount IS NOT NULL
BEGIN
  UPDATE payments SET amount_cents = CAST(ROUND(NEW.amount * 100) AS INTEGER) WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_payments_amount_au AFTER UPDATE OF amount ON payments
WHEN NEW.amount IS NOT NULL
BEGIN
  UPDATE payments SET amount_cents = CAST(ROUND(NEW.amount * 100) AS INTEGER) WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_payments_cents_au AFTER UPDATE OF amount_cents ON payments
WHEN NEW.amount_cents IS NOT NULL
BEGIN
  UPDATE payments SET amount = CAST(ROUND(NEW.amount_cents / 100.0) AS INTEGER) WHERE id = NEW.id AND IFNULL(amount, -1) != CAST(ROUND(NEW.amount_cents / 100.0) AS INTEGER);
END;

CREATE TRIGGER IF NOT EXISTS trg_quotes_totals_ai AFTER INSERT ON quotes
WHEN NEW.total_cents IS NULL AND NEW.total IS NOT NULL
BEGIN
  UPDATE quotes SET
    subtotal_cents = CAST(ROUND(NEW.subtotal * 100) AS INTEGER),
    discount_cents = CAST(ROUND(NEW.discount * 100) AS INTEGER),
    total_cents = CAST(ROUND(NEW.total * 100) AS INTEGER)
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_quotes_totals_au AFTER UPDATE OF subtotal, discount, total ON quotes
BEGIN
  UPDATE quotes SET
    subtotal_cents = CAST(ROUND(NEW.subtotal * 100) AS INTEGER),
    discount_cents = CAST(ROUND(NEW.discount * 100) AS INTEGER),
    total_cents = CAST(ROUND(NEW.total * 100) AS INTEGER)
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_expenses_amount_ai AFTER INSERT ON expenses
WHEN NEW.amount_cents IS NULL AND NEW.amount IS NOT NULL
BEGIN
  UPDATE expenses SET amount_cents = CAST(ROUND(NEW.amount * 100) AS INTEGER), vat_cents = CAST(ROUND(IFNULL(NEW.vat, 0) * 100) AS INTEGER) WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_expenses_amount_au AFTER UPDATE OF amount, vat ON expenses
BEGIN
  UPDATE expenses SET amount_cents = CAST(ROUND(NEW.amount * 100) AS INTEGER), vat_cents = CAST(ROUND(IFNULL(NEW.vat, 0) * 100) AS INTEGER) WHERE id = NEW.id;
END;

CREATE VIEW IF NOT EXISTS v_stock_on_hand AS
  SELECT
    i.id AS item_id,
    i.name,
    i.sku,
    i.category,
    i.unit,
    i.consumable,
    i.reorder_level,
    i.unit_cost,
    i.is_sample,
    IFNULL((
      SELECT SUM(IFNULL(m.signed_qty, CASE
        WHEN m.kind IN ('receive', 'return') THEN m.qty
        WHEN m.kind IN ('issue', 'damage', 'loss') THEN -m.qty
        WHEN m.kind = 'adjust' THEN m.qty
        ELSE 0
      END))
      FROM inventory_moves m WHERE m.item_id = i.id
    ), i.qty_on_hand) AS qty_on_hand
  FROM inventory_items i;

CREATE VIEW v_event_balance AS
  SELECT
    e.id AS event_id,
    e.date,
    e.client,
    e.title,
    e.status,
    e.is_sample,
    IFNULL(e.contract_total, e.fee) AS contract_total,
    IFNULL((
      SELECT SUM(IFNULL(p.amount_cents, CAST(ROUND(p.amount * 100) AS INTEGER))) / 100.0 FROM payments p
      WHERE p.event_id = e.id AND p.voided_at IS NULL AND p.kind != 'refund'
    ), 0) - IFNULL((
      SELECT SUM(IFNULL(p.amount_cents, CAST(ROUND(p.amount * 100) AS INTEGER))) / 100.0 FROM payments p
      WHERE p.event_id = e.id AND p.voided_at IS NULL AND p.kind = 'refund'
    ), 0) AS collected,
    IFNULL(e.contract_total, e.fee) - (
      IFNULL((
        SELECT SUM(IFNULL(p.amount_cents, CAST(ROUND(p.amount * 100) AS INTEGER))) / 100.0 FROM payments p
        WHERE p.event_id = e.id AND p.voided_at IS NULL AND p.kind != 'refund'
      ), 0) - IFNULL((
        SELECT SUM(IFNULL(p.amount_cents, CAST(ROUND(p.amount * 100) AS INTEGER))) / 100.0 FROM payments p
        WHERE p.event_id = e.id AND p.voided_at IS NULL AND p.kind = 'refund'
      ), 0)
    ) AS balance
  FROM events e
  WHERE e.status != 'Cancelled';

-- Round 3
CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_number ON quotes(number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_number ON contracts(number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_receipt_no ON payments(receipt_no) WHERE receipt_no IS NOT NULL AND receipt_no != '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_orders_number ON purchase_orders(number);
-- payroll_lines also has: advance_ids TEXT, contributions_estimated INTEGER NOT NULL DEFAULT 1
