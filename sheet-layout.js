/**
 * Google Sheet layout: tab name, column indices (A=0 … I=8), row 1 headers.
 * Data rows start at row 2 (see getAllUsers in index.js).
 */

export const SHEET_NAME = "Sheet1";

/** Last column letter used in range strings (9 columns A–I). */
export const SHEET_ROW_RANGE = "I";

/**
 * Column indices 0-based: A=0 … I=8
 * Must match the sheet tab: Name, Phone, Required docs, Doc progress (JSON), Status, Last updated, Last bot step, Follow-up due, Firm Name.
 * Per-doc links and statuses live only in documentsState JSON (column D).
 * Column H is Yes/No — same rule as server computeNeedsFollowUp (idle since Last updated + pending docs).
 * Column I stores firm name per lead for WhatsApp template variables.
 */
export const COL = {
  name: 0,
  phone: 1,
  requiredDocIds: 2,
  documentsState: 3,
  status: 4,
  lastUpdated: 5,
  lastStep: 6,
  followUpDue: 7,
  firmName: 8,
};

/** Row 1 header labels — length 9; keep aligned with COL. */
export const SHEET_HEADER_ROW = [
  "Name",
  "Phone",
  "Required docs",
  "Doc progress",
  "Status",
  "Last Activity",
  "Last bot step",
  "Follow-up due",
  "Firm Name",
];
