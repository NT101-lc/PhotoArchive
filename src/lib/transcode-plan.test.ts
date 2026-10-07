import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { encodeArgs, outputKeys, posterArgs, sourceInfo, videoFilter } from "./transcode-plan";

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

  it("scales the short side to 720, never upscales, and tone-maps HDR when possible", () => {
    const portrait = sourceInfo(iphonePortraitHdr);
    assert.match(videoFilter(portrait, { tonemap: true }), /^zscale=t=linear.*tonemap=hable.*scale=720:-2:flags=lanczos,format=yuv420p$/);
    assert.equal(videoFilter(portrait, { tonemap: false }), "scale=720:-2:flags=lanczos,format=yuv420p");
    const landscape = { width: 1920, height: 1080, durationMs: 0, hdr: false };
    assert.equal(videoFilter(landscape, { tonemap: true }), "scale=-2:720:flags=lanczos,format=yuv420p");
    const small = { width: 641, height: 359, durationMs: 0, hdr: false };
    assert.equal(videoFilter(small, { tonemap: true }), "scale=-2:358:flags=lanczos,format=yuv420p");
  });

  it("encodes one H.264 MP4 that can start playing while downloading", () => {
    const args = encodeArgs("in.mov", "out.mp4", "scale=-2:720");
    assert.equal(args[args.indexOf("-c:v") + 1], "libx264");
    assert.equal(args[args.indexOf("-movflags") + 1], "+faststart");
    assert.equal(args.at(-1), "out.mp4");
  });

  it("names outputs next to the original", () => {
    const keys = outputKeys("albums/a1/9f3c.mov");
    assert.equal(keys.video, "albums/a1/9f3c.720.mp4");
    assert.equal(keys.poster, "albums/a1/9f3c.poster.jpg");
  });

  it("takes the poster at 1s, or mid-way for very short clips", () => {
    assert.equal(posterArgs("in.mp4", "p.jpg", 12_000)[3], "1.00");
    assert.equal(posterArgs("in.mp4", "p.jpg", 800)[3], "0.40");
  });
});
