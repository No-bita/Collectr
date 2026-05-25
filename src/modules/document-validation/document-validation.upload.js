import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import multer from "multer";
import { extractOcrFromFile } from "./document-validation.ocr-adapter.js";
import { validateDocumentPayload } from "./document-validation.service.js";

const SUPPORTED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const MAX_UPLOAD_BYTES = parseInt(process.env.DOC_VALIDATION_MAX_UPLOAD_BYTES || `${15 * 1024 * 1024}`, 10);
const MIME_EXTENSION_MAP = Object.freeze({
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
});

const uploadDir = path.join(process.cwd(), ".tmp", "doc-validation");
fsSync.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

export const documentValidationUploadMiddleware = upload.single("file");

function parsePageCountFromOcr(ocrResult) {
  if (!Array.isArray(ocrResult.pages)) return 1;
  return Math.max(1, ocrResult.pages.length);
}

export async function validateUploadedDocument(file, fields) {
  if (!file) {
    return { status: 400, error: "File is required. Send multipart/form-data with field name 'file'." };
  }
  if (!SUPPORTED_MIME_TYPES.has(file.mimetype)) {
    return { status: 400, error: "Unsupported file type. Use PDF/JPG/PNG/WEBP." };
  }

  const expectedDocumentType = String(fields?.expectedDocumentType || "")
    .trim()
    .toLowerCase();
  if (!expectedDocumentType) {
    return { status: 400, error: "expectedDocumentType is required (aadhaar|pan)." };
  }

  const ext = MIME_EXTENSION_MAP[file.mimetype] || "";
  const pathWithExt = ext ? `${file.path}${ext}` : file.path;

  try {
    if (pathWithExt !== file.path) {
      await fs.rename(file.path, pathWithExt);
    }
    const ocrResult = await extractOcrFromFile(pathWithExt);
    const payload = {
      requestId: String(fields?.requestId || "").trim() || `${Date.now()}_${file.originalname}`,
      expectedDocumentType,
      file: {
        source: String(fields?.source || "upload").trim().toLowerCase(),
        fileName: file.originalname,
        mimeType: file.mimetype,
        pageCount: parsePageCountFromOcr(ocrResult),
        sizeBytes: file.size,
      },
      pages: ocrResult.pages.map((page, index) => ({
        pageNumber: parseInt(String(page.pageNumber || index + 1), 10),
        qualityScore: Number.isFinite(page.qualityScore) ? page.qualityScore : 0.7,
        ocr: {
          confidence: Number.isFinite(page.confidence) ? page.confidence : 0.7,
          text: String(page.text || ""),
        },
        lines: Array.isArray(page.lines)
          ? page.lines.map((line) => ({
              text: String(line?.text || ""),
              confidence: Number.isFinite(line?.confidence) ? line.confidence : 0,
              bbox: Array.isArray(line?.bbox) ? line.bbox : [],
            }))
          : [],
        preprocessing: {
          deskewApplied: Boolean(page.preprocessing?.deskewApplied ?? true),
          denoiseApplied: Boolean(page.preprocessing?.denoiseApplied ?? true),
          orientationCorrected: Boolean(page.preprocessing?.orientationCorrected ?? true),
          contrastEnhanced: Boolean(page.preprocessing?.contrastEnhanced ?? true),
        },
        lowQuality: Boolean(page.lowQuality),
        qualityReason: String(page.qualityReason || ""),
      })),
    };

    return { status: 200, payload: validateDocumentPayload(payload) };
  } catch (err) {
    console.error("document-validations.validate-upload:", err);
    return {
      status: 500,
      error:
        "OCR extraction failed. Check OCR_PIPELINE_COMMAND/OCR_PIPELINE_ARGS and ensure PaddleOCR is installed.",
    };
  } finally {
    try {
      await fs.unlink(pathWithExt);
    } catch {
      // best-effort cleanup for temp uploads
    }
  }
}
