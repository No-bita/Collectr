# Lekho CRM + WhatsApp Automation

Lekho tracks document collection for leads in Google Sheets and automates client communication over WhatsApp. The API powers a dashboard for operations teams and a webhook flow that processes incoming media uploads. Document status, follow-up due state, and collection sequencing are handled consistently through backend services.

## Core concepts

- **Lead**: one sheet row with profile, required docs, and workflow status.
- **Document state**: JSON map (`pending|received|failed`) stored in the sheet.
- **Follow-up due**: computed from pending docs + inactivity window.
- **Webhook ingestion**: WhatsApp media -> Drive link -> sheet state update.
- **OCR validation pipeline**: Aadhaar/PAN rule-based verification with `PASS|FAIL|MANUAL_REVIEW`.
  - Supports direct image/PDF upload endpoint with OCR adapter integration.

## System flow

1. Dashboard creates/edits leads through `/api/leads`.
2. Backend writes normalized state to Google Sheets.
3. WhatsApp webhook receives customer messages/files at `/webhook`.
4. Uploaded media is stored in Drive and linked back to lead state.
5. Follow-up routes send reminders/templates and refresh activity timestamps.
6. OCR validation APIs score Aadhaar/PAN evidence and route ambiguous cases to review.
7. Optional WhatsApp OCR enrichment runs after Drive save and shows extracted fields in the dashboard.

## OCR upload setup (image + PDF)

1. Install Python OCR dependency:
   - `pip install paddleocr`
2. Configure env:
   - `OCR_PIPELINE_COMMAND=python3`
   - `OCR_PIPELINE_ARGS=["scripts/paddle_ocr_extract.py","--file","{file}"]`
   - `PADDLE_OCR_LANG=en` (set `hi` for Hindi-first)
3. Call `POST /api/document-validations/validate-upload` using multipart form:
   - fields: `expectedDocumentType`, `file`

### Try Sarvam OCR pipeline (parallel to Paddle)

Paddle remains the default. To test Sarvam on the same upload endpoint, switch only the OCR script args:

- Install SDK first: `pip install sarvamai`
- `OCR_PIPELINE_COMMAND=python3`
- `OCR_PIPELINE_ARGS=["scripts/sarvam_ocr_extract.py","--file","{file}"]`
- `SARVAM_API_SUBSCRIPTION_KEY=<your key>`
- Optional tuning:
  - `SARVAM_DOC_LANGUAGE=en-IN`
  - `SARVAM_DOC_OUTPUT_FORMAT=md` (allowed: `md`, `html`)
  - `SARVAM_POLL_INTERVAL_SECONDS=2`
  - `SARVAM_POLL_TIMEOUT_SECONDS=120`

Sarvam flow implemented in `scripts/sarvam_ocr_extract.py` follows their async SDK job flow:
create job → upload file → start job → poll/wait for status → download ZIP output.

Current script output is **raw provider output mode** for evaluation (not normalized):
- top-level includes `job_id`, `status`, and `output_files`
- each `output_files` item includes file name, type, size, and decoded content when text/JSON

### WhatsApp upload OCR enrichment

You can configure OCR extraction to run automatically for incoming WhatsApp media after it is saved on Drive. You can use either Gemini API or Sarvam AI. If both are enabled, Gemini will take precedence.

**Which documents are processed?**
By default, the system will only run OCR on `pan` and `aadhaar` documents. You can customize this by setting a comma-separated list of document IDs in your environment:
- `OCR_DOCUMENTS="pan,aadhaar,form16"`

**Option 1: Gemini OCR (Recommended)**
- `GEMINI_OCR_ENABLED=true`
- `GEMINI_API_KEY=<your gemini api key>`

**Option 2: Sarvam OCR**
- `SARVAM_OCR_ENABLED=true`
- `SARVAM_OCR_COMMAND=.venv/bin/python`
- `SARVAM_OCR_ARGS=["scripts/sarvam_ocr_extract.py","--file","{file}"]`

When enabled and the uploaded document type is in `OCR_DOCUMENTS`, the document in `documentsState` gets an `ocr` object (provider, job status/id, extracted `name`/`dob`/`idNumber`/`vid`, and preview text), and the dashboard shows this under the document row.

## Folder structure

- `src/modules/leads`: lead APIs, rules, and sheet repository.
- `src/modules/documents`: document catalog and state rules.
- `src/modules/webhook`: webhook verification and processing flow.
- `src/modules/document-validation`: OCR preprocessing, classification, decisioning, review, and KPI APIs.
- `src/integrations`: WhatsApp + Drive external clients.
- `src/infrastructure`: Google API clients.
- `docs`: architecture, data flow, contracts, and decisions.

## Where to start reading

1. `src/app.js`
2. `src/modules/leads/leads.controller.js`
3. `src/modules/leads/leads.service.js`
4. `src/modules/webhook/webhook.service.js`
5. `src/modules/documents/documents.service.js`
