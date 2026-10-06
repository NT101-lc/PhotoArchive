import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashPassword, verifyPassword } from "./password";

describe("password", () => {
  it("verifies the right password and rejects others", async () => {
    const stored = await hashPassword("correct horse battery");
    assert.match(stored, /^[0-9a-f]{32}:[0-9a-f]{128}$/);
    assert.equal(await verifyPassword("correct horse battery", stored), true);
    assert.equal(await verifyPassword("wrong", stored), false);
  });

  it("salts every hash", async () => {
    assert.notEqual(await hashPassword("same"), await hashPassword("same"));
  });

  it("rejects missing or malformed hashes", async () => {
    assert.equal(await verifyPassword("x", null), false);
    assert.equal(await verifyPassword("x", ""), false);
    assert.equal(await verifyPassword("x", "not-a-hash"), false);
  });
});
