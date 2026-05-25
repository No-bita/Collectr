-- Schema for Lekho Secure Document Collection Engine

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  phone_number TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'In Progress',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS secure_tokens (
  token TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  status TEXT DEFAULT 'active', -- active, expired, used, locked
  fingerprint_hash TEXT,
  whatsapp_otp TEXT,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(lead_id) REFERENCES leads(id)
);

CREATE TABLE IF NOT EXISTS document_requests (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  document_type TEXT NOT NULL, -- e.g. 'pan', 'aadhaar'
  status TEXT DEFAULT 'pending', -- pending, received, failed
  s3_key TEXT,
  ocr_payload JSON,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(lead_id) REFERENCES leads(id)
);
