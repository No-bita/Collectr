-- Migration 0003: Refactor secure_tokens from legacy lead_id to case_id

-- 1. Backup legacy secure_tokens table
ALTER TABLE secure_tokens RENAME TO secure_tokens_backup;

-- 2. Create canonical V2 secure_tokens table
CREATE TABLE secure_tokens (
  token TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  fingerprint_hash TEXT,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(case_id) REFERENCES loan_cases(id)
);

-- 3. Safely transfer data mapping legacy lead_id to case_id
INSERT INTO secure_tokens (token, case_id, status, fingerprint_hash, expires_at, created_at)
SELECT token, lead_id, status, fingerprint_hash, expires_at, created_at
FROM secure_tokens_backup;
