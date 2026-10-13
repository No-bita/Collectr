-- Additive bridge: client identity is now independent of CRM contacts.
-- No existing table, row, column or applied migration is removed. Legacy
-- contact foreign keys remain until the separately approved eviction rebuild.
CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  firm_id TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  phone_number TEXT NOT NULL,
  email TEXT,
  company TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (id, firm_id),
  UNIQUE (firm_id, phone_number)
);

INSERT INTO clients (id, firm_id, name, phone_number, email, company, created_at, updated_at)
SELECT id, firm_id, name, phone_number, email, company, created_at, last_updated FROM contacts;

ALTER TABLE requests ADD COLUMN client_id TEXT REFERENCES clients(id) ON DELETE RESTRICT;
ALTER TABLE activities ADD COLUMN client_id TEXT REFERENCES clients(id) ON DELETE RESTRICT;
UPDATE requests SET client_id = contact_id;
UPDATE activities SET client_id = contact_id;
CREATE INDEX idx_requests_client ON requests(firm_id, client_id);
CREATE INDEX idx_activities_client ON activities(firm_id, client_id, created_at);

-- Older contact routes remain usable during this foundation stage. Only new
-- contact inserts are bridged; changing a CRM identity cannot overwrite a
-- dedicated client's identity. IDs stay stable so links and audit rows survive.
CREATE TRIGGER contacts_client_bridge AFTER INSERT ON contacts BEGIN
  INSERT INTO clients (id, firm_id, name, phone_number, email, company)
  SELECT NEW.id, NEW.firm_id, NEW.name, NEW.phone_number, NEW.email, NEW.company
  WHERE NOT EXISTS (SELECT 1 FROM clients WHERE id = NEW.id AND firm_id = NEW.firm_id);
END;

-- SQLite cannot ADD a composite foreign key. Guards enforce firm ownership and
-- the transitional identity mapping until the later table rebuild removes the
-- contact foreign keys. Null client_id is accepted only for old callers and
-- filled immediately in the same statement transaction.
CREATE TRIGGER requests_client_guard_insert BEFORE INSERT ON requests BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM clients
    WHERE id = COALESCE(NEW.client_id, NEW.contact_id) AND firm_id = NEW.firm_id)
    OR COALESCE(NEW.client_id, NEW.contact_id) != NEW.contact_id
    THEN RAISE(ABORT, 'invalid_request_client') END;
END;
CREATE TRIGGER requests_client_guard_update BEFORE UPDATE OF client_id, contact_id, firm_id ON requests BEGIN
  SELECT CASE WHEN NEW.client_id IS NULL OR NEW.client_id != NEW.contact_id
    OR NOT EXISTS (SELECT 1 FROM clients WHERE id = NEW.client_id AND firm_id = NEW.firm_id)
    THEN RAISE(ABORT, 'invalid_request_client') END;
END;
CREATE TRIGGER requests_client_bridge AFTER INSERT ON requests WHEN NEW.client_id IS NULL BEGIN
  UPDATE requests SET client_id = NEW.contact_id WHERE id = NEW.id;
END;
CREATE TRIGGER activities_client_guard_insert BEFORE INSERT ON activities BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM clients
    WHERE id = COALESCE(NEW.client_id, NEW.contact_id) AND firm_id = NEW.firm_id)
    OR COALESCE(NEW.client_id, NEW.contact_id) != NEW.contact_id
    THEN RAISE(ABORT, 'invalid_activity_client') END;
END;
CREATE TRIGGER activities_client_guard_update BEFORE UPDATE OF client_id, contact_id, firm_id ON activities BEGIN
  SELECT CASE WHEN NEW.client_id IS NULL OR NEW.client_id != NEW.contact_id
    OR NOT EXISTS (SELECT 1 FROM clients WHERE id = NEW.client_id AND firm_id = NEW.firm_id)
    THEN RAISE(ABORT, 'invalid_activity_client') END;
END;
CREATE TRIGGER activities_client_bridge AFTER INSERT ON activities WHEN NEW.client_id IS NULL BEGIN
  UPDATE activities SET client_id = NEW.contact_id WHERE id = NEW.id;
END;
