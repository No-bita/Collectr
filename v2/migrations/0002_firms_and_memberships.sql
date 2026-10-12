-- Migration 0002: Firms, staff memberships, and firm-scoping of private tables.
--
-- D1 enforces foreign keys while applying migrations (PRAGMA foreign_keys is a
-- no-op inside the migration transaction), so rebuilding contacts/requests/
-- activities via DROP + RENAME would fire ON DELETE CASCADE and wipe child
-- rows. firm_id is therefore added with ALTER TABLE ADD COLUMN ... NOT NULL
-- DEFAULT '' (SQLite cannot add a NOT NULL column without a default) and then
-- backfilled. Application code always sets firm_id explicitly on insert; the
-- empty-string default exists only to make the migration possible.

-- 1. Firms & Memberships
CREATE TABLE IF NOT EXISTS firms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS firm_members (
  firm_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff', -- 'owner' | 'staff'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unq_firm_member UNIQUE(firm_id, user_id),
  FOREIGN KEY(firm_id) REFERENCES firms(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_firm_members_user ON firm_members(user_id);

-- 2. Backfill: one firm per existing user, owned by that user. The firm id is
-- derived from the user id so existing rows can be attached deterministically.
INSERT INTO firms (id, name, created_at)
SELECT 'firm_' || u.id, u.username, datetime('now')
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM firms f WHERE f.id = 'firm_' || u.id);

INSERT INTO firm_members (firm_id, user_id, role, created_at)
SELECT 'firm_' || u.id, u.id, 'owner', datetime('now')
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM firm_members fm WHERE fm.firm_id = 'firm_' || u.id AND fm.user_id = u.id
);

-- 3. contacts: firm ownership + index
ALTER TABLE contacts ADD COLUMN firm_id TEXT NOT NULL DEFAULT '';
UPDATE contacts SET firm_id = (
  SELECT fm.firm_id FROM firm_members fm WHERE fm.user_id = contacts.user_id LIMIT 1
);
CREATE INDEX IF NOT EXISTS idx_contacts_firm ON contacts(firm_id);

-- 4. requests: firm ownership + index
ALTER TABLE requests ADD COLUMN firm_id TEXT NOT NULL DEFAULT '';
UPDATE requests SET firm_id = (
  SELECT fm.firm_id FROM firm_members fm WHERE fm.user_id = requests.user_id LIMIT 1
);
CREATE INDEX IF NOT EXISTS idx_requests_firm ON requests(firm_id);

-- 5. activities: firm ownership + index
ALTER TABLE activities ADD COLUMN firm_id TEXT NOT NULL DEFAULT '';
UPDATE activities SET firm_id = (
  SELECT fm.firm_id FROM firm_members fm WHERE fm.user_id = activities.user_id LIMIT 1
);
CREATE INDEX IF NOT EXISTS idx_activities_firm ON activities(firm_id);
