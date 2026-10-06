import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dayKey, formatBytes, formatDate, normalizeText, plural, slugify, yearOf } from "./format";

describe("format", () => {
  it("normalizeText strips Vietnamese accents for search", () => {
    assert.equal(normalizeText("Đà Lạt mùa sương"), "da lat mua suong");
    assert.equal(normalizeText("  PHÚ QUỐC "), "phu quoc");
  });

  it("slugify makes URL-safe album slugs", () => {
    assert.equal(slugify("Đà Lạt mùa sương 2025"), "da-lat-mua-suong-2025");
    assert.equal(slugify("  Hội An — đêm đèn lồng!! "), "hoi-an-dem-den-long");
    assert.equal(slugify("!!!"), "");
    assert.ok(slugify("a".repeat(100)).length <= 60);
  });

  it("plural", () => {
    assert.equal(plural(1, "photo"), "1 photo");
    assert.equal(plural(0, "photo"), "0 photos");
    assert.equal(plural(14, "trip"), "14 trips");
  });

  it("dates use Vietnam time", () => {
    assert.equal(formatDate("2025-12-20"), "20 Dec 2025");
    assert.equal(yearOf("2024-04-27"), "2024");
    // 23:30 UTC on the 19th is already the 20th in Vietnam (UTC+7)
    assert.equal(dayKey("2025-12-19T23:30:00Z"), "2025-12-20");
  });

  it("formatBytes", () => {
    assert.equal(formatBytes(512), "512 B");
    assert.equal(formatBytes(2048), "2 KB");
    assert.equal(formatBytes(5 * 1024 * 1024), "5.0 MB");
  });
});
