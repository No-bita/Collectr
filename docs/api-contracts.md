# API Contracts

## GET `/api/document-catalog`
Returns available document definitions used by dashboard forms.

## GET `/api/leads`
Returns:
- `summary`: totals + follow-up metrics
- `leads`: normalized lead rows (documents state, pending summary, status fields)

## POST `/api/leads`
Required:
- `name` (string)
- `phone` (string/number)
- doc selection via `requiredDocIds` or `requiredDocCounts.bank_statement`

Response:
- `201 { ok: true, whatsappNewLeadSent: boolean }`

## PATCH `/api/leads/:rowIndex`
Updates name, phone, firm name, and required docs while preserving existing per-document state where possible.

## POST `/api/leads/:rowIndex/follow-up/send-template`
Sends configured follow-up WhatsApp template, updates activity timestamp, returns updated due state.

## POST `/api/leads/:rowIndex/follow-up`
Logs a follow-up action and optionally sends WhatsApp session/template reminder.

## GET `/webhook`
Meta webhook verification endpoint.

## POST `/webhook`
Handles WhatsApp incoming messages (documents/images/text) and updates lead progress.

## GET `/api/document-validations/policy`
Returns active OCR validation policy for Aadhaar/PAN:
- threshold config
- required signal sets
- processing limits
- decision + reason enums

## POST `/api/document-validations/validate`
Validates a document payload (PDF/image OCR output) and returns deterministic decision.

Request:
```json
{
  "requestId": "lead_123_pan_1",
  "expectedDocumentType": "pan",
  "file": {
    "source": "webhook",
    "fileName": "client_pan.pdf",
    "mimeType": "application/pdf",
    "pageCount": 1,
    "sizeBytes": 214312
  },
  "pages": [
    {
      "pageNumber": 1,
      "qualityScore": 0.86,
      "ocr": {
        "confidence": 0.91,
        "text": "INCOME TAX DEPARTMENT ... ABCDE1234F ..."
      },
      "preprocessing": {
        "deskewApplied": true,
        "denoiseApplied": true,
        "orientationCorrected": true,
        "contrastEnhanced": true
      }
    }
  ]
}
```

Response:
```json
{
  "requestId": "lead_123_pan_1",
  "policyVersion": "2026-04-ocr-v1",
  "decision": "PASS",
  "reasonCodes": ["STRONG_MATCH"],
  "evidence": {
    "expectedType": "pan",
    "predictedType": "pan",
    "classifierConfidence": 0.93,
    "matchedSignals": ["pan_keyword", "pan_number"],
    "candidateScores": [],
    "fields": {
      "panNumber": "ABCDE1234F",
      "aadhaarNumber": "",
      "name": "RAHUL SHARMA",
      "address": "123 ABC STREET, DELHI, 110001",
      "fieldConfidence": {
        "panNumber": 1,
        "aadhaarNumber": 0,
        "name": 0.93,
        "address": 0.81
      }
    },
    "ocr": {
      "hasText": true,
      "avgConfidence": 0.91,
      "pageCount": 1
    },
    "preprocessing": {
      "pageCount": 1,
      "normalizationApplied": true,
      "avgQualityScore": 0.86,
      "avgOcrConfidence": 0.91,
      "processingMode": "sync"
    }
  },
  "file": {
    "source": "webhook",
    "fileName": "client_pan.pdf",
    "mimeType": "application/pdf",
    "pageCount": 1,
    "sizeBytes": 214312
  },
  "createdAt": "2026-04-26T00:00:00.000Z",
  "latencyMs": 128
}
```

`MANUAL_REVIEW` responses include:
- `review.reviewId`
- `review.status`
- `review.createdAt`

## POST `/api/document-validations/validate-upload`
Runs end-to-end upload validation for image/PDF files:
1) accepts multipart upload
2) executes OCR adapter command (PaddleOCR by default)
3) applies Aadhaar/PAN decision policy

Request (`multipart/form-data`):
- `expectedDocumentType`: `aadhaar` or `pan`
- `file`: PDF/JPG/PNG/WEBP
- optional: `requestId`, `source`

Response:
- Same shape as `POST /api/document-validations/validate`
- Includes `MANUAL_REVIEW` payload when confidence is borderline


## GET `/api/document-validations/reviews`
Returns queued manual-review cases.

## POST `/api/document-validations/reviews/:reviewId/decision`
Final reviewer override action.

Request:
```json
{
  "status": "PASS",
  "actor": "ops_user_12",
  "note": "Verified PAN manually from original upload."
}
```

## GET `/api/document-validations/review-audit`
Returns immutable review enqueue/resolve events.

## GET `/api/document-validations/metrics`
Returns live KPI snapshot:
- decision counts/rates
- average OCR confidence
- average latency
- go-live target gates
