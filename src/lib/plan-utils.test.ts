import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { daysUntil, parseVnd, planDays, planTotals } from "./plan-utils";

describe("plan utils", () => {
  it("lists every day of the trip, inclusive", () => {
    assert.deepEqual(planDays("2026-10-30", "2026-11-02"), ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
    assert.deepEqual(planDays("2026-10-30", "2026-10-30"), ["2026-10-30"]);
    assert.equal(planDays("2026-01-01", "2026-12-31").length, 21);
  });

  it("reads money the way people type it", () => {
    assert.equal(parseVnd("1.500.000"), 1_500_000);
    assert.equal(parseVnd("1,500,000 đ"), 1_500_000);
    assert.equal(parseVnd("200k"), 200_000);
    assert.equal(parseVnd("1,5tr"), 1_500_000);
    assert.equal(parseVnd("2.5m"), 2_500_000);
    assert.equal(parseVnd(""), null);
    assert.equal(parseVnd("a lot"), null);
  });

  it("splits the total between the people going, rounded up to 1.000", () => {
    const items = [
      { id: "a", done: false, text: "Hotel", who: null, cost: 1_000_000, note: "" },
      { id: "b", done: true, text: "Bus", who: null, cost: 250_000, note: "" },
      { id: "c", done: false, text: "Snacks", who: null, cost: null, note: "" },
    ];
    assert.deepEqual(planTotals(items, 3), { total: 1_250_000, perPerson: 417_000 });
    assert.deepEqual(planTotals(items, 0), { total: 1_250_000, perPerson: null });
  });

  it("counts days until the trip in Vietnam time", () => {
    const now = Date.parse("2026-10-07T20:00:00Z"); // 03:00 ngày 8/10 giờ VN
    assert.equal(daysUntil("2026-10-08", now), 0);
    assert.equal(daysUntil("2026-10-18", now), 10);
    assert.equal(daysUntil("2026-10-01", now), -7);
  });
});
