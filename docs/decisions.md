# Decisions

## Why modularize by feature
The previous server entrypoint mixed route handlers, sheet/drive IO, and workflow logic. Feature modules make ownership explicit and reduce accidental coupling.

## Why keep Google Sheets as repository layer
The spreadsheet is still the source of truth. Wrapping all writes/reads behind `leads.repository` creates a clean seam for future storage migration.

## Why preserve JSON-based `documentsState`
This avoids changing external behavior or sheet schema while still centralizing state normalization in one service.

## Why keep CORS permissive for now
Existing dashboard/API deployment assumptions depend on cross-origin calls. Security tightening should be a separate change with deployment context.

## Why use rule-first OCR validation for MVP
The MVP must minimize false-passes for wrong document type while keeping cost and latency low. Deterministic signals (keywords + ID format patterns + confidence thresholds) are easier to explain and tune than model-only classification.

## Why keep manual-review as a first-class outcome
Real client uploads include blur, crops, and OCR ambiguity. Returning `MANUAL_REVIEW` instead of over-confident auto-pass protects compliance quality and gives operations a controlled override path.

## Why expose policy and metrics endpoints
Validation thresholds and KPI targets need to be auditable. Dedicated policy/metrics APIs allow dashboard visibility, safer threshold tuning, and objective go-live checks.
