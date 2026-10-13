-- Issue #10: append-only audit trail for staff review actions.
-- Composite foreign keys keep every event inside one firm/request/item.
CREATE TABLE IF NOT EXISTS review_events (
  id TEXT PRIMARY KEY,
  firm_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  document_id TEXT,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('staff')),
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('accept', 'needs_replacement', 'waive')),
  reason TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (firm_id) REFERENCES firms(id) ON DELETE CASCADE,
  FOREIGN KEY (request_id, firm_id) REFERENCES requests(id, firm_id) ON DELETE CASCADE,
  FOREIGN KEY (item_id, request_id, firm_id) REFERENCES request_items(id, request_id, firm_id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_review_events_item ON review_events(firm_id, request_id, item_id, created_at);
