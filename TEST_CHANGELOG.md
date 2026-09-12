# Test Suite Evolution & MECE Hardening Changelog

## Invariant & Philosophy
Every test in the Collectrr V2 suite protects a distinct behavioral, security, or structural contract. No baseline contract is weakened or silently removed. Tautological tests that defined and verified their own local mocks have been converted into production-bound contract assertions. Missing critical security and state machine paths are covered with dedicated integration suites. All tests execute with 100% pass rate in strict offline isolation (`NO_EXTERNAL_NETWORK=true`).

---

## 1. Removed Tests (Proven Duplicates)

| File | Test | Reason for Removal | Superseded By |
|---|---|---|---|
| `credits.test.js` | Test 4: Migration SQL File 0004 Verification | Static file presence and string grep for `0004_freemium_messaging_credits.sql`. Added zero incremental value. | `schema-parity.test.js`, which executes all migrations (0001–0006) sequentially against SQLite and validates table, column, index, and constraint parity against `schema.sql`. |
| `persona-overflow.test.js` | Test 5: Direct Outreach Status column string check | Static regex search in `app.js` for `getWhatsAppDeliveryBadgeHtml`. | `status-filtering.test.js` Tests 1–8, which functionally execute `getDisplayStatus(c, mode)` and assert exact table badge and filter matching. |

---

## 2. Replaced Tests (Tautological → Production-Bound)

| File | Test | Previous Implementation (Weak) | New Production Contract (Strong) |
|---|---|---|---|
| `whatsapp-workflow.test.js` | Test 1: Payload Structure | Locally constructed an inline JavaScript object literal and asserted its own keys. | Imported and executed production `getWhatsAppTemplate("onboarding_first_message").getPayloads(...)`. Verified Meta Graph API payload format, dynamic URL button token, and body variables. |
| `whatsapp-workflow.test.js` | Test 2: Fallback on Failure | Defined local `async function sendWithFallback()` inside the test. | Connected directly to `executeWhatsAppMessagingPipeline`. Tested complete state machine across Branch A (Success: 90 paise deducted, `SENT` status, timeline created), Branch B (Settled Failure: `REFUNDED` reservation, `FAILED` message, `whatsapp_failed` timeline event, credits preserved intact), and Branch C (Graceful Fallback Template Resolution). |
| `whatsapp-workflow.test.js` | Test 3: Hard Cap Enforcement | Defined local `function canRetry(attemptsUsed)` with local math. | Bound directly to production `handleRetryWhatsApp`. Verified attempt counters (attemptsUsed, attemptsLeft) with 0 and 2 existing attempts, and verified that 3 attempts trigger HTTP 400 + `hardCapReached: true`. |
| `whatsapp-workflow.test.js` | Tests 9 & 13: Timeline Event Contracts | Locally defined arbitrary JavaScript objects and asserted on their properties. | Bound to production `renderTemplateBody` and `executeWhatsAppMessagingPipeline` timeline insertion contracts (channel, message_type, rendered body, provider message ID, and delivery status). |
| `credits.test.js` | Test 1: Balance & Conversion Math | Local arithmetic (`900 - 90 = 810`). | Exercised observable production endpoint `handleGetCredits`. Verified balance in paise, balance in rupees, formatted string, and `messagesRemaining` at 900, 810, and 0 paise. |
| `credits.test.js` | Test 2: Status Threshold Rules | Local dummy function `getStatus()`. | Exercised production status engine in `handleGetCredits` across all 4 operational boundaries: `< 90` (`exhausted`), `< 180` (`almost_out`), `<= 450` (`low`), and `> 450` (`normal`). |

---

## 3. Added Integration Test Suites (New Critical Risk Surfaces)

### A. `route-auth.test.js` (Route-Level Authentication, Role Matrix & Cross-Tenant Isolation)
- **Unauthenticated Access (401):** Unauthenticated requests to protected endpoints (`/api/cases`, `/api/admin/templates`) return HTTP 401.
- **Forged JWT (401):** Tokens signed with incorrect secrets or malformed signatures return HTTP 401.
- **Missing / Invalid Role Claims (403):** Valid JWTs with `role: null` or unknown roles attempting admin endpoints return HTTP 403.
- **Role Isolation (403):** Agents (`role: "agent"`) attempting to access admin endpoints (`/api/admin/templates`, `/api/admin/credits/adjust`) are rejected with HTTP 403.
- **Admin Access (Allowed):** Admins (`role: "admin"`) pass authentication and admin middleware on admin routes.
- **Cross-Tenant Data Isolation (P0 Security):** User A requesting `GET /api/cases/:id` or attempting mutations `PATCH /api/cases/:id/status` on User B's case is strictly rejected (HTTP 403) with no data leakage.

### B. `magic-link.test.js` (Upload Session Lifecycle & Security Isolation)
- **Active Token Lifecycle (200):** Valid unexpired token returns case metadata, masked phone number, and required document checklist.
- **Expired Token (403):** Expired tokens return HTTP 403 Session expired.
- **Invalid Token (404):** Non-existent tokens return HTTP 404.
- **Device Fingerprint Binding & Lockout:** First client access binds IP + User-Agent fingerprint. Subsequent access from a different device locks the token (`status = 'locked'`) and returns HTTP 403.
- **Sticky Lockout Persistence:** Once locked, subsequent requests from the original device remain denied (HTTP 403) and cannot reactivate the token.
- **Cross-Case Upload Authorization (400):** Presigned upload requests (`POST /api/upload-url/:token`) validating that `requiredDocId` belongs to the token's case, preventing cross-tenant document injection.

---

## 4. Discovered & Fixed Production Defect

- **Bug in `v2/src/api/session.js` (Line 14):** The SQL query for token resolution (`SELECT s.status, s.expires_at, ...`) omitted `s.fingerprint_hash`. Because `session.fingerprint_hash` was undefined, `if (!session.fingerprint_hash)` evaluated to `true` on every request, allowing attackers on different devices to overwrite the fingerprint rather than being locked out.
- **Fix:** Added `s.fingerprint_hash` to the SELECT clause in `handleSessionRequest`. Verified via `magic-link.test.js` Subtests 4 & 5.

---

## 5. Summary Metrics

- **Previous Baseline:** 91 tests across 13 test files.
- **Current Hardened Suite:** 105 tests across 15 test files.
- **Tautological Tests Remaining:** 0
- **Duplicate Tests Remaining:** 0
- **Pass Rate:** 100% (105 / 105 passing in `npm test` and `npm run test:offline`).
- **Offline Network Isolation:** Enforced via `network-guard.js`.
