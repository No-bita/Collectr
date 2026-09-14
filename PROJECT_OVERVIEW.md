# Collectrr V2 — Technical Architecture & System Guide

Welcome to the Collectrr architectural and engineering guide. This document provides an exhaustive, authoritative breakdown of how Collectrr works under the hood for contributors, architects, and engineers modifying the system.

---

## 1. System Vision & Domain Model

Collectrr is a serverless, edge-deployed document collection, intake, and client coordination platform built for two primary financial personas:
1. **Chartered Accountants (CAs)**: Automating periodic compliance collection (ITR filing documents, GST monthly returns, Tax Audit schedules).
2. **Loan Brokers & DSAs**: Streamlining borrower documentation (PAN, Aadhaar, salary slips, bank statements, property papers).

### Core Problem Solved
Traditional document collection involves endless back-and-forth email/WhatsApp chasing, uncompressed images, missing paperwork, and manual verification. Collectrr automates:
- Direct WhatsApp outreach using Meta Cloud API templates with dynamic upload tokens.
- Mobile-first client upload portal with zero login friction.
- Object storage presigned uploads to Cloudflare R2.
- Automated OCR verification using Gemini 2.5 Flash to classify documents, extract structured fields, detect anomalies, and auto-advance case review statuses.

---

## 2. Architecture & Tech Stack

```mermaid
graph TD
    Client["Client / Borrower"] -->|Opens WhatsApp Link| UploadPortal["Upload Portal (/upload.html?t=token)"]
    UploadPortal -->|Uploads Document| R2[("Cloudflare R2 Storage")]
    UploadPortal -->|Complete Webhook| Worker["Hono Edge Worker (Cloudflare Workers)"]
    
    Worker -->|Async Background Task| Gemini["Gemini 2.5 Flash OCR"]
    Gemini -->|Structured Data| Worker
    Worker -->|Updates Status & Ledger| D1[("Cloudflare D1 (SQLite)")]
    
    Agent["CA / Loan Broker"] -->|Dashboard /app| Dashboard["Agent Operations Dashboard"]
    Dashboard -->|Dispatches Follow-up| Worker
    Worker -->|Graph API| Meta["Meta WhatsApp Cloud API"]
    Meta -->|Delivers Notification| Client
```

### Component Stack
| Layer | Technology | Purpose |
|---|---|---|
| **Edge Compute** | Cloudflare Workers + Hono v4 | Ultra-low latency API routing and static asset delivery at edge points of presence worldwide. |
| **Database** | Cloudflare D1 (Edge SQLite) | ACID transactional database storing cases, timeline events, contacts, templates, and credit ledgers. |
| **Blob Storage** | Cloudflare R2 | S3-compatible, zero-egress fee object storage for client documents. |
| **Messaging** | Meta WhatsApp Business Cloud API | Direct notification templates and 24-hour two-way client chat. |
| **AI Extraction** | Google Gemini 2.5 Flash | Multimodal document parsing, anomaly detection, and structured field extraction. |
| **Frontend** | Vanilla JS + Modern Design System | Zero-framework-overhead, highly responsive operations dashboard and mobile upload portal. |

---

## 3. Directory Map & Component Responsibilities

```text
Lekho-Edge/
├── README.md                          # Repository overview, quickstart & dev commands
├── PROJECT_OVERVIEW.md                # This document: architecture, flows & contracts
├── CONTRIBUTING.md                    # Contributor guide & coding standards
├── SECURITY.md                        # Vulnerability reporting & key rotation policy
├── BASELINE.md                        # Cryptographic test baseline inventory
├── LICENSE                            # Open source license (MIT)
├── package.json                       # Root developer entry point
│
└── v2/                                # Active Collectrr V2 Edge Application
    ├── package.json                   # Edge worker package definition & scripts
    ├── wrangler.toml                  # Cloudflare Worker bindings (sanitized)
    ├── wrangler.toml.example          # Example deployment configuration
    ├── .dev.vars.example              # Example local secrets with mock flags
    │
    ├── migrations/                    # D1 Database Migrations (0001 → 0010)
    │   ├── 0001_initial_v1_schema.sql
    │   ├── 0002_add_users_and_multi_tenancy.sql
    │   ├── 0003_refactor_lead_to_case_tokens.sql
    │   ├── 0004_freemium_messaging_credits.sql
    │   ├── 0005_custom_message_templates.sql
    │   ├── 0006_contacts_and_mini_targets.sql
    │   ├── 0007_loan_product_doc_mappings.sql
    │   ├── 0008_schedules.sql
    │   ├── 0009_active_case_uniqueness.sql
    │   └── 0010_email_outreach_channel.sql
    │
    ├── src/                           # Backend Application Code
    │   ├── index.js                   # Worker entrypoint, router dispatcher & scheduled/queue handlers
    │   ├── middleware/
    │   │   ├── auth.js                # JWT session verification & dev-mode bypass
    │   │   └── cors.js                # CORS headers & preflight handler
    │   ├── api/                       # REST API controllers
    │   │   ├── auth.js                # Login, registration, password hashing
    │   │   ├── cases.js               # Case CRUD, document checklists, CSV bulk import & deduplication
    │   │   ├── contacts.js            # Contact directory & timeline consolidation
    │   │   ├── schedules.js           # One-off schedule creation, listing, cancellation & safe retry
    │   │   ├── upload.js              # Token validation, presigned R2 URLs, direct upload
    │   │   ├── ocr.js                 # Gemini 2.5 Flash OCR trigger & mock adapter
    │   │   ├── templates.js           # WhatsApp template CRUD & uniqueness enforcement
    │   │   ├── credits.js             # Financial ledger, recharge wallet, paise math
    │   │   ├── webhook.js             # Meta webhook verification & delivery status parser
    │   │   └── admin.js               # Matrix rule editor & failure log viewer
    │   ├── email/                     # Outbound Email Outreach Module (Resend)
    │   │   ├── client.js              # Resend REST client with Idempotency-Key support & dev mock
    │   │   ├── templates.js           # Responsive HTML & plain-text email renderer with upload links
    │   │   └── pipeline.js            # Authoritative email dispatch pipeline with atomic locks
    │   ├── scheduler/                 # Asynchronous Scheduling Engine
    │   │   ├── time.js                # One-off timezone converter preserving IANA wall-clock times
    │   │   ├── scanner.js             # Cron scanner with 10-minute crash-window recovery leases
    │   │   └── consumer.js            # Queue consumer with channel routing & JIT credit validation
    │   ├── whatsapp/
    │   │   ├── client.js              # Meta Graph API client & offline mock adapter
    │   │   ├── templates.js           # Template registry, token payload builder
    │   │   └── webhook.js             # Webhook payload normalization
    │   └── db/
    │       ├── client.js              # D1 client wrapper & migration self-heal
    │       └── schema.sql             # Authoritative cumulative database schema
    │
    ├── public/                        # Frontend Static Web Portals
    │   ├── index.html                 # Marketing landing page
    │   ├── dashboard.html             # Operations dashboard (/dashboard.html or /app)
    │   ├── case.html                  # Case detail & timeline workspace
    │   ├── upload.html                # Mobile client upload portal
    │   ├── login.html & register.html # Agent authentication views
    │   ├── css/                       # Vanilla CSS stylesheets (dashboard.css)
    │   └── js/                        # Modular frontend scripts
    │       ├── core/                  # Shared utilities
    │       │   ├── api.js             # authFetch & session handling
    │       │   ├── state.js           # Minimal global application state
    │       │   ├── dom.js             # el, escapeHtml, formatters
    │       │   └── events.js          # Event bus
    │       ├── modules/               # Feature modules
    │       │   ├── auth.js            # User profile, role badges, logout
    │       │   ├── wallet.js          # Credit balance, recharge modal, transactions
    │       │   ├── templates.js       # Template manager, live WhatsApp bubble
    │       │   └── admin.js           # Matrix configurator
    │       ├── app.js                 # Dashboard bootstrapper & event orchestrator
    │       ├── case-detail.js         # Case detail view controller
    │       ├── variant-config.js      # Persona copy definitions (CA vs loan_agent)
    │       └── ui-components.js       # Toast & confirmation dialogs
    │
    └── tests/                         # Node.js TAP Test Suite
        ├── helpers/
        │   └── network-guard.js       # Outbound network denial guard
        ├── schema-parity.test.js      # Deep schema parity verification
        ├── mock-adapters.test.js      # Offline WhatsApp & Gemini mock verification
        ├── whatsapp-workflow.test.js  # Template failover & 24h window tests
        ├── templates-ui.test.js       # Template uniqueness & live preview tests
        ├── credits.test.js            # Paise math & recharge ledger tests
        ├── bulk-import.test.js        # CSV/Excel parsing, deduplication & auto-mapping tests
        ├── persona-overflow.test.js   # CA vs Loan Agent isolation tests
        ├── status-filtering.test.js   # Mode-dependent status presentation & filtering tests
        ├── wizard_ui.test.js          # 3-Screen wizard state machine tests
        ├── dom-integration.test.js    # HTML DOM element integrity tests
        ├── contact-model.test.js      # Phone normalization & contact relationship tests
        ├── route-auth.test.js         # Hono route auth, role matrix & cross-tenant isolation tests
        ├── magic-link.test.js         # Magic link session lifecycle, fingerprinting & upload tests
        ├── scheduling.test.js         # Scheduling engine, timezone conversion & queue consumer tests
        ├── schedule-ui.test.js        # Compact scheduling popovers & bulk dispatch invariants
        └── frontend-syntax.test.js    # JS parse & syntax check
```

---

## 4. End-to-End Execution Flows

### Flow 1: Case Creation & Dynamic Document Matrix
```mermaid
sequenceDiagram
    autonumber
    actor Agent
    participant Dashboard as Dashboard (wizard.js)
    participant Worker as Hono Edge Worker
    participant D1 as D1 Database
    participant WhatsApp as Meta WhatsApp API

    Agent->>Dashboard: Enters borrower name & 10-digit phone
    Agent->>Dashboard: Selects product (e.g. "Working Capital")
    Dashboard->>Worker: GET /api/admin/loan-product-mappings
    Worker-->>Dashboard: Returns recommended doc IDs (PAN, GST, Bank)
    Dashboard->>Agent: Displays configured checklist
    Agent->>Dashboard: Clicks "Create & Send WhatsApp"
    Dashboard->>Worker: POST /api/cases
    Worker->>D1: Inserts contact, loan_case, required_documents, secure_token
    Worker->>WhatsApp: Dispatches new_convo_1 template with upload link
    WhatsApp-->>Worker: Returns wamid (Message ID)
    Worker->>D1: Records case_timeline event & updates status to 'lead'
    Worker-->>Dashboard: Success { caseId, token }
```

### Flow 2: Client Magic Link & Document Upload
```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant UploadPortal as Upload Portal (/upload.html)
    participant Worker as Hono Edge Worker
    participant R2 as Cloudflare R2
    participant Gemini as Gemini 2.5 Flash
    participant D1 as D1 Database

    Client->>UploadPortal: Opens link (/upload.html?t=secure_token)
    UploadPortal->>Worker: GET /api/session/:token
    Worker->>D1: Validates token active & unexpired
    Worker-->>UploadPortal: Returns case info & required document slots
    Client->>UploadPortal: Selects file to upload
    UploadPortal->>Worker: POST /api/upload-url/:token (or direct upload)
    Worker-->>UploadPortal: Presigned S3 PUT URL (or direct buffer)
    UploadPortal->>R2: Uploads binary file directly
    UploadPortal->>Worker: POST /api/upload-complete/:token
    Worker->>D1: Marks required_document status='received'
    Worker->>Gemini: Async runGeminiOcr(s3Key)
    Gemini-->>Worker: Structured extraction { anomaly, documentType, fields }
    Worker->>D1: Saves ocr_payload; if all docs received, auto-advances to 'ready_for_review'
```

### Flow 3: WhatsApp Dispatch Failover
```mermaid
sequenceDiagram
    autonumber
    participant Worker as whatsappService
    participant Meta as Meta Graph API

    Worker->>Meta: Send primary template (e.g. new_convo_1)
    alt Primary Succeeds
        Meta-->>Worker: HTTP 200 { wamid }
    else Template Error (#132001 or unapproved)
        Meta-->>Worker: HTTP 400 Template Error
        Worker->>Worker: Failover: Attempt fallback template (hello_world)
        Worker->>Meta: Send hello_world template
        Meta-->>Worker: HTTP 200 { wamid }
    end
```

### Flow 4: WhatsApp Template Dispatch & UI Bubble Reconstruction
```mermaid
sequenceDiagram
    autonumber
    participant Agent as Agent / Frontend
    participant API as Hono Backend (/api/cases)
    participant DB as Cloudflare D1 (SQLite)
    participant Meta as Meta WhatsApp Cloud API
    participant ClientPhone as Recipient Phone

    Agent->>API: POST /api/cases (with templateName: "do_ca")
    API->>API: Compute renderedBody = renderTemplateBody(templateName, params)
    API->>Meta: POST /messages { type: "template", template: { name: "do_ca", language: { code: "en_IN" } } }
    Note over API,Meta: Meta API does NOT accept custom text; it delivers the copy approved in WhatsApp Business Manager.
    Meta->>ClientPhone: Delivers registered copy of "do_ca"
    Meta-->>API: HTTP 200 { messages: [{ id: "wamid.xxx" }] }
    API->>DB: INSERT INTO case_timeline (event_type: "whatsapp_sent", content: renderedBody, template_name: "do_ca")
    
    Note over Agent,DB: UI Display Lifecycle (case.html / case-detail.js)
    Agent->>API: GET /api/cases/:id & GET /api/cases/:id/timeline
    API-->>Agent: Case payload { templateName: "do_ca" } and timeline events
    alt Timeline event exists (whatsapp_sent)
        Agent->>Agent: Render chat bubble with exact t.content stored in timeline
    else Fallback (events empty or pending)
        Agent->>Agent: Resolve tplName via (c.templateName || c.template_name || c.messageTemplate)
        Agent->>Agent: Display template body for resolved tplName (avoids fallback to onboarding_first_message)
    end
```

### Flow 5: Mode-Dependent Status Architecture (Single Source of Truth)
```mermaid
flowchart TD
    CaseData["Case Object (c)"] --> Helper["getDisplayStatus(c, mode)"]
    Helper --> |direct_outreach| DeliveryStatus["c.whatsappDeliveryStatus || c.whatsapp_delivery_status || 'pending'"]
    Helper --> |default (ca / loan_agent)| LifecycleStatus["c.status ('lead', 'documents_pending', ...)"]
    
    DeliveryStatus --> Dropdown["populateStatusFilter(): Sorted by WHATSAPP_STATUS_ORDER"]
    DeliveryStatus --> Filter["render(): selectedStatus !== 'all' && displayStatus !== selectedStatus"]
    DeliveryStatus --> TableBadge["render(): getWhatsAppDeliveryBadgeHtml(displayStatus)"]
    
    LifecycleStatus --> Dropdown
    LifecycleStatus --> Filter
    LifecycleStatus --> TableBadge
```
*Invariant:* **Whatever status the user sees in the Status column is exactly the status they can filter by.** Dropdown, filter evaluation, and table cell rendering all consume the single `getDisplayStatus(c, mode)` abstraction. The top delivery summary triage metrics (Sent, Delivered, Read, Replied) calculate cumulative delivery funnel totals matching WhatsApp Meta reporting (Sent includes all delivered/read/replied, Delivered includes all read/replied, Read includes all replied).

### Flow 6: Asynchronous Bulk Import & Delivery Queue Architecture
```mermaid
sequenceDiagram
    autonumber
    actor User as Agent / Broker
    participant API as /api/cases/bulk (Hono Worker)
    participant D1 as Cloudflare D1 (Execution Ledger)
    participant Q as Cloudflare Queue (collectrr-schedule-queue)
    participant Consumer as Queue Consumer (processScheduledOccurrence)
    participant Meta as Meta WhatsApp Cloud API

    User->>API: POST /api/cases/bulk (up to 200 clients)
    API->>D1: Atomic batch insert (cases, contacts, schedules, pending occurrences)
    API->>D1: Atomic claim (pending -> claimed, claimed_at = now, attempts += 1)
    API->>Q: Chunked dispatch sendBatch() (max 100 messages/batch)
    API-->>User: Immediate 200 OK (outreach queued, non-blocking)
    
    Q->>Consumer: Deliver occurrence message { occurrenceId }
    alt Occurrence already terminal (completed / skipped / unknown)
        Consumer->>Q: Ack message immediately, do not invoke Meta
    else Occurrence claimed & active (lease < 10 min)
        Consumer->>Meta: Invoke existing executeWhatsAppMessagingPipeline
        alt Success
            Consumer->>D1: Settle occurrence = completed, whatsapp_messages = SENT
        alt Provider Timeout / Ambiguous In-Flight
            Consumer->>D1: Settle occurrence = unknown, whatsapp_messages = UNKNOWN (no auto-retry)
        end
    end
    Note over D1,Q: Fallback Recovery: If Queue publication partially fails, un-enqueued claimed rows expire after 10-minute lease and are reclaimed by Cron scanner.
```
*Invariants:*
1. **D1 is the durable execution ledger**: Outbound occurrences are atomically claimed before queue enqueue.
2. **Chunked Queue Publication**: Messages are chunked into slices of $\le 100$ per `sendBatch()` call.
3. **SENDING Ambiguity Protection**: Active in-flight consumers yield without overwriting to `unknown`; orphaned `SENDING` older than 10 minutes are flagged `unknown` and never blindly re-sent to Meta.
4. **Consumer Invariant - Single-Message Worker Isolation (`max_batch_size = 1`)**: Queue consumer delivers 1 occurrence per Worker invocation (`max_batch_size = 1`, `max_batch_timeout = 0`, `max_concurrency = 10`). This isolates outbound Meta API HTTPS network requests and D1 transactions, preventing subrequest limit exhaustion (< 15 per invocation vs 50 cap) and ensuring that 200+ message bursts are scaled horizontally without batch timeout cascades.


### Flow 6.1: Bulk Upload Pre-Check & Action Flow (Send Now vs Schedule for Later)
```text
CSV selected
      │
      ▼
Local parse + canonical phone normalization
      │
      ├── Invalid format ─────────┐
      ├── Repeated in CSV ────────┤
      │                           │
      ▼                           │
POST /api/cases/bulk-precheck     │
      │                           │
      ▼                           │
DB active-workflow lookup         │
      │                           │
      └──────────────┬────────────┘
                     ▼
              Pre-check Result
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
       Ready                 Skipped
          │              ┌──────┼──────┐
          │              ▼      ▼      ▼
          │           Active  Batch  Invalid
          │
          ▼
   Operator Action Choice
      │       │
      │       └───────────────┐
      ▼                       ▼
   Send Now             Schedule for Later
      │                       │
      │                       ▼
      │                 Inline Date & Time Picker
      │                       │
      │                       ▼
      │                 [Confirm Schedule]
      │                       │
      ▼                       ▼
 POST /api/cases/bulk-import (Ready rows only)
      │
      ▼
 D1 Atomic Transaction & Partial Unique Index (Authoritative concurrency guard)
```
*Invariants:*
1. **Pre-check is Advisory / UI Validation**: Server uniqueness index `unq_active_case_user_phone` remains the authoritative concurrency guard.
2. **Exact Ready Definition**: `Ready = valid canonical phone AND first occurrence in batch AND no active workflow at pre-check`. Only `Ready` rows are dispatched to `/api/cases/bulk-import`.
3. **Action Semantics**: `Send Now` dispatches immediately for `Ready` count; `Schedule for Later` reveals inline Date & Time controls with confirmation before dispatch. Both disabled when `Ready == 0`.

---

## 5. Database Schema & Entity Relationships

```mermaid
erDiagram
    users ||--o{ contacts : "owns"
    users ||--o{ credit_transactions : "accrues"
    users ||--o{ message_templates : "customizes"
    
    contacts ||--o{ loan_cases : "has many (mini targets)"
    contacts ||--o{ case_timeline : "has consolidated"
    
    loan_cases ||--o{ required_documents : "requires"
    loan_cases ||--o{ uploaded_documents : "contains"
    loan_cases ||--o{ secure_tokens : "generates"
    loan_cases ||--o{ case_timeline : "logs"

    users {
        string id PK
        string username UK
        string password_hash
        string role "agent | admin"
        integer credit_balance "in paise"
        string wa_phone_number_id UK
    }

    users ||--o{ email_messages : "dispatches"
    schedules ||--o{ scheduled_occurrences : "generates"

    contacts {
        string id PK
        string user_id FK
        string contact_person
        string phone_number "E.164 (91XXXXXXXXXX)"
        string email "Optional email address"
        datetime created_at
        datetime last_updated
    }

    loan_cases {
        string id PK
        string contact_id FK
        string user_id FK
        integer is_demo
        string contact_person
        string phone_number
        string loan_product
        string template_name
        real amount_required
        string status "lead | documents_pending | ready_for_review | submitted | approved | disbursed"
        string whatsapp_delivery_status
        json ai_metadata
    }

    schedules {
        string id PK
        string user_id FK
        string case_id FK
        string contact_id FK
        string phone_number
        string channel "whatsapp | email"
        string template_name
        json template_params
        string schedule_type "one_off"
        string timezone
        string status "active | completed | cancelled"
        datetime next_run_utc
    }

    scheduled_occurrences {
        string id PK
        string schedule_id FK
        string occurrence_key
        datetime scheduled_for_utc
        string channel "whatsapp | email"
        string recipient_phone "Snapshot: 91XXXXXXXXXX"
        string recipient_email "Snapshot: email address"
        string operational_status "pending | claimed | completed | skipped | failed | unknown"
        datetime claimed_at
        integer attempts
        string provider_message_id
        string skip_reason
        string last_error
    }

    email_messages {
        string id PK
        string user_id FK
        string idempotency_key UK
        string recipient_email
        string status "PENDING | SENDING | SENT | FAILED | UNKNOWN"
        string provider_message_id UK
        datetime created_at
    }

    required_documents {
        string id PK
        string case_id FK
        string document_type "pan | gst | bank_statement | etc."
        string label
        string status "pending | received | waived"
    }

    uploaded_documents {
        string id PK
        string case_id FK
        string required_doc_id FK
        string s3_key
        string content_type
        json ocr_payload
        string ocr_status "pending | processed | failed | flagged"
    }

    case_timeline {
        string id PK
        string contact_id FK
        string case_id FK
        string provider_message_id
        string template_name
        string event_type "case_created | whatsapp_sent | email_sent | outreach_scheduled | etc."
        string content
        json metadata
        string created_by
    }

    credit_transactions {
        string id PK
        string user_id FK
        integer amount_paise
        integer balance_after_paise
        string transaction_type "whatsapp_deduction | email_deduction | recharge_topup"
        string reference_id
    }
```

---

## 6. REST API Contract Specification

### Authentication & Users
- `POST /api/auth/login`: `{ username, password }` $\rightarrow$ `{ token, user }`
- `POST /api/auth/register`: `{ username, password, role }` $\rightarrow$ `{ token, user }`
- `GET /api/user/profile`: Returns authenticated user session payload.
- `GET /api/user/credits`: Returns wallet balance, messages remaining, and recent transactions.
- `POST /api/user/recharge`: `{ amountRupees }` $\rightarrow$ Adds credits to wallet ledger.

### Cases & Contacts
- `GET /api/cases`: Returns cases accessible to user (scoped by `user_id` or `is_demo=1`). Supports filtering by status, product, search text. Returns canonical `templateName` (camelCase).
- `POST /api/cases`: `{ contactPerson, phoneNumber, loanProduct, amountRequired, templateName, requiredDocIds, schedule }` $\rightarrow$ Creates case & either dispatches WhatsApp immediately or registers a scheduled outreach (sets `loan_cases.whatsapp_delivery_status = 'scheduled'`).
- `GET /api/cases/:id`: Detailed case view including required documents, uploads, and timeline. Resolves and returns authoritative `template: { name, displayName, renderedBody }` and `templateName`. Frontend components bind against `c.template` as the single source of truth to unify presentation across the info bar, WhatsApp conversation cards, and activity logs.
- `POST /api/cases/bulk-precheck`: Accepts `{ phones: [...] }`, normalizes canonical Indian phones, and returns `{ activeExistingPhones: { [canonicalPhone]: { existingCaseId, contactPerson, status } } }` for active workflows in D1 without writing records or sending messages.
- `POST /api/cases/bulk-import`: Parses uploaded CSV/spreadsheet, deduplicates numbers, and generates cases. Optionally accepts `schedule: { scheduledFor, scheduleType, recurrenceInterval, timezone }` with `sendWhatsApp: true` to schedule outreach in batch (creates schedule and exactly one initial pending occurrence per eligible case without upfront credit deduction).
- `GET /api/contacts/:id/timeline`: Consolidated timeline across all mini-targets for a contact.

### Templates
- `GET /api/templates?context=direct_outreach`: Returns system defaults and custom templates (strictly deduplicated). All system templates in `WHATSAPP_TEMPLATES` declare an explicit `body_text` matching the copy approved on Meta.
- `POST /api/admin/templates`: Creates/updates template. Enforces unique names (409 on conflict).
- `DELETE /api/admin/templates/:id`: Deletes custom templates, or deactivates system default templates (persisted with is_active = 0 in message_templates).

### Schedules
- `GET /api/schedules`: Returns schedules and occurrence execution history for authenticated agent.
- `POST /api/schedules`: `{ phoneNumber, templateName, templateParams, scheduleType, recurrenceInterval, timezone, scheduledFor, caseId, contactId }` $\rightarrow$ Creates schedule and initial pending occurrence (no upfront credit deduction; validation binds JIT before execution).
- `DELETE /api/schedules/:id`: Cancels schedule and marks any pending/claimed occurrences as `skipped` (`skip_reason: 'cancelled'`).
- `POST /api/schedules/occurrences/:id/retry`: Manual retry control. If occurrence status is `unknown`, strictly blocks retry without explicit warning acknowledgement (`forceDuplicateRiskAcknowledgement: true`) to prevent double-messaging.

### Upload & Client Portal
- `GET /api/session/:token`: Validates magic link token and returns case document requirements.
- `POST /api/upload-url/:token`: Generates presigned R2 S3 URL for direct client upload.
- `POST /api/direct-upload/:token`: Fallback multipart upload through worker.
- `POST /api/upload-complete/:token`: Triggers document status change and asynchronous Gemini OCR.

### Webhooks
- `GET /api/webhook/whatsapp`: Meta webhook subscription verification (`hub.challenge`).
- `POST /api/webhook/whatsapp`: Incoming message and message delivery status updates (`sent`, `delivered`, `read`, `failed`).

---

## 7. Offline Testing & Network Isolation

Collectrr features full offline testability. When running tests with:
```bash
npm run test:offline
```
The test runner activates a strict network guard (`v2/tests/helpers/network-guard.js`) that denies all outbound network traffic by default. Services use configurable mock adapters:
- `MOCK_WHATSAPP=true`: Simulates WhatsApp dispatch without contacting Meta.
- `MOCK_GEMINI=true`: Simulates OCR extraction using synthetic fixtures without contacting Google.
