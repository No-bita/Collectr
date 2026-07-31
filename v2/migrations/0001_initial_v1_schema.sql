-- Migration 0001: Initial Collectrr V1 Baseline Schema

CREATE TABLE IF NOT EXISTS loan_cases (
  id TEXT PRIMARY KEY,
  contact_person TEXT,
  phone_number TEXT NOT NULL,
  loan_product TEXT,
  amount_required REAL,
  status TEXT NOT NULL DEFAULT 'lead',
  whatsapp_delivery_status TEXT,
  ai_metadata JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS secure_tokens (
  token TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  fingerprint_hash TEXT,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS loan_products (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS required_documents (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  document_type TEXT NOT NULL,
  label TEXT,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS uploaded_documents (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  required_doc_id TEXT,
  file_label TEXT,
  s3_key TEXT NOT NULL,
  content_type TEXT,
  ocr_payload JSON,
  ocr_status TEXT DEFAULT 'pending',
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS case_timeline (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  content TEXT,
  metadata JSON,
  created_by TEXT DEFAULT 'system',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_failures (
  id TEXT PRIMARY KEY,
  error_type TEXT NOT NULL,
  case_id TEXT,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
