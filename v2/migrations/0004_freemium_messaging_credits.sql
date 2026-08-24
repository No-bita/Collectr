-- Migration 0004: Freemium Messaging Credits, Financial Ledger & Message Reservations
PRAGMA foreign_keys = OFF;

-- Add credit_balance column to users table (default 900 paise = ₹9.00)
ALTER TABLE users ADD COLUMN credit_balance INTEGER DEFAULT 900;

-- Authoritative Financial Ledger Table
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

-- Business Operation Reservations Table
CREATE TABLE IF NOT EXISTS credit_reservations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount_paise INTEGER NOT NULL,
  reference_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

-- Message Lifecycle & Idempotency Table
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  provider_message_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unq_wa_msg UNIQUE(user_id, idempotency_key)
);

PRAGMA foreign_keys = ON;
