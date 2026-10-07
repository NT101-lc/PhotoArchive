import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { categorizeKey, R2_FREE_BYTES, storageBreakdown, storageForecast } from "./storage-stats";

const GB = 1000 ** 3;

describe("storage stats", () => {
  it("sorts R2 keys into categories", () => {
    assert.equal(categorizeKey("avatars/m1/a.jpg"), "avatars");
    assert.equal(categorizeKey("albums/a/9f.720.mp4"), "videoCopies");
    assert.equal(categorizeKey("albums/a/9f.1080.mp4"), "videoCopies");
    assert.equal(categorizeKey("albums/a/9f.poster.jpg"), "posters");
    assert.equal(categorizeKey("albums/a/9f.mov"), "videoOriginals");
    assert.equal(categorizeKey("albums/a/9f.MP4"), "videoOriginals");
    assert.equal(categorizeKey("albums/a/9f.heic"), "photos");
  });

  it("sums bytes per category", () => {
    const { bytes, total } = storageBreakdown([
      { key: "albums/a/1.jpg", size: 100 },
      { key: "albums/a/2.mov", size: 1000 },
      { key: "albums/a/2.720.mp4", size: 200 },
      { key: "albums/a/2.poster.jpg", size: 10 },
    ]);
    assert.equal(bytes.photos, 100);
    assert.equal(bytes.videoOriginals, 1000);
    assert.equal(bytes.videoCopies, 200);
    assert.equal(bytes.posters, 10);
    assert.equal(total, 1310);
  });

  it("forecasts when the free tier runs out, counting video copies", () => {
    const now = new Date("2026-10-07T00:00:00Z");
    // 4 GB dùng, file gốc 2 GB → mỗi GB gốc thực tế tốn 2 GB; 90 ngày qua up 0.9 GB gốc → 20 MB/ngày
    const f = storageForecast({ usedBytes: 4 * GB, totalOriginalBytes: 2 * GB, recentOriginalBytes: 0.9 * GB, windowDays: 90, now });
    assert.equal(f.bytesPerDay, 0.02 * GB);
    assert.equal(f.daysLeft, 300);
    assert.equal(f.date?.toISOString().slice(0, 10), "2027-08-03");
  });

  it("handles no recent uploads and an already-full tier", () => {
    assert.deepEqual(
      storageForecast({ usedBytes: GB, totalOriginalBytes: GB, recentOriginalBytes: 0, windowDays: 90 }),
      { bytesPerDay: 0, daysLeft: null, date: null, over: false },
    );
    assert.equal(storageForecast({ usedBytes: R2_FREE_BYTES + 1, totalOriginalBytes: GB, recentOriginalBytes: GB, windowDays: 90 }).over, true);
  });
});
