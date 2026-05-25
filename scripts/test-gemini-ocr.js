import fs from "node:fs/promises";
import { runGeminiOcrOnBuffer } from "../src/modules/webhook/webhook.gemini-ocr.js";

// Ensure environment variables are loaded
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: node scripts/test-gemini-ocr.js <path-to-image-or-pdf>");
    process.exit(1);
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error("Error: GEMINI_API_KEY is not set in the .env file.");
    process.exit(1);
  }

  try {
    console.log(`Reading file: ${filePath}`);
    const buffer = await fs.readFile(filePath);
    
    // Simple mime type inference based on extension
    let mimeType = "image/jpeg";
    if (filePath.toLowerCase().endsWith(".pdf")) mimeType = "application/pdf";
    if (filePath.toLowerCase().endsWith(".png")) mimeType = "image/png";

    console.log(`Calling Gemini OCR with mime type: ${mimeType}...`);
    const result = await runGeminiOcrOnBuffer({ buffer, mimeType });
    
    console.log("\n--- OCR Result ---");
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error("\nError during OCR extraction:", error);
  }
}

main();
