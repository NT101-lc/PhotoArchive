import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { timeAgo } from "./format";
import { cleanComment, isReaction, summarizeReactions } from "./photo-social";

describe("photo social", () => {
  it("groups reactions by emoji in a fixed order and marks mine", () => {
    const rows = [
      { emoji: "🔥", memberId: "a", name: "Thảo" },
      { emoji: "❤️", memberId: "b", name: "Nam" },
      { emoji: "🔥", memberId: "c", name: null },
    ];
    assert.deepEqual(summarizeReactions(rows, "c"), [
      { emoji: "❤️", count: 1, mine: false, names: ["Nam"] },
      { emoji: "🔥", count: 2, mine: true, names: ["Thảo", "Someone"] },
    ]);
    assert.deepEqual(summarizeReactions([], null), []);
  });

  it("only accepts the allowed emoji", () => {
    assert.equal(isReaction("❤️"), true);
    assert.equal(isReaction("💩"), false);
    assert.equal(isReaction(null), false);
  });

  it("cleans comments", () => {
    assert.equal(cleanComment("  hello  \r\n\r\n\r\n\r\nworld  "), "hello\n\nworld");
    assert.equal(cleanComment("   \n  "), "");
    assert.equal(cleanComment("x".repeat(600)).length, 500);
  });

  it("says how long ago", () => {
    const now = Date.parse("2026-10-08T12:00:00Z");
    assert.equal(timeAgo("2026-10-08T11:59:50Z", now), "just now");
    assert.equal(timeAgo("2026-10-08T11:45:00Z", now), "15 min ago");
    assert.equal(timeAgo("2026-10-08T09:00:00Z", now), "3 hours ago");
    assert.equal(timeAgo("2026-10-07T10:00:00Z", now), "yesterday");
    assert.equal(timeAgo("2026-08-01T10:00:00Z", now), "1 Aug 2026");
  });
});
