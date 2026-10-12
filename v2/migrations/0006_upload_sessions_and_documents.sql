-- Issue #5: upload intent is separate from verified document receipt.
-- Composite foreign keys enforce firm/request/item/link consistency even for
-- callers that bypass the model. Parent IDs remain globally unique.
CREATE UNIQUE INDEX IF NOT EXISTS idx_requests_id_firm ON requests(id, firm_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_request_items_id_request_firm ON request_items(id, request_id, firm_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_links_id_request_firm ON client_links(id, request_id, firm_id);

CREATE TABLE IF NOT EXISTS upload_sessions (
  id TEXT PRIMARY KEY,
  firm_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  link_id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  declared_content_type TEXT NOT NULL,
  declared_size INTEGER NOT NULL CHECK (declared_size > 0),
  original_filename TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'initiated' CHECK (state IN ('initiated', 'completed', 'expired', 'failed')),
  expires_at TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  idempotency_key TEXT NOT NULL,
  UNIQUE (link_id, idempotency_key),
  UNIQUE (id, item_id, request_id, firm_id, object_key),
  CHECK (object_key = 'firms/' || firm_id || '/requests/' || request_id || '/' || id),
  CHECK ((state = 'completed' AND completed_at IS NOT NULL) OR (state != 'completed' AND completed_at IS NULL)),
  FOREIGN KEY (firm_id) REFERENCES firms(id) ON DELETE CASCADE,
  FOREIGN KEY (request_id, firm_id) REFERENCES requests(id, firm_id) ON DELETE CASCADE,
  FOREIGN KEY (item_id, request_id, firm_id) REFERENCES request_items(id, request_id, firm_id) ON DELETE CASCADE,
  FOREIGN KEY (link_id, request_id, firm_id) REFERENCES client_links(id, request_id, firm_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_item ON upload_sessions(firm_id, request_id, item_id);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_expiry ON upload_sessions(state, expires_at);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  firm_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  upload_session_id TEXT NOT NULL UNIQUE,
  object_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  etag TEXT NOT NULL,
  sha256 TEXT,
  version INTEGER NOT NULL CHECK (version >= 1),
  state TEXT NOT NULL DEFAULT 'received' CHECK (state IN ('received', 'under_review', 'accepted', 'rejected', 'superseded')),
  uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (item_id, version),
  FOREIGN KEY (firm_id) REFERENCES firms(id) ON DELETE CASCADE,
  FOREIGN KEY (request_id, firm_id) REFERENCES requests(id, firm_id) ON DELETE CASCADE,
  FOREIGN KEY (item_id, request_id, firm_id) REFERENCES request_items(id, request_id, firm_id) ON DELETE CASCADE,
  FOREIGN KEY (upload_session_id, item_id, request_id, firm_id, object_key)
    REFERENCES upload_sessions(id, item_id, request_id, firm_id, object_key) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_documents_item ON documents(firm_id, request_id, item_id, version);
