# Collectrr V2 Test Baseline

**Baseline Commit**: `440eddbafad76ae53a56c42364e7d3c54fe1b953`  
**Date**: September 11, 2026  
**Status**: 71/71 Tests Passing (10 Suites, 0 Failures, 0 Skipped)  
**Execution Command**: `npm test` (`npm --prefix v2 test`)

---

## Test Inventory & Verification Matrix

### Suite 1: Bulk Direct Outreach & Import Engine Tests (`v2/tests/bulk-import.test.js`)
1. CSV/Spreadsheet parser handles RFC 4180 standard and CRLF line breaks
2. Auto-column mapping fuzzy matches borrower name and phone variants
3. Duplicate phone deduplication and 10-digit mobile number normalization
4. Direct outreach bulk case generation with custom template parameter bindings

### Suite 2: Contact, Mini Target & Unified WhatsApp Architecture Tests (`v2/tests/contact-model.test.js`)
1. Phone Number Normalization handles all valid Indian formats and rejects invalid numbers
2. renderTemplateBody renders exact Meta template texts without leakage or reconstruction
3. Webhook Parser extracts Meta Business Phone ID, profile names and delivery status updates
4. verifyWebhookSubscription validates Meta challenge tokens and hub modes
5. Database Model: contacts table uniqueness and relationship integrity

### Suite 3: Freemium Messaging Credits & Financial Engine Tests (`v2/tests/credits.test.js`)
1. Paise Math & Message Conversion Logic
2. Status Threshold Rules
3. DOM Elements Integrity for Recharge Wallet & Badge
4. Migration SQL File 0004 Verification

### Suite 4: DOM Elements, Modal & Flow Integration Tests (`v2/tests/dom-integration.test.js`)
1. Multi-Step Wizard DOM Elements in dashboard.html
2. Document Matrix DOM Elements in dashboard.html
3. WhatsApp Dispatch DOM Elements in dashboard.html
4. Case Detail Workspace DOM Elements in case.html
5. Public Upload Portal DOM Elements in upload.html

### Suite 5: Frontend JavaScript Syntax Integrity & Parse Test (`v2/tests/frontend-syntax.test.js`)
1. Syntax Check: public/js/app.js
2. Syntax Check: public/js/case-detail.js
3. Syntax Check: public/js/icons.js
4. Syntax Check: public/js/ui-components.js
5. Syntax Check: public/js/variant-config.js

### Suite 6: Account Isolation & Persona Overflow Prevention Tests (`v2/tests/persona-overflow.test.js`)
1. getAccessibleCaseFilter strictly scopes to user_id or is_demo for logged-in accounts
2. Verify app.js contains isCaseForPersona and persona-scoped filtering logic
3. Verify CA persona excludes loan products and direct outreach dispatches
4. Verify timeline and notes render WhatsApp delivery status badges
5. Verify Direct Outreach Status column is powered by whatsapp_delivery_status and not c.status

### Suite 7: Message Templates UI & Modal Engine Tests (`v2/tests/templates-ui.test.js`)
1. DOM Elements & Modal Structure in dashboard.html
2. CSS Stylesheet Rules for Live Preview & Modal
3. JavaScript Logic & Admin-Scoping in app.js
4. Dynamic Multi-Component Template Payload Generation for Custom Templates
5. Dynamic Registry Lookup via getWhatsAppTemplate
6. Template Uniqueness and Protection from duplicate names

### Suite 8: Multi-Variant Persona Copy System Tests (`v2/tests/variants.test.js`)
1. variant-config.js script file exists
2. VARIANT_COPY contains complete ca and loan_agent persona definitions
3. getVariantKey() defaults to CA persona when no URL params present
4. getVariantKey() respects ?variant=loan_agent URL parameter

### Suite 9: WhatsApp Workflow Integration Tests (`v2/tests/whatsapp-workflow.test.js`)
1. Primary Template (new_convo_1) Payload Structure
2. Automatic Fallback to hello_world on Primary Failure
3. Hard Cap Enforcement (Max 3 Attempts Allowed)
4. Meta API Error Response Parsing
5. Webhook Subscription Verification (verifyWebhookSubscription)
6. Central WhatsApp Template Registry (getWhatsAppTemplate)
7. Free-Form WhatsApp Text Message Payload Structure
8. Meta 24-Hour Customer Service Window Enforcement (isWithin24HourServiceWindow)
9. Outgoing Free-form Timeline Event & Metadata Contract
10. Webhook Payload Normalizer (parseWebhookPayload)
11. Template Sending Independence from 24-Hour Reply Window
12. Direct Outreach Scoped Template Metadata
13. Template Outgoing Timeline Event Contract

### Suite 10: 3-Screen Creation Wizard UI & Architecture Tests (`v2/tests/wizard_ui.test.js`)
1. HTML Markup Structure Verification
2. CSS Stylesheet Rules Verification
3. JavaScript Wizard State Machine Verification
4. Mobile Number 10-Digit Validation Logic
5. Contact Person Name Special Character Filtering
6. Admin-Only Visibility for Analytics and Observability Tabs
7. Manually Configurable Document Mapping Matrix Architecture

---

## Invariant Rule

Every test in this baseline must continue to pass throughout all refactoring and modularisation phases. No baseline test may be weakened or removed without explicit justification. New tests may be added to expand coverage ($N \ge 71$).
