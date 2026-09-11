# Collectrr

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-81%20passing-brightgreen.svg)](v2/tests/)
[![Edge Native](https://img.shields.io/badge/Platform-Cloudflare%20Workers-orange.svg)](https://workers.cloudflare.com/)
[![Runtime](https://img.shields.io/badge/Runtime-Node%2018%2B%20%7C%20Workers-success.svg)](package.json)

Collectrr is an open-source, edge-native client intake and automated document collection platform designed for financial services, loan agents, and chartered accountants. Built on **Cloudflare Workers**, **Hono**, **Cloudflare D1** (serverless SQLite), and **Cloudflare R2** (object storage), it streamlines client onboarding via WhatsApp messaging, secure tokenized document upload portals, and AI-powered document extraction.

For an exhaustive technical deep-dive into the architecture, entity relationships, sequencing, and API contracts, see [**PROJECT_OVERVIEW.md**](PROJECT_OVERVIEW.md).

---

## Key Features

- **Edge-Native Performance**: Sub-50ms API responses powered by Cloudflare Workers and Hono across global edge points of presence.
- **WhatsApp Cloud API Integration**: Automated conversational dispatch, template failover, and interactive document intake workflows.
- **Secure Client Upload Portals**: Tokenized, time-limited, mobile-friendly upload links with presigned Cloudflare R2 direct uploads.
- **AI-Powered OCR Verification**: Asynchronous Gemini 2.5 Flash document extraction for PAN, Aadhaar, GST returns, and bank statements with anomaly detection.
- **Configurable Document Matrices**: Dynamic document requirements tailored by financial product and persona.
- **Multi-Persona UI Architecture**: Seamless workspace adapting dynamically for Chartered Accountants and Financial Loan Agents.
- **Comprehensive Offline Mock Adapters**: 100% offline-testable with deterministic WhatsApp and Gemini mock adapters and zero-external-network isolation guards.

---

## Architecture Overview

```
[ End-Client ] ─────────────> Upload Portal (/upload.html?t=token)
                                    │
                                    ▼
                             [ Cloudflare R2 ] (Document Storage)
                                    │
                                    ▼
                           [ Gemini 2.5 Flash ] (OCR Extraction)
                                    │
                                    ▼
[ Agent / Admin ] ──────────> [ Hono Edge API ] <──────────> [ Cloudflare D1 ]
                               (Workers)                       (SQLite Database)
                                    │
                                    ▼
                         [ WhatsApp Cloud API ]
```

---

## Quickstart

### 1. Prerequisites

- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher
- **Cloudflare Wrangler**: `npm install -g wrangler` (or use `npx wrangler`)
- **SQLite 3**: (pre-installed on macOS/Linux)

### 2. Clone and Install

```bash
git clone https://github.com/your-username/collectrr.git
cd collectrr
npm install
npm --prefix v2 install
```

### 3. Configure Local Environment

Copy the example environment file:
```bash
cp v2/.dev.vars.example v2/.dev.vars
```

> [!NOTE]
> For offline local development, you do not need real WhatsApp or Gemini credentials. The built-in mock adapters (`MOCK_WHATSAPP=true` and `MOCK_GEMINI=true`) enable complete end-to-end local testing.

### 4. Initialize Local D1 Database

```bash
npm run db:init:local
```

### 5. Start Development Server

```bash
npm run dev
```

Open `http://localhost:8787` (or `http://localhost:8788`) to access:
- **Landing Page**: `/`
- **Dashboard**: `/dashboard.html` or `/app`
- **Agent Login**: `/login.html`
- **Registration**: `/register.html`

---

## Testing & Verification

Collectrr includes an automated TAP test suite enforcing deep schema parity, WhatsApp state machines, and network isolation:

```bash
# Run all 81 tests across 12 suites
npm test

# Run tests in strict offline mode (outbound network traffic blocked)
npm run test:offline

# Verify SQLite D1 schema parity between schema.sql and migrations
node --test v2/tests/schema-parity.test.js
```

---

## Repository Structure

```text
collectrr/
├── .github/              # GitHub Actions CI workflow & issue templates
├── scripts/              # Secret scanning & verification tools
├── v2/                   # Active Edge Application
│   ├── migrations/       # D1 SQLite schema migrations (0001 → 0007)
│   ├── public/           # Static frontend SPA assets & vanilla JS modules
│   │   ├── js/core/      # Core API, DOM, State, and Event buses
│   │   ├── js/modules/   # Domain modules (templates, wallet, auth, admin)
│   │   └── dashboard.html# Operations dashboard
│   ├── src/
│   │   ├── api/          # Hono route endpoints (cases, ocr, templates, etc.)
│   │   ├── db/           # D1 client, base schema, and seed queries
│   │   ├── middleware/   # Authentication and CORS middleware
│   │   ├── whatsapp/     # Meta Cloud API client, webhooks, and templates
│   │   └── index.js      # Worker entrypoint
│   ├── tests/            # Automated test suites and offline mock fixtures
│   └── wrangler.toml     # Cloudflare Workers configuration
├── BASELINE.md           # Test baseline inventory
├── CONTRIBUTING.md       # Contributor guidelines and testing rules
├── LICENSE               # MIT License
├── PROJECT_OVERVIEW.md   # Complete technical architecture & contract documentation
├── README.md             # This document
└── SECURITY.md           # Vulnerability disclosure & credential rotation policy
```

---

## Deployment

Deploy directly to your Cloudflare account with Wrangler:

```bash
cd v2
npx wrangler deploy
```

For production secret setup (e.g. `WHATSAPP_ACCESS_TOKEN`, `GEMINI_API_KEY`):
```bash
npx wrangler secret put WHATSAPP_ACCESS_TOKEN
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put WHATSAPP_WEBHOOK_VERIFY_TOKEN
```

---

## Contributing

Contributions are warmly welcomed! Please read our [**Contributing Guide**](CONTRIBUTING.md) and review our [**UI/UX Guidelines**](.agents/AGENTS.md) before opening a pull request.

---

## Security

Please report vulnerabilities confidentially according to our [**Security Policy**](SECURITY.md). Never submit credentials or secrets to public issues or pull requests.

---

## License

Collectrr is open-source software licensed under the [**MIT License**](LICENSE).
