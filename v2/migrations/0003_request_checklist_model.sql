-- 0003: document-collection checklist model on requests / request_items (issue #2).
-- Runs after 0002 (firms and memberships), which adds requests.firm_id.

-- requests: checklist metadata. Existing status values are kept; 'draft' and 'closed' are new allowed values.
ALTER TABLE requests ADD COLUMN service_type TEXT;
ALTER TABLE requests ADD COLUMN period_label TEXT;

-- request_items: rebuilt (SQLite cannot change a column default or add a CHECK in place).
-- file_url and s3_key are dropped; files will live in a documents table (issue 5).
-- firm_id follows the 0002 convention (NOT NULL DEFAULT ''; application code always sets it) and is
-- backfilled from the parent request's firm_id.
CREATE TABLE request_items_new (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  firm_id TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  required INTEGER NOT NULL DEFAULT 1 CHECK (required IN (0, 1)),
  allowed_types TEXT NOT NULL DEFAULT 'pdf,jpg,png',
  max_bytes INTEGER NOT NULL DEFAULT 15728640,
  status TEXT NOT NULL DEFAULT 'missing'
    CHECK (status IN ('missing', 'received', 'under_review', 'accepted', 'needs_replacement', 'waived')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(request_id) REFERENCES requests(id) ON DELETE CASCADE
);

INSERT INTO request_items_new (id, request_id, firm_id, title, position, status, created_at, updated_at)
SELECT
  id,
  request_id,
  COALESCE((SELECT r.firm_id FROM requests r WHERE r.id = request_items.request_id), ''),
  title,
  ROW_NUMBER() OVER (PARTITION BY request_id ORDER BY created_at, id) - 1,
  CASE status
    WHEN 'pending' THEN 'missing'
    WHEN 'done' THEN 'accepted'
    WHEN 'waived' THEN 'waived'
    ELSE 'missing'
  END,
  created_at,
  updated_at
FROM request_items;

DROP TABLE request_items;
ALTER TABLE request_items_new RENAME TO request_items;

CREATE INDEX IF NOT EXISTS idx_request_items_request_position ON request_items(request_id, position);
