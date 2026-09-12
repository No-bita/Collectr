-- Migration 0008: Schedules & Scheduled Occurrences Engine

CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  case_id TEXT,
  contact_id TEXT,
  phone_number TEXT NOT NULL,
  template_name TEXT NOT NULL,
  template_params JSON,
  schedule_type TEXT NOT NULL,         -- 'one_off' | 'recurring'
  recurrence_interval TEXT,            -- 'daily' | 'weekly' | 'monthly' (NULL for one_off)
  timezone TEXT NOT NULL DEFAULT 'UTC', -- IANA timezone (e.g. 'Asia/Kolkata')
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'paused' | 'completed' | 'cancelled'
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
  occurrence_key TEXT NOT NULL,        -- Deterministic: e.g. `${schedule_id}_${scheduled_for_utc}`
  scheduled_for_utc DATETIME NOT NULL,
  operational_status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'claimed' | 'completed' | 'failed' | 'unknown' | 'skipped'
  claimed_at DATETIME,                 -- Recovery lease timestamp for crash protection
  attempts INTEGER NOT NULL DEFAULT 0,
  provider_message_id TEXT,
  skip_reason TEXT,                    -- e.g. 'case_closed', 'insufficient_credits', 'cancelled', 'invalid_phone'
  last_error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  executed_at DATETIME,
  FOREIGN KEY(schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
  CONSTRAINT unq_occurrence_schedule_key UNIQUE(schedule_id, occurrence_key)
);

CREATE INDEX IF NOT EXISTS idx_occurrences_claim ON scheduled_occurrences(operational_status, scheduled_for_utc, claimed_at);
CREATE INDEX IF NOT EXISTS idx_occurrences_schedule ON scheduled_occurrences(schedule_id);
