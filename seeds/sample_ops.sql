-- SAMPLE operations data plus a few real setup rows (venues, accounts, stock locations).
-- Does not touch the owner account or passwords. Safe to run once; uses INSERT OR IGNORE.

INSERT OR IGNORE INTO venues (id, name, kind, capacity, notes, is_sample, created_at) VALUES
  ('venue-ballroom', 'Ballroom', 'indoor', 180, 'Main hall', 0, '2026-11-01T00:00:00.000Z'),
  ('venue-nook', 'The Nook', 'indoor', 50, 'Intimate room', 0, '2026-11-01T00:00:00.000Z'),
  ('venue-garden', 'Amore Garden', 'outdoor', 150, 'Garden reception', 0, '2026-11-01T00:00:00.000Z');

INSERT OR IGNORE INTO accounts (id, code, name, type, is_sample) VALUES
  ('acct-rev-events', '4000', 'Event revenue', 'income', 0),
  ('acct-rev-other', '4100', 'Other income', 'income', 0),
  ('acct-food', '5000', 'Food and beverage', 'expense', 0),
  ('acct-decor', '5100', 'Decor and rentals', 'expense', 0),
  ('acct-utilities', '5200', 'Utilities', 'expense', 0),
  ('acct-supplies', '5300', 'Supplies', 'expense', 0),
  ('acct-labor', '5400', 'Labor', 'expense', 0),
  ('acct-transport', '5500', 'Transport', 'expense', 0),
  ('acct-maint', '5600', 'Maintenance', 'expense', 0),
  ('acct-mkt', '5700', 'Marketing', 'expense', 0),
  ('acct-fees', '5800', 'Fees', 'expense', 0),
  ('acct-other', '5900', 'Other expenses', 'expense', 0),
  ('acct-petty', '1100', 'Petty cash', 'asset', 0),
  ('acct-cash', '1000', 'Cash on hand', 'asset', 0);

INSERT OR IGNORE INTO stock_locations (id, name, notes, is_sample) VALUES
  ('loc-store', 'Main store', 'Back-of-house storage', 0),
  ('loc-kitchen', 'Kitchen', 'Kitchen supplies', 0);

INSERT OR IGNORE INTO areas (id, name, kind, notes, is_sample, venue_id) VALUES
  ('area-ballroom', 'Ballroom', 'venue', 'Main hall and foyer', 0, 'venue-ballroom'),
  ('area-nook', 'The Nook', 'venue', 'Intimate room', 0, 'venue-nook'),
  ('area-garden', 'Amore Garden', 'venue', 'Garden and lawn', 0, 'venue-garden'),
  ('area-restrooms', 'Guest restrooms', 'facility', 'Front of house restrooms', 0, NULL),
  ('area-kitchen', 'Kitchen', 'back', 'Production kitchen', 0, NULL),
  ('area-parking', 'Parking and driveway', 'grounds', NULL, 0, NULL);

INSERT OR IGNORE INTO packages (id, name, venue, description, base_fee, included_pax, extra_pax_price, hours, inclusions, is_active, is_sample, created_at) VALUES
  ('pkg-garden-wedding', 'SAMPLE · Garden wedding', 'Amore Garden', 'Full garden reception with lights and a buffet.', 180000, 100, 850, 8, 'Venue, buffet for 100, basic stylized setup, wait staff, sound system', 1, 1, '2026-11-01T00:00:00.000Z'),
  ('pkg-ballroom-wedding', 'SAMPLE · Ballroom wedding', 'Ballroom', 'Indoor wedding reception.', 250000, 150, 900, 8, 'Venue, buffet for 150, stage, lights, wait staff', 1, 1, '2026-11-01T00:00:00.000Z'),
  ('pkg-debut', 'SAMPLE · Debut reception', 'Ballroom', '18th birthday reception.', 160000, 100, 800, 8, 'Venue, buffet, 18-candle setup, sound', 1, 1, '2026-11-01T00:00:00.000Z'),
  ('pkg-intimate', 'SAMPLE · Intimate celebration', 'The Nook', 'Small lunch or dinner.', 65000, 40, 700, 4, 'Venue, set menu, table setup', 1, 1, '2026-11-01T00:00:00.000Z'),
  ('pkg-corporate', 'SAMPLE · Corporate lunch', 'Ballroom', 'Company lunch or year-end gathering.', 120000, 80, 750, 5, 'Venue, plated or buffet lunch, AV', 1, 1, '2026-11-01T00:00:00.000Z'),
  ('pkg-christening', 'SAMPLE · Christening lunch', 'The Nook', 'Family lunch after a christening.', 55000, 40, 650, 4, 'Venue, lunch, simple flowers', 1, 1, '2026-11-01T00:00:00.000Z');

INSERT OR IGNORE INTO clients (id, name, contact, email, company, notes, created_at, created_by, is_sample) VALUES
  ('cli-reyes', 'SAMPLE · Reyes family', '0917 555 0201', 'reyes.family@sample.invalid', NULL, 'Garden wedding, November', '2026-09-10T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1),
  ('cli-delacruz', 'SAMPLE · Dela Cruz family', '0917 555 0202', 'delacruz.family@sample.invalid', NULL, 'Debut, November', '2026-09-20T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1),
  ('cli-santos', 'SAMPLE · Santos family', '0917 555 0203', 'santos.family@sample.invalid', NULL, 'Intimate lunch', '2026-10-01T00:00:00.000Z', '3f19e8c2-6a54-4b80-9d27-c1e5a0b84731', 1),
  ('cli-bautista', 'SAMPLE · Bautista group', '0919 555 0103', 'bautista.group@sample.invalid', 'Bautista Trading', 'Year-end lunch', '2026-10-08T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1),
  ('cli-mendoza', 'SAMPLE · Mendoza family', '0917 555 0205', 'mendoza.family@sample.invalid', NULL, 'December wedding', '2026-10-12T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1),
  ('cli-villanueva', 'SAMPLE · Villanueva family', '0917 555 0206', 'villanueva.family@sample.invalid', NULL, 'Christening', '2026-10-20T00:00:00.000Z', '3f19e8c2-6a54-4b80-9d27-c1e5a0b84731', 1),
  ('cli-ramos', 'SAMPLE · Ramos family', '0917 555 0207', 'ramos.family@sample.invalid', NULL, '50th birthday', '2026-10-25T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1),
  ('cli-gomez', 'SAMPLE · Nina Gomez', '0917 555 0101', 'nina.gomez@sample.invalid', NULL, 'Open inquiry for late December', '2026-11-18T00:00:00.000Z', '3f19e8c2-6a54-4b80-9d27-c1e5a0b84731', 1),
  ('cli-lim', 'SAMPLE · Paolo Lim', '0918 555 0102', 'paolo.lim@sample.invalid', NULL, 'Open inquiry for January', '2026-11-20T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1),
  ('cli-ortega', 'SAMPLE · Ortega family', '0920 555 0104', 'ortega.family@sample.invalid', NULL, 'Declined December 18 request', '2026-11-05T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1);

INSERT OR IGNORE INTO leads (id, name, contact, source, status, notes, request_id, client_id, assigned_to, event_date, venue, pax, type, created_at, created_by, is_sample) VALUES
  ('lead-reyes', 'SAMPLE · Reyes family', '0917 555 0201', 'Referral', 'won', 'Booked garden wedding', NULL, 'cli-reyes', '3f19e8c2-6a54-4b80-9d27-c1e5a0b84731', '2026-11-08', 'Amore Garden', 110, 'Wedding', '2026-09-10T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1),
  ('lead-delacruz', 'SAMPLE · Dela Cruz family', '0917 555 0202', 'Walk-in', 'won', 'Debut reception', NULL, 'cli-delacruz', '3f19e8c2-6a54-4b80-9d27-c1e5a0b84731', '2026-11-15', 'Ballroom', 100, 'Debut', '2026-09-20T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1),
  ('lead-bautista', 'SAMPLE · Bautista group', '0919 555 0103', 'Website', 'won', 'Approved from the public calendar', 'b22e0005-1212-4bb2-8b02-000000000013', 'cli-bautista', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', '2026-12-05', 'Ballroom', 80, 'Corporate', '2026-10-08T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1),
  ('lead-mendoza', 'SAMPLE · Mendoza family', '0917 555 0205', 'Referral', 'won', 'December wedding', NULL, 'cli-mendoza', '3f19e8c2-6a54-4b80-9d27-c1e5a0b84731', '2026-12-12', 'Amore Garden', 140, 'Wedding', '2026-10-12T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1),
  ('lead-gomez', 'SAMPLE · Nina Gomez', '0917 555 0101', 'Public calendar', 'new', 'Pending public request', 'b22e0028-1212-4bb2-8b02-000000000011', 'cli-gomez', '3f19e8c2-6a54-4b80-9d27-c1e5a0b84731', '2026-12-28', 'Ballroom', 90, 'Birthday', '2026-11-18T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1),
  ('lead-lim', 'SAMPLE · Paolo Lim', '0918 555 0102', 'Public calendar', 'contacted', 'Called once, waiting on a menu choice', 'b22e0017-0101-4bb2-8b02-000000000012', 'cli-lim', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', '2027-01-17', 'The Nook', 40, 'Other', '2026-11-20T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1),
  ('lead-ortega', 'SAMPLE · Ortega family', '0920 555 0104', 'Public calendar', 'lost', 'Date declined', 'b22e0018-1212-4bb2-8b02-000000000014', 'cli-ortega', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', '2026-12-18', 'Ballroom', 120, 'Wedding', '2026-11-05T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1),
  ('lead-quoted', 'SAMPLE · Cruz engagement lunch', '0917 555 0288', 'Instagram', 'quoted', 'Quote sent, waiting for a reply', NULL, NULL, '3f19e8c2-6a54-4b80-9d27-c1e5a0b84731', '2027-02-14', 'The Nook', 36, 'Other', '2026-11-22T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1);

INSERT OR IGNORE INTO quotes (id, number, lead_id, request_id, event_id, client_id, client_name, contact, event_date, venue, package_id, items, subtotal, discount, total, status, valid_until, notes, created_at, created_by, is_sample) VALUES
  ('qte-reyes', 'MG-Q-S-0002', 'lead-reyes', NULL, 'a11e0008-1111-4aa1-8a01-000000000001', 'cli-reyes', 'SAMPLE · Reyes family', '0917 555 0201', '2026-11-08', 'Amore Garden', 'pkg-garden-wedding', '[{"label":"Garden wedding package","qty":1,"unit_price":180000}]', 180000, 0, 180000, 'accepted', '2026-10-15', 'Accepted and completed', '2026-09-15T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1),
  ('qte-mendoza', 'MG-Q-S-0003', 'lead-mendoza', NULL, 'a11e0012-1212-4aa1-8a01-000000000005', 'cli-mendoza', 'SAMPLE · Mendoza family', '0917 555 0205', '2026-12-12', 'Amore Garden', 'pkg-garden-wedding', '[{"label":"Garden wedding package","qty":1,"unit_price":180000},{"label":"Extra guests (40)","qty":40,"unit_price":850},{"label":"Additional lights","qty":1,"unit_price":6000}]', 220000, 0, 220000, 'accepted', '2026-11-15', 'Lights add-on included', '2026-10-18T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1),
  ('qte-bautista', 'MG-Q-S-0004', 'lead-bautista', 'b22e0005-1212-4bb2-8b02-000000000013', 'a11e0005-1212-4aa1-8a01-000000000004', 'cli-bautista', 'SAMPLE · Bautista group', '0919 555 0103', '2026-12-05', 'Ballroom', 'pkg-corporate', '[{"label":"Corporate lunch package","qty":1,"unit_price":120000}]', 120000, 0, 120000, 'accepted', '2026-11-20', NULL, '2026-10-20T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1),
  ('qte-cruz', 'MG-Q-S-0005', 'lead-quoted', NULL, NULL, NULL, 'SAMPLE · Cruz engagement lunch', '0917 555 0288', '2027-02-14', 'The Nook', 'pkg-intimate', '[{"label":"Intimate celebration package","qty":1,"unit_price":65000},{"label":"Dessert table","qty":1,"unit_price":8000}]', 73000, 3000, 70000, 'sent', '2026-12-15', 'Waiting for a reply', '2026-11-23T00:00:00.000Z', '3f19e8c2-6a54-4b80-9d27-c1e5a0b84731', 1),
  ('qte-lim', 'MG-Q-S-0006', 'lead-lim', 'b22e0017-0101-4bb2-8b02-000000000012', NULL, 'cli-lim', 'SAMPLE · Paolo Lim', '0918 555 0102', '2027-01-17', 'The Nook', 'pkg-intimate', '[{"label":"Intimate celebration package","qty":1,"unit_price":65000}]', 65000, 0, 65000, 'draft', '2027-01-05', 'Not sent yet', '2026-11-24T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1);

INSERT OR IGNORE INTO quote_lines (id, quote_id, label, qty, unit_price, amount, sort_order, is_sample) VALUES
  ('ql-reyes-1', 'qte-reyes', 'Garden wedding package', 1, 180000, 180000, 0, 1),
  ('ql-men-1', 'qte-mendoza', 'Garden wedding package', 1, 180000, 180000, 0, 1),
  ('ql-men-2', 'qte-mendoza', 'Extra guests (40)', 40, 850, 34000, 1, 1),
  ('ql-men-3', 'qte-mendoza', 'Additional lights', 1, 6000, 6000, 2, 1),
  ('ql-bau-1', 'qte-bautista', 'Corporate lunch package', 1, 120000, 120000, 0, 1),
  ('ql-cruz-1', 'qte-cruz', 'Intimate celebration package', 1, 65000, 65000, 0, 1),
  ('ql-cruz-2', 'qte-cruz', 'Dessert table', 1, 8000, 8000, 1, 1),
  ('ql-lim-1', 'qte-lim', 'Intimate celebration package', 1, 65000, 65000, 0, 1);

INSERT OR IGNORE INTO contracts (id, number, quote_id, event_id, client_id, client_name, event_date, venue, total, deposit_due, terms, status, signed_at, created_at, created_by, is_sample) VALUES
  ('ctr-reyes', 'MG-C-S-0004', 'qte-reyes', 'a11e0008-1111-4aa1-8a01-000000000001', 'cli-reyes', 'SAMPLE · Reyes family', '2026-11-08', 'Amore Garden', 180000, 90000, 'Fifty percent reservation, balance due seven days before the event.', 'signed', '2026-09-20T00:00:00.000Z', '2026-09-18T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1),
  ('ctr-mendoza', 'MG-C-S-0005', 'qte-mendoza', 'a11e0012-1212-4aa1-8a01-000000000005', 'cli-mendoza', 'SAMPLE · Mendoza family', '2026-12-12', 'Amore Garden', 220000, 110000, 'Fifty percent reservation, balance due seven days before the event.', 'signed', '2026-10-28T00:00:00.000Z', '2026-10-25T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1),
  ('ctr-bautista', 'MG-C-S-0006', 'qte-bautista', 'a11e0005-1212-4aa1-8a01-000000000004', 'cli-bautista', 'SAMPLE · Bautista group', '2026-12-05', 'Ballroom', 120000, 60000, 'Fifty percent reservation, balance due seven days before the event.', 'sent', NULL, '2026-10-22T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1);

INSERT OR IGNORE INTO payments (id, receipt_no, or_number, event_id, quote_id, contract_id, client_name, kind, amount, method, received_at, notes, created_at, created_by, is_sample) VALUES
  ('pay-reyes-1', 'MG-OR-S-0002', 'MG-OR-S-0002', 'a11e0008-1111-4aa1-8a01-000000000001', 'qte-reyes', 'ctr-reyes', 'SAMPLE · Reyes family', 'downpayment', 90000, 'bank', '2026-09-21', 'Reservation', '2026-09-21T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1),
  ('pay-reyes-2', 'MG-OR-S-0003', 'MG-OR-S-0003', 'a11e0008-1111-4aa1-8a01-000000000001', 'qte-reyes', 'ctr-reyes', 'SAMPLE · Reyes family', 'balance', 90000, 'bank', '2026-11-01', 'Balance settled', '2026-11-01T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1),
  ('pay-dela-1', 'MG-OR-S-0004', 'MG-OR-S-0004', 'a11e0015-1111-4aa1-8a01-000000000002', NULL, NULL, 'SAMPLE · Dela Cruz family', 'downpayment', 160000, 'gcash', '2026-10-02', 'Paid in full as reservation', '2026-10-02T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1),
  ('pay-santos-1', 'MG-OR-S-0005', 'MG-OR-S-0005', 'a11e0022-1111-4aa1-8a01-000000000003', NULL, NULL, 'SAMPLE · Santos family', 'downpayment', 30000, 'cash', '2026-10-10', NULL, '2026-10-10T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1),
  ('pay-santos-2', 'MG-OR-S-0006', 'MG-OR-S-0006', 'a11e0022-1111-4aa1-8a01-000000000003', NULL, NULL, 'SAMPLE · Santos family', 'balance', 35000, 'cash', '2026-11-20', 'Balance settled', '2026-11-20T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1),
  ('pay-bau-1', 'MG-OR-S-0007', 'MG-OR-S-0007', 'a11e0005-1212-4aa1-8a01-000000000004', 'qte-bautista', 'ctr-bautista', 'SAMPLE · Bautista group', 'downpayment', 60000, 'bank', '2026-10-25', 'Reservation', '2026-10-25T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1),
  ('pay-men-1', 'MG-OR-S-0008', 'MG-OR-S-0008', 'a11e0012-1212-4aa1-8a01-000000000005', 'qte-mendoza', 'ctr-mendoza', 'SAMPLE · Mendoza family', 'downpayment', 110000, 'bank', '2026-10-29', 'Reservation', '2026-10-29T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1),
  ('pay-vil-1', 'MG-OR-S-0009', 'MG-OR-S-0009', 'a11e0020-1212-4aa1-8a01-000000000006', NULL, NULL, 'SAMPLE · Villanueva family', 'reservation', 15000, 'gcash', '2026-11-05', 'Holding fee', '2026-11-05T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1),
  ('pay-ramos-1', 'MG-OR-S-0010', 'MG-OR-S-0010', 'a11e0010-0101-4aa1-8a01-000000000007', NULL, NULL, 'SAMPLE · Ramos family', 'downpayment', 20000, 'maya', '2026-11-12', 'Partial reservation', '2026-11-12T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1);

UPDATE events SET client_id = 'cli-reyes', package_id = 'pkg-garden-wedding', quote_id = 'qte-reyes', coordinator_id = '3f19e8c2-6a54-4b80-9d27-c1e5a0b84731', contract_total = 180000 WHERE id = 'a11e0008-1111-4aa1-8a01-000000000001';
UPDATE events SET client_id = 'cli-delacruz', package_id = 'pkg-debut', coordinator_id = '3f19e8c2-6a54-4b80-9d27-c1e5a0b84731', contract_total = 160000 WHERE id = 'a11e0015-1111-4aa1-8a01-000000000002';
UPDATE events SET client_id = 'cli-santos', package_id = 'pkg-intimate', coordinator_id = '3f19e8c2-6a54-4b80-9d27-c1e5a0b84731', contract_total = 65000 WHERE id = 'a11e0022-1111-4aa1-8a01-000000000003';
UPDATE events SET client_id = 'cli-bautista', package_id = 'pkg-corporate', quote_id = 'qte-bautista', coordinator_id = '3f19e8c2-6a54-4b80-9d27-c1e5a0b84731', contract_total = 120000 WHERE id = 'a11e0005-1212-4aa1-8a01-000000000004';
UPDATE events SET client_id = 'cli-mendoza', package_id = 'pkg-garden-wedding', quote_id = 'qte-mendoza', coordinator_id = '3f19e8c2-6a54-4b80-9d27-c1e5a0b84731', contract_total = 220000 WHERE id = 'a11e0012-1212-4aa1-8a01-000000000005';
UPDATE events SET client_id = 'cli-villanueva', package_id = 'pkg-christening', coordinator_id = '3f19e8c2-6a54-4b80-9d27-c1e5a0b84731', contract_total = 55000 WHERE id = 'a11e0020-1212-4aa1-8a01-000000000006';
UPDATE events SET client_id = 'cli-ramos', package_id = 'pkg-corporate', coordinator_id = '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', contract_total = 95000 WHERE id = 'a11e0010-0101-4aa1-8a01-000000000007';

INSERT OR IGNORE INTO event_details (event_id, headcount, menu, setup, timeline, notes, coordinator_id, updated_at, created_at, created_by, is_sample) VALUES
  ('a11e0008-1111-4aa1-8a01-000000000001', 110, 'Garden buffet: roasted chicken, fish, pasta, salad, lechon, dessert station', 'Long tables in the garden, fairy lights, sweetheart table at the fountain', '2:00 pm ingress, 4:00 pm ceremony nearby, 6:00 pm dinner, 10:00 pm egress', 'Parents asked for a quieter sound after 9 pm.', '3f19e8c2-6a54-4b80-9d27-c1e5a0b84731', '2026-11-08T12:00:00.000Z', '2026-10-20T00:00:00.000Z', '3f19e8c2-6a54-4b80-9d27-c1e5a0b84731', 1),
  ('a11e0015-1111-4aa1-8a01-000000000002', 100, 'Debut buffet and 18 candles cake', 'Ballroom round tables, rose gold runners, debut cotillion floor', '3:00 pm ingress, 6:00 pm program, 11:00 pm egress', NULL, '3f19e8c2-6a54-4b80-9d27-c1e5a0b84731', '2026-11-15T12:00:00.000Z', '2026-10-30T00:00:00.000Z', '3f19e8c2-6a54-4b80-9d27-c1e5a0b84731', 1),
  ('a11e0022-1111-4aa1-8a01-000000000003', 36, 'Set lunch: soup, chicken, pasta, cake', 'The Nook family-style tables', '10:00 am ingress, 12:00 nn lunch, 3:00 pm egress', 'One guest needs a high chair.', '3f19e8c2-6a54-4b80-9d27-c1e5a0b84731', '2026-11-22T12:00:00.000Z', '2026-11-10T00:00:00.000Z', '3f19e8c2-6a54-4b80-9d27-c1e5a0b84731', 1),
  ('a11e0005-1212-4aa1-8a01-000000000004', 80, 'Corporate buffet and coffee station', 'Ballroom banquet, projector and two mics', '9:00 am ingress, 11:30 am program, 2:00 pm egress', 'Need extra extension cords for laptops.', '3f19e8c2-6a54-4b80-9d27-c1e5a0b84731', '2026-11-24T00:00:00.000Z', '2026-11-10T00:00:00.000Z', '3f19e8c2-6a54-4b80-9d27-c1e5a0b84731', 1),
  ('a11e0012-1212-4aa1-8a01-000000000005', 140, 'Wedding buffet with lechon and a raw bar add-on', 'Garden ceremony chairs, reception long tables, sparkle lights', '12:00 nn ingress, 4:00 pm ceremony, 6:00 pm dinner, 11:00 pm egress', 'Spare umbrellas if it drizzles.', '3f19e8c2-6a54-4b80-9d27-c1e5a0b84731', '2026-11-24T00:00:00.000Z', '2026-11-01T00:00:00.000Z', '3f19e8c2-6a54-4b80-9d27-c1e5a0b84731', 1),
  ('a11e0020-1212-4aa1-8a01-000000000006', 40, 'Christening lunch, two cakes', 'The Nook pastel florals, long family table', '10:00 am ingress, 12:00 nn lunch', 'Tentative — confirm menu by Dec 10.', '3f19e8c2-6a54-4b80-9d27-c1e5a0b84731', '2026-11-20T00:00:00.000Z', '2026-11-08T00:00:00.000Z', '3f19e8c2-6a54-4b80-9d27-c1e5a0b84731', 1),
  ('a11e0010-0101-4aa1-8a01-000000000007', 90, 'Birthday lunch buffet', 'Ballroom gold and cream, photo wall', 'Setup day notes still being written.', 'Coordinator is Ana for this date.', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', '2026-11-24T00:00:00.000Z', '2026-11-15T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1);

INSERT OR IGNORE INTO hk_templates (id, name, kind, area_id, is_sample, created_at) VALUES
  ('hkt-pre-venue', 'SAMPLE · Pre-event venue', 'pre', 'area-ballroom', 1, '2026-11-01T00:00:00.000Z'),
  ('hkt-post-venue', 'SAMPLE · Post-event venue', 'post', 'area-ballroom', 1, '2026-11-01T00:00:00.000Z'),
  ('hkt-daily-rest', 'SAMPLE · Daily restrooms', 'daily', 'area-restrooms', 1, '2026-11-01T00:00:00.000Z');

INSERT OR IGNORE INTO hk_template_items (id, template_id, label, sort_order, is_sample) VALUES
  ('hkti-1', 'hkt-pre-venue', 'Sweep and mop floors', 0, 1),
  ('hkti-2', 'hkt-pre-venue', 'Wipe tables and chairs', 1, 1),
  ('hkti-3', 'hkt-pre-venue', 'Check lights and outlets', 2, 1),
  ('hkti-4', 'hkt-pre-venue', 'Stage linens and glassware', 3, 1),
  ('hkti-5', 'hkt-post-venue', 'Clear leftover food and trash', 0, 1),
  ('hkti-6', 'hkt-post-venue', 'Collect linens for laundry', 1, 1),
  ('hkti-7', 'hkt-post-venue', 'Sweep, mop, and reset chairs', 2, 1),
  ('hkti-8', 'hkt-post-venue', 'Note any damage', 3, 1),
  ('hkti-9', 'hkt-daily-rest', 'Restock soap and tissue', 0, 1),
  ('hkti-10', 'hkt-daily-rest', 'Clean sinks and floors', 1, 1);

INSERT OR IGNORE INTO checklists (id, event_id, area_id, kind, title, assigned_to, due, status, notes, created_at, created_by, is_sample) VALUES
  ('hk-reyes-pre', 'a11e0008-1111-4aa1-8a01-000000000001', 'area-garden', 'pre', 'SAMPLE · Pre-event, Amore Garden (Reyes)', '5b02d7a9-8e16-4f45-a3c8-9f6d12b4e078', '2026-11-08', 'inspected', 'Completed and checked', '2026-11-07T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1),
  ('hk-reyes-post', 'a11e0008-1111-4aa1-8a01-000000000001', 'area-garden', 'post', 'SAMPLE · Post-event, Amore Garden (Reyes)', '5b02d7a9-8e16-4f45-a3c8-9f6d12b4e078', '2026-11-09', 'done', NULL, '2026-11-08T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1),
  ('hk-bau-pre', 'a11e0005-1212-4aa1-8a01-000000000004', 'area-ballroom', 'pre', 'SAMPLE · Pre-event, Ballroom (Bautista)', '5b02d7a9-8e16-4f45-a3c8-9f6d12b4e078', '2026-12-04', 'pending', NULL, '2026-11-20T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1),
  ('hk-men-pre', 'a11e0012-1212-4aa1-8a01-000000000005', 'area-garden', 'pre', 'SAMPLE · Pre-event, Amore Garden (Mendoza)', '3f19e8c2-6a54-4b80-9d27-c1e5a0b84731', '2026-12-11', 'pending', 'Lights go up the day before', '2026-11-20T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1),
  ('hk-daily-today', NULL, 'area-restrooms', 'daily', 'SAMPLE · Daily restrooms', '5b02d7a9-8e16-4f45-a3c8-9f6d12b4e078', '2026-11-26', 'in_progress', NULL, '2026-11-25T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1);

INSERT OR IGNORE INTO checklist_items (id, checklist_id, label, done, notes, sort_order, is_sample) VALUES
  ('hki-1', 'hk-reyes-pre', 'Sweep and mop floors', 1, '', 0, 1),
  ('hki-2', 'hk-reyes-pre', 'Wipe tables and chairs', 1, '', 1, 1),
  ('hki-3', 'hk-reyes-pre', 'Check lights and outlets', 1, '', 2, 1),
  ('hki-4', 'hk-reyes-pre', 'Stage linens and glassware', 1, '', 3, 1),
  ('hki-5', 'hk-reyes-post', 'Clear leftover food and trash', 1, '', 0, 1),
  ('hki-6', 'hk-reyes-post', 'Collect linens for laundry', 1, 'Two napkins stained', 1, 1),
  ('hki-7', 'hk-reyes-post', 'Sweep, mop, and reset chairs', 1, '', 2, 1),
  ('hki-8', 'hk-reyes-post', 'Note any damage', 1, 'None', 3, 1),
  ('hki-9', 'hk-bau-pre', 'Sweep and mop floors', 0, '', 0, 1),
  ('hki-10', 'hk-bau-pre', 'Wipe tables and chairs', 0, '', 1, 1),
  ('hki-11', 'hk-bau-pre', 'Check lights and outlets', 0, '', 2, 1),
  ('hki-12', 'hk-bau-pre', 'Stage linens and glassware', 0, '', 3, 1),
  ('hki-13', 'hk-men-pre', 'Sweep and mop floors', 0, '', 0, 1),
  ('hki-14', 'hk-men-pre', 'Hang sparkle lights', 0, '', 1, 1),
  ('hki-15', 'hk-men-pre', 'Stage ceremony chairs', 0, '', 2, 1),
  ('hki-16', 'hk-daily-today', 'Restock soap and tissue', 1, '', 0, 1),
  ('hki-17', 'hk-daily-today', 'Clean sinks and floors', 0, '', 1, 1);

INSERT OR IGNORE INTO issues (id, area_id, event_id, title, detail, status, priority, reported_by, assigned_to, created_at, resolved_at, is_sample) VALUES
  ('iss-light', 'area-garden', 'a11e0008-1111-4aa1-8a01-000000000001', 'SAMPLE · Loose garden spotlight', 'One spotlight near the fountain flickered during ingress. Tightened and tested after the event.', 'resolved', 'normal', '5b02d7a9-8e16-4f45-a3c8-9f6d12b4e078', '3f19e8c2-6a54-4b80-9d27-c1e5a0b84731', '2026-11-08T08:00:00.000Z', '2026-11-09T00:00:00.000Z', 1),
  ('iss-ac', 'area-ballroom', NULL, 'SAMPLE · Ballroom AC lag on the left side', 'Left side feels warmer after an hour. Needs a technician before the Dec 5 lunch.', 'open', 'high', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', '3f19e8c2-6a54-4b80-9d27-c1e5a0b84731', '2026-11-18T00:00:00.000Z', NULL, 1);

INSERT OR IGNORE INTO suppliers (id, name, contact, category, notes, is_sample, created_at) VALUES
  ('sup-market', 'SAMPLE · Palengke run / wet market', '0917 555 0301', 'food', 'Usual produce and meat stall', 1, '2026-11-01T00:00:00.000Z'),
  ('sup-linen', 'SAMPLE · Linen laundry', '0917 555 0302', 'supplies', 'Weekly linen pickup', 1, '2026-11-01T00:00:00.000Z'),
  ('sup-flowers', 'SAMPLE · Neighborhood florist', '0917 555 0303', 'decor', NULL, 1, '2026-11-01T00:00:00.000Z');

INSERT OR IGNORE INTO inventory_items (id, name, category, unit, qty_on_hand, reorder_level, notes, sku, consumable, unit_cost, location_id, is_sample, created_at) VALUES
  ('inv-chairs', 'SAMPLE · Banquet chairs', 'furniture', 'pc', 180, 40, NULL, 'CH-001', 0, 450, 'loc-store', 1, '2026-11-01T00:00:00.000Z'),
  ('inv-rounds', 'SAMPLE · Round tables', 'furniture', 'pc', 20, 6, NULL, 'TB-RND', 0, 2200, 'loc-store', 1, '2026-11-01T00:00:00.000Z'),
  ('inv-longs', 'SAMPLE · Long tables', 'furniture', 'pc', 16, 4, NULL, 'TB-LNG', 0, 2500, 'loc-store', 1, '2026-11-01T00:00:00.000Z'),
  ('inv-linen-w', 'SAMPLE · White table linens', 'linens', 'pc', 24, 10, NULL, 'LN-WHT', 0, 350, 'loc-store', 1, '2026-11-01T00:00:00.000Z'),
  ('inv-napkins', 'SAMPLE · Cloth napkins', 'linens', 'pc', 200, 80, NULL, 'LN-NAP', 0, 25, 'loc-store', 1, '2026-11-01T00:00:00.000Z'),
  ('inv-plates', 'SAMPLE · Dinner plates', 'kitchen', 'pc', 160, 60, NULL, 'KT-PLT', 0, 80, 'loc-kitchen', 1, '2026-11-01T00:00:00.000Z'),
  ('inv-glasses', 'SAMPLE · Water glasses', 'kitchen', 'pc', 140, 50, NULL, 'KT-GLS', 0, 35, 'loc-kitchen', 1, '2026-11-01T00:00:00.000Z'),
  ('inv-soap', 'SAMPLE · Hand soap refill', 'supplies', 'bottle', 8, 6, 'Running low', 'SP-SOAP', 1, 95, 'loc-store', 1, '2026-11-01T00:00:00.000Z'),
  ('inv-trash', 'SAMPLE · Trash bags', 'supplies', 'roll', 5, 4, NULL, 'SP-BAG', 1, 80, 'loc-store', 1, '2026-11-01T00:00:00.000Z'),
  ('inv-lights', 'SAMPLE · Sparkle light strings', 'decor', 'set', 6, 2, NULL, 'DC-LGHT', 0, 750, 'loc-store', 1, '2026-11-01T00:00:00.000Z');

INSERT OR IGNORE INTO inventory_moves (id, item_id, kind, qty, signed_qty, event_id, notes, created_at, created_by, is_sample, location_id) VALUES
  ('m-open-chairs', 'inv-chairs', 'receive', 200, 200, NULL, 'Opening stock', '2026-11-01T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1, 'loc-store'),
  ('m-reyes-chairs', 'inv-chairs', 'issue', 20, -20, 'a11e0008-1111-4aa1-8a01-000000000001', 'Ceremony overflow', '2026-11-08T00:00:00.000Z', '5b02d7a9-8e16-4f45-a3c8-9f6d12b4e078', 1, 'loc-store'),
  ('m-open-soap', 'inv-soap', 'receive', 12, 12, NULL, 'Opening stock', '2026-11-01T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1, 'loc-store'),
  ('m-soap-use', 'inv-soap', 'issue', 4, -4, NULL, 'November restroom use', '2026-11-20T00:00:00.000Z', '5b02d7a9-8e16-4f45-a3c8-9f6d12b4e078', 1, 'loc-store');

INSERT OR IGNORE INTO event_item_allocations (id, event_id, item_id, qty, returned_qty, damaged_qty, notes, is_sample, created_at, created_by) VALUES
  ('al-men-chairs', 'a11e0012-1212-4aa1-8a01-000000000005', 'inv-chairs', 140, 0, 0, 'Ceremony and reception', 1, '2026-11-20T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150'),
  ('al-men-lights', 'a11e0012-1212-4aa1-8a01-000000000005', 'inv-lights', 6, 0, 0, 'Garden lights', 1, '2026-11-20T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150'),
  ('al-bau-rounds', 'a11e0005-1212-4aa1-8a01-000000000004', 'inv-rounds', 10, 0, 0, NULL, 1, '2026-11-20T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150');

INSERT OR IGNORE INTO expenses (id, date, category, payee, amount, method, event_id, notes, created_at, created_by, is_sample, account_id, vat, receipt_no, supplier_id) VALUES
  ('exp-reyes-food', '2026-11-07', 'food', 'SAMPLE · Palengke run / wet market', 22000, 'cash', 'a11e0008-1111-4aa1-8a01-000000000001', 'Wedding market run', '2026-11-07T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1, 'acct-food', 0, 'SM-1107', 'sup-market'),
  ('exp-reyes-flowers', '2026-11-07', 'decor', 'SAMPLE · Neighborhood florist', 8500, 'gcash', 'a11e0008-1111-4aa1-8a01-000000000001', 'Garden flowers', '2026-11-07T00:00:00.000Z', '3f19e8c2-6a54-4b80-9d27-c1e5a0b84731', 1, 'acct-decor', 0, 'FL-1107', 'sup-flowers'),
  ('exp-dela-food', '2026-11-14', 'food', 'SAMPLE · Palengke run / wet market', 18000, 'cash', 'a11e0015-1111-4aa1-8a01-000000000002', 'Debut market run', '2026-11-14T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1, 'acct-food', 0, 'SM-1114', 'sup-market'),
  ('exp-power', '2026-11-15', 'utilities', 'Electric cooperative', 12400, 'bank', NULL, 'November bill (sample figure)', '2026-11-15T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1, 'acct-utilities', 0, 'EL-1115', NULL),
  ('exp-linen', '2026-11-16', 'supplies', 'SAMPLE · Linen laundry', 3200, 'cash', NULL, 'Post-debut laundry', '2026-11-16T00:00:00.000Z', '5b02d7a9-8e16-4f45-a3c8-9f6d12b4e078', 1, 'acct-supplies', 0, 'LN-1116', 'sup-linen'),
  ('exp-fuel', '2026-11-18', 'transport', 'Petrol station', 1800, 'cash', NULL, 'Staff pickup fuel', '2026-11-18T00:00:00.000Z', '3f19e8c2-6a54-4b80-9d27-c1e5a0b84731', 1, 'acct-transport', 0, 'FU-1118', NULL);

INSERT OR IGNORE INTO petty_cash (id, date, kind, amount, reason, expense_id, created_at, created_by, is_sample, method) VALUES
  ('pc-open', '2026-11-01', 'in', 10000, 'SAMPLE · November float', NULL, '2026-11-01T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1, 'cash'),
  ('pc-fuel', '2026-11-18', 'out', 1800, 'SAMPLE · Petrol for staff pickup', 'exp-fuel', '2026-11-18T00:00:00.000Z', '3f19e8c2-6a54-4b80-9d27-c1e5a0b84731', 1, 'cash'),
  ('pc-linen', '2026-11-16', 'out', 3200, 'SAMPLE · Laundry', 'exp-linen', '2026-11-16T00:00:00.000Z', '5b02d7a9-8e16-4f45-a3c8-9f6d12b4e078', 1, 'cash');

INSERT OR IGNORE INTO staff_profiles (user_id, daily_rate, hourly_rate, employment, start_date, notes, is_sample, rate_type, rate, created_at) VALUES
  ('8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1200, NULL, 'full-time', '2024-03-01', 'Venue manager', 1, 'daily', 1200, '2026-11-01T00:00:00.000Z'),
  ('3f19e8c2-6a54-4b80-9d27-c1e5a0b84731', 1000, NULL, 'full-time', '2024-06-15', 'Event coordinator', 1, 'daily', 1000, '2026-11-01T00:00:00.000Z'),
  ('5b02d7a9-8e16-4f45-a3c8-9f6d12b4e078', 900, NULL, 'full-time', '2025-01-10', 'Floor supervisor', 1, 'daily', 900, '2026-11-01T00:00:00.000Z');

INSERT OR IGNORE INTO payroll_periods (id, start_date, end_date, status, notes, created_at, created_by, is_sample) VALUES
  ('payp-nov1', '2026-11-01', '2026-11-15', 'approved', 'SAMPLE · First half of November', '2026-11-16T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1);

INSERT OR IGNORE INTO payroll_lines (id, period_id, user_id, days_worked, hours_worked, gross, sss, philhealth, pagibig, wtax, advances, other_deductions, net, notes, is_sample) VALUES
  ('payl-ana', 'payp-nov1', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 11, 0, 13200, 594, 330, 100, 0, 0, 0, 12176, '', 1),
  ('payl-carlo', 'payp-nov1', '3f19e8c2-6a54-4b80-9d27-c1e5a0b84731', 10, 0, 10000, 450, 250, 100, 0, 2000, 0, 7200, '', 1),
  ('payl-liza', 'payp-nov1', '5b02d7a9-8e16-4f45-a3c8-9f6d12b4e078', 10, 0, 9000, 405, 225, 100, 0, 0, 0, 8270, '', 1);

INSERT OR IGNORE INTO cash_advances (id, user_id, date, amount, reason, status, created_at, created_by, is_sample) VALUES
  ('adv-carlo', '3f19e8c2-6a54-4b80-9d27-c1e5a0b84731', '2026-11-05', 2000, 'SAMPLE · Emergency advance, deducted in the Nov 1–15 payroll', 'deducted', '2026-11-05T00:00:00.000Z', '8a6c2d41-1b7e-4c3a-9f11-0d4e8a7b2150', 1);

INSERT OR IGNORE INTO leave_requests (id, user_id, kind, start_date, end_date, days, reason, status, decided_by, decided_at, created_at, is_sample) VALUES
  ('lv-liza', '5b02d7a9-8e16-4f45-a3c8-9f6d12b4e078', 'vacation', '2026-12-26', '2026-12-27', 2, 'SAMPLE · Family trip after Christmas', 'pending', NULL, NULL, '2026-11-20T00:00:00.000Z', 1);
