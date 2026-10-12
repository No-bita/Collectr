-- Migration 0004: firm-wide contact phone uniqueness.
--
-- App-level duplicate checks race when two staff members create the same
-- phone concurrently; this index makes the database the arbiter. Safe on
-- backfilled data: migration 0002 gives each legacy user their own firm, and
-- the pre-existing (user_id, phone_number) uniqueness already prevented
-- duplicate phones within what is now a single firm. Contact creation treats
-- a UNIQUE violation here as a duplicate-contact response (409).

CREATE UNIQUE INDEX IF NOT EXISTS unq_contacts_firm_phone ON contacts(firm_id, phone_number);
