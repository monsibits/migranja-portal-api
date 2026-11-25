-- Operations schema additions on top of 20261125-ops.sql and 0001_security.sql.
-- Amounts are whole Philippine pesos, same unit as events.fee and events.deposit.
-- Safe to re-run only if ADD COLUMN statements that already exist are skipped.
-- Does not alter the owner account.

-- Audit columns expected by the Worker (0001 create was skipped because a slimmer table already existed).
ALTER TABLE audit_log ADD COLUMN role TEXT;
ALTER TABLE audit_log ADD COLUMN ip TEXT;
ALTER TABLE audit_log ADD COLUMN ua TEXT;

-- Existing table extensions
ALTER TABLE packages ADD COLUMN included_pax INTEGER;
ALTER TABLE packages ADD COLUMN extra_pax_price INTEGER;
ALTER TABLE packages ADD COLUMN hours INTEGER;
ALTER TABLE packages ADD COLUMN updated_at TEXT;
ALTER TABLE packages ADD COLUMN created_by TEXT;

ALTER TABLE leads ADD COLUMN client_id TEXT;
ALTER TABLE leads ADD COLUMN assigned_to TEXT;
ALTER TABLE leads ADD COLUMN event_date TEXT;
ALTER TABLE leads ADD COLUMN venue TEXT;
ALTER TABLE leads ADD COLUMN pax INTEGER;
ALTER TABLE leads ADD COLUMN type TEXT;

ALTER TABLE quotes ADD COLUMN client_id TEXT;
ALTER TABLE quotes ADD COLUMN updated_at TEXT;

ALTER TABLE contracts ADD COLUMN client_id TEXT;
ALTER TABLE contracts ADD COLUMN updated_at TEXT;

ALTER TABLE payments ADD COLUMN voided_at TEXT;
ALTER TABLE payments ADD COLUMN voided_by TEXT;
ALTER TABLE payments ADD COLUMN or_number TEXT;

ALTER TABLE event_details ADD COLUMN coordinator_id TEXT;
ALTER TABLE event_details ADD COLUMN is_sample INTEGER NOT NULL DEFAULT 0;
ALTER TABLE event_details ADD COLUMN created_at TEXT;
ALTER TABLE event_details ADD COLUMN created_by TEXT;

ALTER TABLE areas ADD COLUMN venue_id TEXT;

ALTER TABLE issues ADD COLUMN assigned_to TEXT;
ALTER TABLE issues ADD COLUMN updated_at TEXT;

ALTER TABLE inventory_items ADD COLUMN sku TEXT;
ALTER TABLE inventory_items ADD COLUMN consumable INTEGER NOT NULL DEFAULT 0;
ALTER TABLE inventory_items ADD COLUMN unit_cost INTEGER;
ALTER TABLE inventory_items ADD COLUMN location_id TEXT;
ALTER TABLE inventory_items ADD COLUMN updated_at TEXT;

ALTER TABLE inventory_moves ADD COLUMN location_id TEXT;
ALTER TABLE inventory_moves ADD COLUMN signed_qty INTEGER;

ALTER TABLE expenses ADD COLUMN account_id TEXT;
ALTER TABLE expenses ADD COLUMN vat INTEGER NOT NULL DEFAULT 0;
ALTER TABLE expenses ADD COLUMN receipt_no TEXT;
ALTER TABLE expenses ADD COLUMN approved_by TEXT;
ALTER TABLE expenses ADD COLUMN voided_at TEXT;
ALTER TABLE expenses ADD COLUMN supplier_id TEXT;

ALTER TABLE petty_cash ADD COLUMN method TEXT;
ALTER TABLE petty_cash ADD COLUMN is_sample INTEGER NOT NULL DEFAULT 0;

ALTER TABLE staff_profiles ADD COLUMN rate_type TEXT;
ALTER TABLE staff_profiles ADD COLUMN rate INTEGER;
ALTER TABLE staff_profiles ADD COLUMN created_at TEXT;

ALTER TABLE events ADD COLUMN client_id TEXT;
ALTER TABLE events ADD COLUMN package_id TEXT;
ALTER TABLE events ADD COLUMN quote_id TEXT;
ALTER TABLE events ADD COLUMN coordinator_id TEXT;
ALTER TABLE events ADD COLUMN contract_total INTEGER;
ALTER TABLE events ADD COLUMN updated_at TEXT;

ALTER TABLE attendance ADD COLUMN shift_id TEXT;
ALTER TABLE attendance ADD COLUMN late_minutes INTEGER;
ALTER TABLE attendance ADD COLUMN ot_minutes INTEGER;
ALTER TABLE attendance ADD COLUMN corrected_at TEXT;
ALTER TABLE attendance ADD COLUMN corrected_by TEXT;

-- New tables
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
  is_sample INTEGER NOT NULL DEFAULT 0
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
  created_at TEXT NOT NULL
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
  is_sample INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS po_lines (
  id TEXT PRIMARY KEY,
  po_id TEXT NOT NULL,
  item_id TEXT,
  label TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  unit_cost INTEGER NOT NULL DEFAULT 0,
  amount INTEGER NOT NULL DEFAULT 0,
  is_sample INTEGER NOT NULL DEFAULT 0
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
  is_sample INTEGER NOT NULL DEFAULT 0
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
  is_sample INTEGER NOT NULL DEFAULT 0
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

-- Views used by dashboard, inventory, and accounting (real rows only in the view filters where noted).
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

CREATE VIEW IF NOT EXISTS v_event_balance AS
  SELECT
    e.id AS event_id,
    e.date,
    e.client,
    e.title,
    e.status,
    e.is_sample,
    IFNULL(e.contract_total, e.fee) AS contract_total,
    IFNULL((
      SELECT SUM(p.amount) FROM payments p
      WHERE p.event_id = e.id AND p.voided_at IS NULL AND p.kind != 'refund'
    ), 0) - IFNULL((
      SELECT SUM(p.amount) FROM payments p
      WHERE p.event_id = e.id AND p.voided_at IS NULL AND p.kind = 'refund'
    ), 0) AS collected,
    IFNULL(e.contract_total, e.fee) - (
      IFNULL((
        SELECT SUM(p.amount) FROM payments p
        WHERE p.event_id = e.id AND p.voided_at IS NULL AND p.kind != 'refund'
      ), 0) - IFNULL((
        SELECT SUM(p.amount) FROM payments p
        WHERE p.event_id = e.id AND p.voided_at IS NULL AND p.kind = 'refund'
      ), 0)
    ) AS balance
  FROM events e
  WHERE e.status != 'Cancelled';
