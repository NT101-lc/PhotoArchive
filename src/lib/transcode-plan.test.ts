import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { outputKeys, plannedRenditions, posterArgs, sourceInfo, videoFilter } from "./transcode-plan";

const iphonePortraitHdr = {
  streams: [
    { codec_type: "audio" },
    {
      codec_type: "video",
      width: 3840,
      height: 2160,
      color_transfer: "arib-std-b67",
      side_data_list: [{ rotation: -90 }],
    },
  ],
  format: { duration: "12.480000" },
};

describe("transcode plan", () => {
  it("reads display size, duration and HDR from ffprobe output", () => {
    assert.deepEqual(sourceInfo(iphonePortraitHdr), { width: 2160, height: 3840, durationMs: 12480, hdr: true });
    assert.deepEqual(
      sourceInfo({ streams: [{ codec_type: "video", width: 1280, height: 720, tags: { rotate: "180" } }], format: {} }),
      { width: 1280, height: 720, durationMs: 0, hdr: false },
    );
    assert.throws(() => sourceInfo({ streams: [{ codec_type: "audio" }] }), /No video stream/);
  });

  it("makes 1080p only when the source is sharp enough", () => {
    assert.deepEqual(plannedRenditions({ width: 1920, height: 1080 }), [720, 1080]);
    assert.deepEqual(plannedRenditions({ width: 1080, height: 1920 }), [720, 1080]);
    assert.deepEqual(plannedRenditions({ width: 1280, height: 720 }), [720]);
    assert.deepEqual(plannedRenditions({ width: 640, height: 360 }), [720]);
  });

  it("scales the short side, never upscales, and tone-maps HDR when possible", () => {
    const portrait = sourceInfo(iphonePortraitHdr);
    assert.match(videoFilter(portrait, 1080, { tonemap: true }), /^zscale=t=linear.*tonemap=hable.*scale=1080:-2:flags=lanczos,format=yuv420p$/);
    assert.equal(videoFilter(portrait, 720, { tonemap: false }), "scale=720:-2:flags=lanczos,format=yuv420p");
    const small = { width: 641, height: 359, durationMs: 0, hdr: false };
    assert.equal(videoFilter(small, 720, { tonemap: true }), "scale=-2:358:flags=lanczos,format=yuv420p");
  });

  it("names outputs next to the original", () => {
    const keys = outputKeys("albums/a1/9f3c.mov");
    assert.equal(keys.video(720), "albums/a1/9f3c.720.mp4");
    assert.equal(keys.video(1080), "albums/a1/9f3c.1080.mp4");
    assert.equal(keys.poster, "albums/a1/9f3c.poster.jpg");
  });

  it("takes the poster at 1s, or mid-way for very short clips", () => {
    assert.equal(posterArgs("in.mp4", "p.jpg", 12_000)[3], "1.00");
    assert.equal(posterArgs("in.mp4", "p.jpg", 800)[3], "0.40");
  });
});
