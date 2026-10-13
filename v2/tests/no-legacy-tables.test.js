import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const banned = ["loan_cases", "secure_tokens", "required_documents", "uploaded_documents"];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]
  );
}

test("v2/src does not reference retired legacy tables", () => {
  const hits = [];
  for (const file of walk(srcDir)) {
    const text = fs.readFileSync(file, "utf8");
    for (const name of banned) if (text.includes(name)) hits.push(`${path.relative(srcDir, file)}: ${name}`);
  }
  assert.deepEqual(hits, []);
});
