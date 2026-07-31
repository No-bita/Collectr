-- Collectrr v2 Database Schema

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'agent',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS loan_cases (
  id TEXT PRIMARY KEY,
  user_id TEXT,                       -- Primary owner user_id
  is_demo INTEGER DEFAULT 0,          -- 1 for seeded demo cases, 0 for user created
  contact_person TEXT,
  phone_number TEXT NOT NULL,
  loan_product TEXT,                  -- Configurable loan product label e.g. "Working Capital"
  amount_required REAL,               -- Amount in Lacs
  status TEXT NOT NULL DEFAULT 'lead',
  whatsapp_delivery_status TEXT,
  ai_metadata JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

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
  case_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  content TEXT,
  metadata JSON,
  created_by TEXT DEFAULT 'system',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(case_id) REFERENCES loan_cases(id)
);

CREATE TABLE IF NOT EXISTS secure_tokens (
  token TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  fingerprint_hash TEXT,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(case_id) REFERENCES loan_cases(id)
);

CREATE TABLE IF NOT EXISTS system_failures (
  id TEXT PRIMARY KEY,
  error_type TEXT NOT NULL,
  case_id TEXT,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
