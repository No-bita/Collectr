# Data Flow

## Dashboard load
1. Frontend calls `GET /api/leads` and `GET /api/document-catalog`.
2. `leads.controller` delegates to `leads.service`.
3. `leads.service` reads rows via `leads.repository` and normalizes state via `documents.service`.
4. Aggregated response returns summary + leads list.

## Lead creation/update
1. Frontend sends `POST /api/leads` or `PATCH /api/leads/:rowIndex`.
2. Service validates input, normalizes phone/doc IDs, merges document state.
3. Repository writes updated row to Google Sheets.
4. Optional WhatsApp template is sent for new lead onboarding.

## Webhook media ingestion
1. WhatsApp webhook sends image/document.
2. `webhook.service` resolves target document slot.
3. Media is downloaded from Graph API and uploaded to Drive.
4. Sheet row state is updated (`documentsState`, `lastStep`, `status`, `lastUpdated`).
5. Customer receives next prompt or completion confirmation.

## OCR document validation (Aadhaar/PAN)
1. Client/internal workflow calls `POST /api/document-validations/validate` with expected document type + OCR page payload.
2. Preprocessing layer normalizes file/page metadata and computes quality/confidence summary.
3. OCR aggregation layer builds full-text + page-level confidence rollup.
4. Signal classifier scores `aadhaar|pan|other` and extracts ID fields.
5. Decision engine applies policy thresholds and required signals:
   - `PASS` for strong deterministic match
   - `FAIL` for explicit mismatch
   - `MANUAL_REVIEW` for low confidence or conflicting evidence
6. Manual-review items are queued with full explainability context.
7. Metrics pipeline records decision distributions and latency/quality aggregates for KPI tracking.

## OCR validation via direct upload (image/PDF)
1. Client uploads `multipart/form-data` to `POST /api/document-validations/validate-upload` with `expectedDocumentType` + `file`.
2. Upload middleware validates MIME/size and stores file in temporary storage.
3. OCR adapter executes configured command (`OCR_PIPELINE_COMMAND` + `OCR_PIPELINE_ARGS`), defaulting to PaddleOCR script.
   - Alternate parallel pipeline available: Sarvam Document Intelligence script (`scripts/sarvam_ocr_extract.py`).
4. OCR JSON is normalized into page-wise payload and passed to the same decision engine.
5. Temporary upload file is deleted after processing (success or failure).
