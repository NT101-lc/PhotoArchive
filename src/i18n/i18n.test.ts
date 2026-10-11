import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatDate, formatDateRange, formatDayHeading, timeAgo } from "../lib/format";
import { localeFromAcceptLanguage } from "./config";
import { en } from "./en";
import { vi } from "./vi";

/** Mọi đường dẫn khoá của từ điển, kèm loại giá trị (chuỗi / hàm) */
function shape(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? shape(v, `${prefix}${k}.`) : [`${prefix}${k}:${typeof v}`],
  );
}

describe("i18n", () => {
  it("has the same keys (and the same kind of value) in English and Vietnamese", () => {
    assert.deepEqual(shape(vi).sort(), shape(en).sort());
  });

  it("has no empty strings", () => {
    for (const [name, dict] of [["en", en], ["vi", vi]] as const) {
      const empty = shape(dict).filter((k) => k.endsWith(":string")).filter((k) => {
        const value = k
          .split(":")[0]
          .split(".")
          .reduce<unknown>((o, key) => (o as Record<string, unknown>)[key], dict);
        return !String(value).trim();
      });
      assert.deepEqual(empty, [], `${name} has empty strings`);
    }
  });

  it("picks the browser's language when nothing was chosen", () => {
    assert.equal(localeFromAcceptLanguage("vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7"), "vi");
    assert.equal(localeFromAcceptLanguage("en-US,en;q=0.9,vi;q=0.8"), "en");
    // Thứ tự theo q, không theo vị trí trong header
    assert.equal(localeFromAcceptLanguage("en;q=0.5,vi;q=0.9"), "vi");
    assert.equal(localeFromAcceptLanguage("fr-FR,de;q=0.8"), "en");
    assert.equal(localeFromAcceptLanguage(null), "en");
    assert.equal(localeFromAcceptLanguage(""), "en");
  });

  it("uses plurals in English but not in Vietnamese", () => {
    assert.equal(en.count.photos(1), "1 photo");
    assert.equal(en.count.photos(3), "3 photos");
    assert.equal(en.count.people(2), "2 people");
    assert.equal(vi.count.photos(3), "3 ảnh");
    assert.equal(en.home.summary(5, 1, 1), "5 photos from 1 person.");
    assert.equal(vi.home.summary(5, 2, 3), "5 ảnh của 2 người, trong 3 ngày.");
  });

  it("formats dates in Vietnamese", () => {
    assert.equal(formatDate("2025-12-20", "vi"), "20 thg 12, 2025");
    assert.equal(formatDateRange("2025-12-20", "2025-12-22", "vi"), "20–22 thg 12, 2025");
    assert.equal(formatDateRange("2025-11-30", "2025-12-02", "vi"), "30 thg 11 – 2 thg 12, 2025");
    assert.equal(formatDateRange("2025-12-30", "2026-01-02", "vi"), "30 thg 12, 2025 – 2 thg 1, 2026");
    assert.equal(formatDayHeading("2025-12-20T05:00:00Z", "vi"), "Thứ Bảy, 20 thg 12");
    const now = Date.parse("2026-10-11T12:00:00Z");
    assert.equal(timeAgo("2026-10-11T11:55:00Z", now, "vi"), "5 phút trước");
    assert.equal(timeAgo("2026-10-10T12:00:00Z", now, "vi"), "hôm qua");
    assert.equal(timeAgo("2026-10-11T11:59:50Z", now, "vi"), "vừa xong");
  });

  it("keeps the English date formats unchanged", () => {
    assert.equal(formatDate("2025-12-20"), "20 Dec 2025");
    assert.equal(formatDateRange("2025-12-20", "2025-12-22"), "20–22 Dec 2025");
    assert.equal(formatDateRange("2025-11-30", "2025-12-02"), "30 Nov – 2 Dec 2025");
    assert.equal(formatDateRange("2025-12-30", "2026-01-02"), "30 Dec 2025 – 2 Jan 2026");
  });
});
