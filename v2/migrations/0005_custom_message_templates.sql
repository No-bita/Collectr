-- Migration 0005: Comprehensive Custom Message Templates
PRAGMA foreign_keys = OFF;

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

PRAGMA foreign_keys = ON;
