-- Migration 0005: client_links — expiring, revocable bearer links into a request's
-- upload portal (issue #3).
--
-- Replaces the phantom secure_tokens model (queried by the public session/upload
-- routes but created nowhere, tokens stored in plain text). Only the SHA-256
-- hash of each token is stored; the raw token is returned to staff exactly once
-- at creation and can never be recovered. A link resolves for a client only
-- while it is unrevoked, unexpired, and its request is still open.
-- Intentionally no fingerprint / IP / user-agent columns: clients switch
-- networks mid-flow and must not be locked out.

CREATE TABLE IF NOT EXISTS client_links (
  id TEXT PRIMARY KEY,
  firm_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE, -- SHA-256 hex of the bearer token; the raw token is never stored
  expires_at TEXT NOT NULL, -- ISO-8601 UTC instant after which the link stops resolving
  revoked_at TEXT, -- set when staff revokes (or regenerates) the link; NULL while active
  created_by TEXT NOT NULL, -- users.id of the staff member who created the link
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT, -- set on each successful public resolution; NULL until first use
  FOREIGN KEY(firm_id) REFERENCES firms(id) ON DELETE CASCADE,
  FOREIGN KEY(request_id) REFERENCES requests(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_client_links_request ON client_links(request_id);
CREATE INDEX IF NOT EXISTS idx_client_links_token_hash ON client_links(token_hash);
