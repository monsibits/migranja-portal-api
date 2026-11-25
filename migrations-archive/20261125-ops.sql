-- Operations modules: sales, event sheets, housekeeping, inventory, accounting, HR, audit, exports.
-- Safe to run on an existing database. Does not alter the owner account.

CREATE TABLE IF NOT EXISTS packages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  venue TEXT,
  description TEXT,
  base_fee INTEGER NOT NULL DEFAULT 0,
  inclusions TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_sample INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
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
  is_sample INTEGER NOT NULL DEFAULT 0
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
  is_sample INTEGER NOT NULL DEFAULT 0
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
  is_sample INTEGER NOT NULL DEFAULT 0
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
  is_sample INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS event_details (
  event_id TEXT PRIMARY KEY,
  headcount INTEGER,
  menu TEXT,
  setup TEXT,
  timeline TEXT,
  notes TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS areas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT,
  notes TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0
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
  is_sample INTEGER NOT NULL DEFAULT 0
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
  created_at TEXT NOT NULL
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
  is_sample INTEGER NOT NULL DEFAULT 0
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
  is_sample INTEGER NOT NULL DEFAULT 0
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
  is_sample INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS staff_profiles (
  user_id TEXT PRIMARY KEY,
  daily_rate INTEGER,
  hourly_rate INTEGER,
  employment TEXT,
  start_date TEXT,
  notes TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0
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

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  user_id TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  detail TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS export_tokens (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  label TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_payments_event ON payments(event_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(received_at);
CREATE INDEX IF NOT EXISTS idx_checklists_assigned ON checklists(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_moves_item ON inventory_moves(item_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log(at);
