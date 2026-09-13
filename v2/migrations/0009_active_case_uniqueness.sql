-- Migration 0009: Active Workflow Uniqueness Constraint
-- Enforces at most one active workflow per client (user_id, phone_number)
-- Active workflows are those with status NOT IN ('closed', 'completed')

CREATE UNIQUE INDEX IF NOT EXISTS unq_active_case_user_phone 
ON loan_cases(user_id, phone_number) 
WHERE status NOT IN ('closed', 'completed');
