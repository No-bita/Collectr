-- Migration 0002: Add Users Table and Multi-Tenancy Scoping Columns
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'agent',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table Reconstruction for loan_cases to add user_id and is_demo deterministically
CREATE TABLE IF NOT EXISTS loan_cases_new (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  is_demo INTEGER DEFAULT 0,
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

INSERT INTO loan_cases_new (id, user_id, is_demo, contact_person, phone_number, loan_product, amount_required, status, whatsapp_delivery_status, ai_metadata, created_at, last_updated)
SELECT id, COALESCE(user_id, 'system'), COALESCE(is_demo, 1), contact_person, phone_number, loan_product, amount_required, status, whatsapp_delivery_status, ai_metadata, created_at, last_updated
FROM loan_cases;

DROP TABLE loan_cases;
ALTER TABLE loan_cases_new RENAME TO loan_cases;

PRAGMA foreign_keys = ON;
