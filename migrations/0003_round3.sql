-- Round 3: unique document numbers and payroll deduction metadata.
-- SSS / PhilHealth / Pag-IBIG / wtax remain estimates until official tables are confirmed.

CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_number ON quotes(number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_number ON contracts(number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_receipt_no ON payments(receipt_no) WHERE receipt_no IS NOT NULL AND receipt_no != '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_orders_number ON purchase_orders(number);

ALTER TABLE payroll_lines ADD COLUMN advance_ids TEXT;
ALTER TABLE payroll_lines ADD COLUMN contributions_estimated INTEGER NOT NULL DEFAULT 1;
