-- Migration 0010: Email Outreach Channel & Execution Snapshot

-- 1. Optional email on contacts
ALTER TABLE contacts ADD COLUMN email TEXT;

-- 2. Channel definition on schedules
ALTER TABLE schedules ADD COLUMN channel TEXT NOT NULL DEFAULT 'whatsapp';

-- 3. Execution snapshot columns on scheduled_occurrences
ALTER TABLE scheduled_occurrences ADD COLUMN channel TEXT NOT NULL DEFAULT 'whatsapp';
ALTER TABLE scheduled_occurrences ADD COLUMN recipient_phone TEXT;
ALTER TABLE scheduled_occurrences ADD COLUMN recipient_email TEXT;

-- 4. Template email fields
ALTER TABLE message_templates ADD COLUMN channel TEXT NOT NULL DEFAULT 'whatsapp';
ALTER TABLE message_templates ADD COLUMN subject TEXT;

-- 5. Email messages ledger and atomic dispatch lock
CREATE TABLE IF NOT EXISTS email_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  provider_message_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unq_email_msg UNIQUE(user_id, idempotency_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS unq_email_msg_provider_id 
  ON email_messages(provider_message_id) 
  WHERE provider_message_id IS NOT NULL;
