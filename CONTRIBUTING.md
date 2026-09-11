# Contributing to Collectrr

Thank you for your interest in contributing to Collectrr! We welcome contributions from the community.

## Code of Conduct

Please be respectful, constructive, and collaborative in all discussions and pull requests.

## Prerequisites

- **Node.js**: 18.0.0 or higher
- **npm**: 9.0.0 or higher
- **Cloudflare Wrangler CLI**: `npm install -g wrangler` (or via `npx wrangler`)
- **SQLite 3**: (built into macOS and Linux, required for local D1 tests and schema parity)

## Getting Started

1. **Fork and Clone**:
   ```bash
   git clone https://github.com/your-username/collectrr.git
   cd collectrr
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   npm --prefix v2 install
   ```

3. **Configure Local Environment**:
   Copy the example environment template into `v2/.dev.vars`:
   ```bash
   cp v2/.dev.vars.example v2/.dev.vars
   ```
   > [!IMPORTANT]
   > Never commit `.dev.vars`, private keys, or API tokens. `.dev.vars` is strictly gitignored.

4. **Initialize Local Database**:
   ```bash
   npm run db:init:local
   ```

5. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:8787` in your browser.

## Testing & Invariants

All contributions must pass automated tests before being merged.

### Running Tests

```bash
# Run all test suites
npm test

# Run tests in strict offline mode (enforces network isolation)
npm run test:offline

# Verify SQLite D1 schema parity between schema.sql and migrations
node --test v2/tests/schema-parity.test.js
```

### Core Testing Invariants

1. **Strict Offline Test Isolation**:
   Unit and integration tests must run without making external outbound network requests. When `NO_EXTERNAL_NETWORK=true` is set, any unmocked `fetch` will immediately abort.
2. **Deterministic Mock Adapters**:
   - For WhatsApp API interactions, set `MOCK_WHATSAPP=true` (supports `MOCK_WHATSAPP_STATUS=sent|delivered|failed`).
   - For Document OCR extraction, set `MOCK_GEMINI=true` (supports `MOCK_GEMINI_MODE=success|anomaly|unsupported|malformed|error`).
3. **No Regressions**:
   New features or refactors must maintain or expand the existing test suite coverage.

## UI & UX Guidelines

Please follow the Collectrr UX rules defined in `.agents/AGENTS.md`:
- **No Unnecessary Microcopy**: Avoid adding explanatory subtext, helper labels, or decorative microcopy below headings and buttons unless essential for accessibility. Keep UI elements high-leverage, clean, and direct.

## Pull Request Workflow

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Commit your changes with clear, semantic commit messages:
   ```bash
   git commit -m "feat(templates): add dynamic component preview validation"
   ```
3. Run test suites and secret verification:
   ```bash
   npm run test:offline
   node scripts/scan-secrets.js
   ```
4. Push your branch and open a Pull Request against `main`.
