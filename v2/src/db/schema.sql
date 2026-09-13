-- Collectrr v2 Database Schema

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'agent',
  credit_balance INTEGER DEFAULT 900,
  wa_phone_number_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS unq_users_wa_phone_id ON users(wa_phone_number_id) WHERE wa_phone_number_id IS NOT NULL;

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

CREATE TABLE IF NOT EXISTS loan_cases (
  id TEXT PRIMARY KEY,
  contact_id TEXT,
  user_id TEXT,                       -- Primary owner user_id
  is_demo INTEGER DEFAULT 0,          -- 1 for seeded demo cases, 0 for user created
  contact_person TEXT,
  phone_number TEXT NOT NULL,
  loan_product TEXT,                  -- Configurable loan product / category label e.g. "Working Capital"
  template_name TEXT,                 -- Initial template configured for this Mini Target
  amount_required REAL,               -- Amount in Lacs
  status TEXT NOT NULL DEFAULT 'lead',
  whatsapp_delivery_status TEXT,
  ai_metadata JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(contact_id) REFERENCES contacts(id)
);

CREATE INDEX IF NOT EXISTS idx_loan_cases_contact ON loan_cases(contact_id);
CREATE UNIQUE INDEX IF NOT EXISTS unq_active_case_user_phone ON loan_cases(user_id, phone_number) WHERE status NOT IN ('closed', 'completed');

CREATE TABLE IF NOT EXISTS loan_products (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS required_documents (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  document_type TEXT NOT NULL,        -- e.g. 'pan', 'gst', 'bank_statement'
  label TEXT,                         -- Display name e.g. 'GST Returns'
  status TEXT DEFAULT 'pending',      -- pending | received | waived
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(case_id) REFERENCES loan_cases(id)
);

CREATE TABLE IF NOT EXISTS uploaded_documents (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  required_doc_id TEXT,               -- FK to required_documents
  file_label TEXT,                    -- e.g. "GST Return FY24"
  s3_key TEXT NOT NULL,
  content_type TEXT,
  ocr_payload JSON,
  ocr_status TEXT DEFAULT 'pending',  -- pending | processed | failed | flagged
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(case_id) REFERENCES loan_cases(id),
  FOREIGN KEY(required_doc_id) REFERENCES required_documents(id)
);

CREATE TABLE IF NOT EXISTS case_timeline (
  id TEXT PRIMARY KEY,
  contact_id TEXT,
  case_id TEXT,                       -- mini_target_id (NULL for ambiguous inbound replies)
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

CREATE INDEX IF NOT EXISTS idx_timeline_contact ON case_timeline(contact_id, created_at ASC);
CREATE UNIQUE INDEX IF NOT EXISTS unq_timeline_provider_msg ON case_timeline(provider_message_id) WHERE provider_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS secure_tokens (
  token TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  fingerprint_hash TEXT,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(case_id) REFERENCES loan_cases(id)
);

CREATE TABLE IF NOT EXISTS credit_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount_paise INTEGER NOT NULL,
  balance_after_paise INTEGER NOT NULL,
  transaction_type TEXT NOT NULL,
  reference_type TEXT,
  reference_id TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unq_credit_tx UNIQUE(user_id, reference_id, transaction_type)
);

CREATE TABLE IF NOT EXISTS credit_reservations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount_paise INTEGER NOT NULL,
  reference_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  provider_message_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unq_wa_msg UNIQUE(user_id, idempotency_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS unq_wa_msg_provider_id ON whatsapp_messages(provider_message_id) WHERE provider_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS message_templates (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  name TEXT NOT NULL UNIQUE,
  category TEXT DEFAULT 'UTILITY',
  language TEXT DEFAULT 'en',
  header_type TEXT DEFAULT 'NONE',
  header_text TEXT,
  body_text TEXT NOT NULL,
  footer_text TEXT,
  button_type TEXT DEFAULT 'url',
  button_text TEXT,
  button_url TEXT,
  param_mappings JSON,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_failures (
  id TEXT PRIMARY KEY,
  error_type TEXT NOT NULL,
  case_id TEXT,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS loan_product_doc_mappings (
  product_label TEXT PRIMARY KEY,
  required_doc_ids JSON NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  case_id TEXT,
  contact_id TEXT,
  phone_number TEXT NOT NULL,
  template_name TEXT NOT NULL,
  template_params JSON,
  schedule_type TEXT NOT NULL,
  recurrence_interval TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  status TEXT NOT NULL DEFAULT 'active',
  next_run_utc DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  cancelled_at DATETIME,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(case_id) REFERENCES loan_cases(id),
  FOREIGN KEY(contact_id) REFERENCES contacts(id)
);

CREATE INDEX IF NOT EXISTS idx_schedules_user_status ON schedules(user_id, status);
CREATE INDEX IF NOT EXISTS idx_schedules_next_run ON schedules(status, next_run_utc);

CREATE TABLE IF NOT EXISTS scheduled_occurrences (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL,
  occurrence_key TEXT NOT NULL,
  scheduled_for_utc DATETIME NOT NULL,
  operational_status TEXT NOT NULL DEFAULT 'pending',
  claimed_at DATETIME,
  attempts INTEGER NOT NULL DEFAULT 0,
  provider_message_id TEXT,
  skip_reason TEXT,
  last_error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  executed_at DATETIME,
  FOREIGN KEY(schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
  CONSTRAINT unq_occurrence_schedule_key UNIQUE(schedule_id, occurrence_key)
);

CREATE INDEX IF NOT EXISTS idx_occurrences_claim ON scheduled_occurrences(operational_status, scheduled_for_utc, claimed_at);
CREATE INDEX IF NOT EXISTS idx_occurrences_schedule ON scheduled_occurrences(schedule_id);

