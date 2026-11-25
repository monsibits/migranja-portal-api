-- Round 2: unique request-to-event index, password algo, and integer money in cents.
-- Do not edit the live database by hand. Apply with wrangler d1 migrations.

-- 1) Clear cancelled duplicates so the unique index can be created.
UPDATE events
SET from_request = NULL
WHERE status = 'Cancelled'
  AND from_request IS NOT NULL
  AND from_request IN (
    SELECT from_request FROM events
    WHERE from_request IS NOT NULL
    GROUP BY from_request
    HAVING COUNT(*) > 1
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_events_from_request
  ON events(from_request)
  WHERE from_request IS NOT NULL;

-- 2) Store the password algorithm with each hash.
ALTER TABLE users ADD COLUMN password_algo TEXT;
UPDATE users SET password_algo = 'pbkdf2-sha256-100000' WHERE password_algo IS NULL AND password_hash IS NOT NULL;

-- 3) Money in *_cents on the operations tables. Peso columns stay in sync for now.
ALTER TABLE packages ADD COLUMN base_fee_cents INTEGER;
ALTER TABLE packages ADD COLUMN extra_pax_price_cents INTEGER;
UPDATE packages SET base_fee_cents = CAST(ROUND(base_fee * 100) AS INTEGER) WHERE base_fee IS NOT NULL AND base_fee_cents IS NULL;
UPDATE packages SET extra_pax_price_cents = CAST(ROUND(extra_pax_price * 100) AS INTEGER) WHERE extra_pax_price IS NOT NULL AND extra_pax_price_cents IS NULL;

ALTER TABLE quotes ADD COLUMN subtotal_cents INTEGER;
ALTER TABLE quotes ADD COLUMN discount_cents INTEGER;
ALTER TABLE quotes ADD COLUMN total_cents INTEGER;
UPDATE quotes SET subtotal_cents = CAST(ROUND(subtotal * 100) AS INTEGER) WHERE subtotal IS NOT NULL AND subtotal_cents IS NULL;
UPDATE quotes SET discount_cents = CAST(ROUND(discount * 100) AS INTEGER) WHERE discount IS NOT NULL AND discount_cents IS NULL;
UPDATE quotes SET total_cents = CAST(ROUND(total * 100) AS INTEGER) WHERE total IS NOT NULL AND total_cents IS NULL;

ALTER TABLE quote_lines ADD COLUMN unit_price_cents INTEGER;
ALTER TABLE quote_lines ADD COLUMN amount_cents INTEGER;
UPDATE quote_lines SET unit_price_cents = CAST(ROUND(unit_price * 100) AS INTEGER) WHERE unit_price IS NOT NULL AND unit_price_cents IS NULL;
UPDATE quote_lines SET amount_cents = CAST(ROUND(amount * 100) AS INTEGER) WHERE amount IS NOT NULL AND amount_cents IS NULL;

ALTER TABLE contracts ADD COLUMN total_cents INTEGER;
ALTER TABLE contracts ADD COLUMN deposit_due_cents INTEGER;
UPDATE contracts SET total_cents = CAST(ROUND(total * 100) AS INTEGER) WHERE total IS NOT NULL AND total_cents IS NULL;
UPDATE contracts SET deposit_due_cents = CAST(ROUND(deposit_due * 100) AS INTEGER) WHERE deposit_due IS NOT NULL AND deposit_due_cents IS NULL;

ALTER TABLE payments ADD COLUMN amount_cents INTEGER;
UPDATE payments SET amount_cents = CAST(ROUND(amount * 100) AS INTEGER) WHERE amount IS NOT NULL AND amount_cents IS NULL;

ALTER TABLE expenses ADD COLUMN amount_cents INTEGER;
ALTER TABLE expenses ADD COLUMN vat_cents INTEGER;
UPDATE expenses SET amount_cents = CAST(ROUND(amount * 100) AS INTEGER) WHERE amount IS NOT NULL AND amount_cents IS NULL;
UPDATE expenses SET vat_cents = CAST(ROUND(vat * 100) AS INTEGER) WHERE vat IS NOT NULL AND vat_cents IS NULL;

ALTER TABLE petty_cash ADD COLUMN amount_cents INTEGER;
UPDATE petty_cash SET amount_cents = CAST(ROUND(amount * 100) AS INTEGER) WHERE amount IS NOT NULL AND amount_cents IS NULL;

ALTER TABLE cash_advances ADD COLUMN amount_cents INTEGER;
UPDATE cash_advances SET amount_cents = CAST(ROUND(amount * 100) AS INTEGER) WHERE amount IS NOT NULL AND amount_cents IS NULL;

ALTER TABLE staff_profiles ADD COLUMN daily_rate_cents INTEGER;
ALTER TABLE staff_profiles ADD COLUMN hourly_rate_cents INTEGER;
ALTER TABLE staff_profiles ADD COLUMN rate_cents INTEGER;
UPDATE staff_profiles SET daily_rate_cents = CAST(ROUND(daily_rate * 100) AS INTEGER) WHERE daily_rate IS NOT NULL AND daily_rate_cents IS NULL;
UPDATE staff_profiles SET hourly_rate_cents = CAST(ROUND(hourly_rate * 100) AS INTEGER) WHERE hourly_rate IS NOT NULL AND hourly_rate_cents IS NULL;
UPDATE staff_profiles SET rate_cents = CAST(ROUND(rate * 100) AS INTEGER) WHERE rate IS NOT NULL AND rate_cents IS NULL;

ALTER TABLE payroll_lines ADD COLUMN gross_cents INTEGER;
ALTER TABLE payroll_lines ADD COLUMN sss_cents INTEGER;
ALTER TABLE payroll_lines ADD COLUMN philhealth_cents INTEGER;
ALTER TABLE payroll_lines ADD COLUMN pagibig_cents INTEGER;
ALTER TABLE payroll_lines ADD COLUMN wtax_cents INTEGER;
ALTER TABLE payroll_lines ADD COLUMN advances_cents INTEGER;
ALTER TABLE payroll_lines ADD COLUMN other_deductions_cents INTEGER;
ALTER TABLE payroll_lines ADD COLUMN net_cents INTEGER;
UPDATE payroll_lines SET gross_cents = CAST(ROUND(gross * 100) AS INTEGER) WHERE gross IS NOT NULL AND gross_cents IS NULL;
UPDATE payroll_lines SET sss_cents = CAST(ROUND(sss * 100) AS INTEGER) WHERE sss IS NOT NULL AND sss_cents IS NULL;
UPDATE payroll_lines SET philhealth_cents = CAST(ROUND(philhealth * 100) AS INTEGER) WHERE philhealth IS NOT NULL AND philhealth_cents IS NULL;
UPDATE payroll_lines SET pagibig_cents = CAST(ROUND(pagibig * 100) AS INTEGER) WHERE pagibig IS NOT NULL AND pagibig_cents IS NULL;
UPDATE payroll_lines SET wtax_cents = CAST(ROUND(wtax * 100) AS INTEGER) WHERE wtax IS NOT NULL AND wtax_cents IS NULL;
UPDATE payroll_lines SET advances_cents = CAST(ROUND(advances * 100) AS INTEGER) WHERE advances IS NOT NULL AND advances_cents IS NULL;
UPDATE payroll_lines SET other_deductions_cents = CAST(ROUND(other_deductions * 100) AS INTEGER) WHERE other_deductions IS NOT NULL AND other_deductions_cents IS NULL;
UPDATE payroll_lines SET net_cents = CAST(ROUND(net * 100) AS INTEGER) WHERE net IS NOT NULL AND net_cents IS NULL;

ALTER TABLE purchase_orders ADD COLUMN total_cents INTEGER;
UPDATE purchase_orders SET total_cents = CAST(ROUND(total * 100) AS INTEGER) WHERE total IS NOT NULL AND total_cents IS NULL;

ALTER TABLE po_lines ADD COLUMN unit_cost_cents INTEGER;
ALTER TABLE po_lines ADD COLUMN amount_cents INTEGER;
UPDATE po_lines SET unit_cost_cents = CAST(ROUND(unit_cost * 100) AS INTEGER) WHERE unit_cost IS NOT NULL AND unit_cost_cents IS NULL;
UPDATE po_lines SET amount_cents = CAST(ROUND(amount * 100) AS INTEGER) WHERE amount IS NOT NULL AND amount_cents IS NULL;

ALTER TABLE payment_schedule ADD COLUMN amount_cents INTEGER;
UPDATE payment_schedule SET amount_cents = CAST(ROUND(amount * 100) AS INTEGER) WHERE amount IS NOT NULL AND amount_cents IS NULL;

-- Keep peso and cent columns aligned if a write sets only one side.
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

-- Recreate the balance view so collected uses cents when present, still reported in pesos.
DROP VIEW IF EXISTS v_event_balance;
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
