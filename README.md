# Collectrr V2 — Automated Client Intake & Document Collection Platform

Collectrr is a serverless, edge-native CRM and automated document collection engine for MSME financial services. Built on **Cloudflare Workers**, **Hono**, **Cloudflare D1** (SQLite), and **Cloudflare R2** (object storage), it automates client document intake via WhatsApp, presigned R2 uploads, and AI-driven OCR extraction.

---

## Core Features

- **Public Marketing Landing Page**: High-converting landing page integrated directly at root (`/`) with client sign-in (`/login.html`) and registration (`/register.html`) flows.
- **Operations Dashboard** (`/dashboard.html` or `/app`): Multi-tenant workspace for agents and administrators to manage loan cases, filter by product/status/amount, track document progress, and trigger follow-ups.
- **3-Screen Case Creation Wizard**:
  - *Screen 1 (Intake)*: Borrower details, 10-digit mobile number validation, loan product selection, and required loan amount.
  - *Screen 2 (Document Matrix)*: Dynamic document checklist recommended based on loan product rules.
  - *Screen 3 (WhatsApp Dispatch)*: Meta Cloud API template dispatch and unique token link generation.
- **Client Document Portal** (`/upload.html?t=<token>`): Mobile-first upload portal for end-clients accessing their secure, time-limited token link with presigned R2 upload URLs and direct upload support.
- **AI-Powered OCR Verification**: Asynchronous Gemini 2.5 Flash OCR extraction parsing key fields (PAN, Aadhaar, GST Returns, Bank Statements), detecting anomalies, logging failure diagnostics, and auto-advancing case status.
- **Admin Observability & Matrix Rules**: Configurable loan product document requirement matrix and system failure logs.

---

## System Architecture

```
[ End-Client ] ───────> Upload Portal (/upload.html?t=token)
                              │
                              ▼
                        [ Cloudflare R2 ] (Document Storage)
                              │
                              ▼
                       [ Gemini 2.5 OCR ] (Async Background Worker)
                              │
                              ▼
 [ Agent/Admin ] ─────> [ Hono Edge API ] <─────> [ Cloudflare D1 ]
                           (Workers)                (SQLite Database)
                              │
                              ▼
                  [ WhatsApp Meta Cloud API ]
```

---

## Folder Structure

```
v2/
├── migrations/         # D1 Database SQL migrations (0001, 0002, 0003)
├── public/             # Static Assets served by Cloudflare Workers [assets]
│   ├── index.html      # Landing Page (Root /)
│   ├── dashboard.html  # Operations Dashboard (/dashboard.html or /app)
│   ├── login.html      # Agent & Admin Sign In
│   ├── register.html   # Account Creation
│   ├── case.html       # Case Detail Workspace
│   ├── upload.html     # Public Client Upload Portal
│   ├── js/             # Modular JS (app.js, case-detail.js, ui-components.js, icons.js)
│   ├── css/            # Dashboard Stylesheet (dashboard.css)
│   └── assets/         # Tailwind CSS & bundle assets
├── src/
│   ├── index.js        # Hono router entrypoint, CORS, JWT auth & asset fallbacks
│   ├── api/            # Route handlers (cases, auth, upload, ocr, webhook, admin, session)
│   └── db/             # D1 client adapter, baseline schema, and seed SQL
└── tests/              # TAP Integration Test Suite (node --test)
```

---

## Local Development & Testing

### 1. Install Dependencies & Start Dev Server

```bash
cd v2
npm install
npx wrangler dev
```

The local dev server runs on **`http://localhost:8788`**:
- **Landing Page**: `http://localhost:8788/`
- **Dashboard**: `http://localhost:8788/dashboard.html` (or `http://localhost:8788/app`)
- **Sign In**: `http://localhost:8788/login.html`
- **Register**: `http://localhost:8788/register.html`

*Note: In development (`localhost`), API authentication automatically grants dev bypass privileges as `DevAgent (admin)`.*

### 2. Run Integration Test Suite

```bash
npm test
```

Executes all 13 TAP unit and integration tests covering WhatsApp template failover logic, 3-Screen Wizard state machines, mobile validation, and admin matrix rules.

---

## Environment Variables Configuration

Configure bindings in `v2/wrangler.toml` or secret values in `v2/.dev.vars`:

```toml
[vars]
ENVIRONMENT = "production"
FRONTEND_URL = "https://collectrr-v2.collectr.workers.dev"
WHATSAPP_PROD_PHONE_ID = "1073272059211357"
WHATSAPP_VERIFY_TOKEN = "CollectrWhatsappTokenAuth2026"
WHATSAPP_NEW_LEAD_TEMPLATE = "new_convo_1"
WHATSAPP_TEMPLATE_LANG = "en"
```

---

## Deploying to Production

When local development and testing are complete:

```bash
cd v2
npx wrangler deploy
```
