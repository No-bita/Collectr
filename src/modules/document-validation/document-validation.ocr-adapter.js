import { spawn } from "node:child_process";

function parseJsonSafe(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function extractJsonObjectFromMixedOutput(raw) {
  const direct = parseJsonSafe(raw);
  if (direct) return direct;

  const trimmed = String(raw || "").trim();
  if (!trimmed) return null;

  const lines = trimmed.split(/\r?\n/).map((line) => line.trim());
  for (let i = lines.length - 1; i >= 0; i--) {
    const parsed = parseJsonSafe(lines[i]);
    if (parsed) return parsed;
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const sliced = trimmed.slice(firstBrace, lastBrace + 1);
    return parseJsonSafe(sliced);
  }
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
        reject(new Error(`OCR command failed (code ${code}): ${stderr || stdout}`));
        return;
      }
      resolve(stdout);
    });
  });
}

export async function extractOcrFromFile(filePath) {
  const command = process.env.OCR_PIPELINE_COMMAND?.trim() || "python3";
  const argsRaw = process.env.OCR_PIPELINE_ARGS?.trim();
  const args = argsRaw
    ? parseJsonSafe(argsRaw)
    : ["scripts/paddle_ocr_extract.py", "--file", filePath];

  if (!Array.isArray(args)) {
    throw new Error("OCR_PIPELINE_ARGS must be a JSON array.");
  }

  const mergedArgs = args.map((arg) => (arg === "{file}" ? filePath : arg));
  if (!mergedArgs.includes(filePath)) {
    const fileFlagIndex = mergedArgs.findIndex((arg) => arg === "--file");
    if (fileFlagIndex >= 0 && mergedArgs[fileFlagIndex + 1] == null) {
      mergedArgs[fileFlagIndex + 1] = filePath;
    } else if (fileFlagIndex === -1) {
      mergedArgs.push("--file", filePath);
    }
  }

  const stdout = await runCommand(command, mergedArgs);
  const parsed = extractJsonObjectFromMixedOutput(stdout);
  if (!parsed || !Array.isArray(parsed.pages)) {
    throw new Error("OCR output JSON is invalid. Expected shape: { pages: [...] }");
  }
  return parsed;
}
