import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

function parseJsonSafe(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function parseJsonFromMixedOutput(raw) {
  const direct = parseJsonSafe(raw);
  if (direct) return direct;
  const lines = String(raw || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const candidate = parseJsonSafe(lines[i]);
    if (candidate) return candidate;
  }
  const content = String(raw || "");
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start >= 0 && end > start) return parseJsonSafe(content.slice(start, end + 1));
  return null;
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Sarvam OCR command failed (${code}): ${stderr || stdout}`));
        return;
      }
      resolve(stdout);
    });
  });
}

function normalizeForRegex(text) {
  return String(text || "")
    .replace(/!\[Image\]\(data:image\/[a-zA-Z]+;base64,[^)]+\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTextFromRawOutput(rawPayload) {
  const files = Array.isArray(rawPayload?.output_files) ? rawPayload.output_files : [];
  const textParts = [];
  for (const file of files) {
    if (file?.content_type === "text" && typeof file.content === "string") {
      textParts.push(file.content);
    } else if (file?.content_type === "json" && file?.content) {
      const blocks = Array.isArray(file.content?.blocks) ? file.content.blocks : [];
      for (const block of blocks) {
        if (block?.text) textParts.push(String(block.text));
      }
    }
  }
  return normalizeForRegex(textParts.join("\n"));
}

function extractFields(text) {
  const content = normalizeForRegex(text);
  const dobMatch = content.match(/\b\d{2}\/\d{2}\/\d{4}\b/);
  const vidMatch = content.match(/\bVID\s*:?\s*([0-9 ]{12,24})\b/i);
  const idMatch = content.match(/\b\d{4}\s?\d{4}\s?\d{4}\b/);
  const lines = content
    .split(/\s{2,}|\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  let probableName = "";
  for (const line of lines) {
    if (/government of india|date of birth|female|male|aadhaar|vid/i.test(line)) continue;
    if (/^[A-Za-z][A-Za-z .'-]{2,}$/.test(line)) {
      probableName = line;
      break;
    }
  }
  return {
    name: probableName || "",
    dob: dobMatch ? dobMatch[0] : "",
    idNumber: idMatch ? idMatch[0].replace(/\s+/g, " ").trim() : "",
    vid: vidMatch ? vidMatch[1].replace(/\s+/g, " ").trim() : "",
  };
}

function inferExtensionFromMime(mimeType) {
  const mime = String(mimeType || "").toLowerCase();
  if (mime.includes("jpeg") || mime.includes("jpg")) return ".jpg";
  if (mime.includes("png")) return ".png";
  if (mime.includes("webp")) return ".webp";
  if (mime.includes("gif")) return ".gif";
  if (mime.includes("pdf")) return ".pdf";
  return ".bin";
}

export async function runSarvamOcrOnBuffer({ buffer, mimeType }) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    return null;
  }
  const command = process.env.SARVAM_OCR_COMMAND?.trim() || ".venv/bin/python";
  const argsRaw = process.env.SARVAM_OCR_ARGS?.trim();
  const argsTemplate = argsRaw
    ? parseJsonSafe(argsRaw)
    : ["scripts/sarvam_ocr_extract.py", "--file", "{file}"];
  if (!Array.isArray(argsTemplate)) {
    throw new Error("SARVAM_OCR_ARGS must be a JSON array.");
  }

  const ext = inferExtensionFromMime(mimeType);
  const tempPath = path.join(os.tmpdir(), `sarvam_ocr_${Date.now()}_${Math.random().toString(16).slice(2)}${ext}`);
  await fs.writeFile(tempPath, buffer);
  try {
    const args = argsTemplate.map((arg) => (arg === "{file}" ? tempPath : arg));
    const stdout = await runCommand(command, args);
    const parsed = parseJsonFromMixedOutput(stdout);
    if (!parsed || typeof parsed !== "object") return null;
    const combinedText = extractTextFromRawOutput(parsed);
    return {
      provider: "sarvam",
      extractedAt: new Date().toISOString(),
      jobId: String(parsed.job_id || ""),
      jobState: String(parsed.status?.job_state || ""),
      fields: extractFields(combinedText),
      previewText: combinedText.slice(0, 500),
    };
  } finally {
    try {
      await fs.unlink(tempPath);
    } catch {
      // no-op
    }
  }
}
