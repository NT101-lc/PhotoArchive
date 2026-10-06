import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanDescription, dayKey, formatBytes, formatDate, formatDateRange, normalizeText, plural, slugify, tripDays, yearOf } from "./format";

describe("format", () => {
  it("cleanDescription trims lines, collapses blank runs, and turns empty into null", () => {
    assert.equal(cleanDescription("  Ba ngày sương mù.  \r\n  Tối ra chợ đêm. "), "Ba ngày sương mù.\nTối ra chợ đêm.");
    assert.equal(cleanDescription("Ngày 1\n\n\n\nNgày 2"), "Ngày 1\n\nNgày 2");
    assert.equal(cleanDescription("   \n  "), null);
    assert.equal(cleanDescription(""), null);
    assert.equal(cleanDescription(null), null);
  });

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

  it("formatDateRange merges shared month / year", () => {
    assert.equal(formatDateRange("2025-12-20", null), "20 Dec 2025");
    assert.equal(formatDateRange("2025-12-20", "2025-12-20"), "20 Dec 2025");
    assert.equal(formatDateRange("2025-12-20", "2025-12-22"), "20–22 Dec 2025");
    assert.equal(formatDateRange("2025-11-30", "2025-12-02"), "30 Nov – 2 Dec 2025");
    assert.equal(formatDateRange("2025-12-30", "2026-01-02"), "30 Dec 2025 – 2 Jan 2026");
  });

  it("tripDays counts both ends", () => {
    assert.equal(tripDays("2025-12-20", null), 1);
    assert.equal(tripDays("2025-12-20", "2025-12-22"), 3);
    assert.equal(tripDays("2025-12-30", "2026-01-02"), 4);
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
