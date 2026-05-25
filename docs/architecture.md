# Architecture

The runtime system is a modular Express backend that serves two concerns:
- CRM APIs for lead/document workflow (`/api/*`)
- WhatsApp webhook automation (`/webhook`)

## Module boundaries

- `src/modules/leads`
  - `leads.controller.js`: HTTP request/response only.
  - `leads.service.js`: business rules for lead lifecycle and follow-up behavior.
  - `leads.repository.js`: Google Sheets read/write operations.
- `src/modules/documents`
  - `documents.service.js`: document checklist rules, ordering, state normalization.
  - `documents.types.js`: catalog constants and identifiers.
- `src/modules/webhook`
  - `webhook.controller.js`: webhook route handlers.
  - `webhook.service.js`: media processing + lead state updates.
- `src/modules/document-validation`
  - `document-validation.controller.js`: OCR validation APIs (`/api/document-validations/*`).
  - `document-validation.upload.js`: multipart upload handling for image/PDF validation.
  - `document-validation.ocr-adapter.js`: OCR command runner bridge (PaddleOCR by default, Sarvam via env switch).
  - `document-validation.policy.js`: policy version, thresholds, reason codes, and required signals.
  - `document-validation.preprocess.js`: normalized input/page preprocessing summary.
  - `document-validation.ocr.js`: OCR extraction aggregation (page text + confidence).
  - `document-validation.signals.js`: deterministic Aadhaar/PAN signal scoring + field extraction.
  - `document-validation.service.js`: decision engine (`PASS/FAIL/MANUAL_REVIEW`) + explainability payload.
  - `document-validation.review.js`: manual-review queue + override audit trail.
  - `document-validation.metrics.js`: KPI counters and runtime aggregates.

## Infrastructure and integrations

- `src/infrastructure/google-clients.js`: authenticated Google Sheets/Drive clients.
- `src/integrations/whatsapp.service.js`: outbound WhatsApp text/template APIs.
- `src/integrations/drive.service.js`: media fetch from WhatsApp + Drive upload.
- `src/config/env.js`: validated environment configuration.

This separation keeps request handling thin and forces domain logic into reusable services.
