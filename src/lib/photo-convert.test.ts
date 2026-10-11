import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { convertedKey, needsConversion } from "./photo-convert";

describe("photo conversion", () => {
  it("converts HEIC / HEIF, by MIME type or by file extension", () => {
    assert.equal(needsConversion({ mimeType: "image/heic" }), true);
    assert.equal(needsConversion({ mimeType: "IMAGE/HEIF" }), true);
    assert.equal(needsConversion({ key: "albums/a/1.HEIC" }), true);
    assert.equal(needsConversion({ mimeType: "image/jpeg", key: "albums/a/1.jpg" }), false);
    assert.equal(needsConversion({ mimeType: "image/avif" }), false);
    assert.equal(needsConversion({}), false);
  });

  it("puts the JPEG next to the original", () => {
    assert.equal(convertedKey("albums/a1/9f3c.heic"), "albums/a1/9f3c.jpg");
    assert.equal(convertedKey("albums/a1/9f3c.HEIF"), "albums/a1/9f3c.jpg");
  });
});
