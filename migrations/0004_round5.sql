-- Round 5: stop a quote from creating more than one event or contract.
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_quote_id_unique ON events(quote_id) WHERE quote_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_quote_id_unique ON contracts(quote_id) WHERE quote_id IS NOT NULL;
