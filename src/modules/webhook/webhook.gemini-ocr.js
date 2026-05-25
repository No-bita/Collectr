import { GoogleGenAI, Type } from "@google/genai";

let genaiClient = null;

function getClient() {
  if (!genaiClient) {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set in environment.");
    }
    genaiClient = new GoogleGenAI({ apiKey });
  }
  return genaiClient;
}

export async function runGeminiOcrOnBuffer({ buffer, mimeType, targetId }) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    return null;
  }

  const client = getClient();

  const isBankStatement = String(targetId).startsWith("bank_statement");
  const promptText = isBankStatement
    ? "You are an expert document parser. This document is a bank statement. Extract the requested fields, specifically looking for the first and last transaction dates present in the statement. Format dates as DD/MM/YYYY if possible. If a field is not found, return an empty string."
    : "You are an expert document parser. This document is either an Indian Aadhaar card or a PAN card. Extract the requested fields from this document. Ensure that 'dob' is formatted as DD/MM/YYYY if possible. If a field is not found, return an empty string.";

  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              data: buffer.toString("base64"),
              mimeType: mimeType || "image/jpeg",
            },
          },
          {
            text: promptText,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "The person's full name" },
          dob: { type: Type.STRING, description: "Date of birth" },
          idNumber: { type: Type.STRING, description: "The primary document ID number (e.g. Aadhaar number, PAN number)" },
          vid: { type: Type.STRING, description: "The Virtual ID (VID) if present" },
          firstTransactionDate: { type: Type.STRING, description: "The date of the first/oldest transaction in the bank statement" },
          lastTransactionDate: { type: Type.STRING, description: "The date of the last/newest transaction in the bank statement" },
        },
      },
    },
  });

  const rawText = response.text;
  let fields = { name: "", dob: "", idNumber: "", vid: "", firstTransactionDate: "", lastTransactionDate: "" };
  try {
    const parsed = JSON.parse(rawText);
    fields = {
      name: parsed.name || "",
      dob: parsed.dob || "",
      idNumber: parsed.idNumber || "",
      vid: parsed.vid || "",
      firstTransactionDate: parsed.firstTransactionDate || "",
      lastTransactionDate: parsed.lastTransactionDate || "",
    };
  } catch (err) {
    console.error("Failed to parse Gemini JSON response:", err);
  }

  return {
    provider: "gemini",
    extractedAt: new Date().toISOString(),
    jobId: "gemini-sync",
    jobState: "Completed",
    fields,
    previewText: JSON.stringify(fields),
  };
}
