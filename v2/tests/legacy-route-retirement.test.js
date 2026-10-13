import "./helpers/network-guard.js";
import test from "node:test";
import assert from "node:assert/strict";
import { app } from "../src/index.js";

// Issue #33: the retired direct-upload route must be gone from the production app.
test("POST /api/direct-upload/:token is retired and returns 404", async () => {
  const res = await app.request("https://collectr.example.test/api/direct-upload/some-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  }, {});
  assert.equal(res.status, 404);
});
