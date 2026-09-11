-- Migration 0006: Contact, Mini Target & Unified Messaging Architecture
PRAGMA foreign_keys = OFF;

-- 1. Add wa_phone_number_id to users with UNIQUE constraint for tenant webhook routing
ALTER TABLE users ADD COLUMN wa_phone_number_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS unq_users_wa_phone_id ON users(wa_phone_number_id) WHERE wa_phone_number_id IS NOT NULL;

-- 2. Contacts Table (Scoped strictly by user_id)
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unq_user_contact_phone UNIQUE(user_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_contacts_user_phone ON contacts(user_id, phone_number);

-- 3. Add contact_id and template_name to loan_cases (Mini Targets)
ALTER TABLE loan_cases ADD COLUMN contact_id TEXT REFERENCES contacts(id);
ALTER TABLE loan_cases ADD COLUMN template_name TEXT;
CREATE INDEX IF NOT EXISTS idx_loan_cases_contact ON loan_cases(contact_id);

-- 4. Reconstruct case_timeline to allow nullable case_id for contacts and add new columns
CREATE TABLE IF NOT EXISTS case_timeline_new (
  id TEXT PRIMARY KEY,
  contact_id TEXT,
  case_id TEXT,
  provider_message_id TEXT,
  template_name TEXT,
  event_type TEXT NOT NULL,
  content TEXT,
  metadata JSON,
  created_by TEXT DEFAULT 'system',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(contact_id) REFERENCES contacts(id),
  FOREIGN KEY(case_id) REFERENCES loan_cases(id)
);

INSERT INTO case_timeline_new (id, case_id, event_type, content, metadata, created_by, created_at)
SELECT id, case_id, event_type, content, metadata, created_by, created_at
FROM case_timeline;

DROP TABLE case_timeline;
ALTER TABLE case_timeline_new RENAME TO case_timeline;

CREATE INDEX IF NOT EXISTS idx_timeline_contact ON case_timeline(contact_id, created_at ASC);
CREATE UNIQUE INDEX IF NOT EXISTS unq_timeline_provider_msg ON case_timeline(provider_message_id) WHERE provider_message_id IS NOT NULL;

-- 5. Add unique index on whatsapp_messages.provider_message_id
CREATE UNIQUE INDEX IF NOT EXISTS unq_wa_msg_provider_id ON whatsapp_messages(provider_message_id) WHERE provider_message_id IS NOT NULL;

-- 6. Audit table for historical unparseable numbers during migration
CREATE TABLE IF NOT EXISTS migration_unresolved_cases (
  case_id TEXT PRIMARY KEY,
  user_id TEXT,
  raw_phone TEXT,
  contact_person TEXT,
  reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. Deterministic Backfill of Contacts from existing loan_cases
-- Only migrate numbers matching strict 10-digit, 11-digit (leading 0), or 12-digit (leading 91)
INSERT OR IGNORE INTO contacts (id, user_id, contact_person, phone_number, created_at, last_updated)
SELECT 
  'cnt_' || lower(hex(randomblob(8))),
  user_id,
  (
    SELECT lc2.contact_person 
    FROM loan_cases lc2 
    WHERE lc2.user_id = lc.user_id 
      AND (
        CASE 
          WHEN length(lc2.phone_number) = 10 THEN '91' || lc2.phone_number
          WHEN length(lc2.phone_number) = 11 AND lc2.phone_number LIKE '0%' THEN '91' || substr(lc2.phone_number, 2)
          WHEN length(lc2.phone_number) = 12 AND lc2.phone_number LIKE '91%' THEN lc2.phone_number
        END
      ) = (
        CASE 
          WHEN length(lc.phone_number) = 10 THEN '91' || lc.phone_number
          WHEN length(lc.phone_number) = 11 AND lc.phone_number LIKE '0%' THEN '91' || substr(lc.phone_number, 2)
          WHEN length(lc.phone_number) = 12 AND lc.phone_number LIKE '91%' THEN lc.phone_number
        END
      )
      AND lc2.contact_person IS NOT NULL AND trim(lc2.contact_person) != ''
    ORDER BY lc2.created_at ASC 
    LIMIT 1
  ) AS contact_person,
  CASE 
    WHEN length(lc.phone_number) = 10 THEN '91' || lc.phone_number
    WHEN length(lc.phone_number) = 11 AND lc.phone_number LIKE '0%' THEN '91' || substr(lc.phone_number, 2)
    WHEN length(lc.phone_number) = 12 AND lc.phone_number LIKE '91%' THEN lc.phone_number
  END AS canonical_phone,
  MIN(lc.created_at),
  MAX(lc.last_updated)
FROM loan_cases lc
WHERE (length(lc.phone_number) = 10 AND lc.phone_number NOT LIKE '91%')
   OR (length(lc.phone_number) = 11 AND lc.phone_number LIKE '0%')
   OR (length(lc.phone_number) = 12 AND lc.phone_number LIKE '91%')
GROUP BY user_id, canonical_phone;

-- 8. Backfill loan_cases.contact_id
UPDATE loan_cases
SET contact_id = (
  SELECT c.id FROM contacts c 
  WHERE c.user_id = loan_cases.user_id 
    AND c.phone_number = (
      CASE 
        WHEN length(loan_cases.phone_number) = 10 THEN '91' || loan_cases.phone_number
        WHEN length(loan_cases.phone_number) = 11 AND loan_cases.phone_number LIKE '0%' THEN '91' || substr(loan_cases.phone_number, 2)
        WHEN length(loan_cases.phone_number) = 12 AND loan_cases.phone_number LIKE '91%' THEN loan_cases.phone_number
        ELSE loan_cases.phone_number
      END
    )
);

-- 9. Backfill case_timeline.contact_id from loan_cases
UPDATE case_timeline
SET contact_id = (
  SELECT lc.contact_id FROM loan_cases lc WHERE lc.id = case_timeline.case_id
);

PRAGMA foreign_keys = ON;
