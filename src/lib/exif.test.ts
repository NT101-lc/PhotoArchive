import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readExif, readTakenAt } from "./exif";

type Entry = { tag: number; type: number; count: number; value: number[] | string };

/**
 * Dựng một khối EXIF tối giản như trong file JPEG: "Exif\0\0" + TIFF (IFD0, IFD GPS).
 * `le` = little-endian ("II", điện thoại Android / iPhone) hay big-endian ("MM", một số máy ảnh).
 */
function exifBlock(opts: { le: boolean; dateTime?: string; gps?: { lat: [number, number, number]; latRef: string; lng: [number, number, number]; lngRef: string } }) {
  const buf = new DataView(new ArrayBuffer(512));
  const { le } = opts;
  let p = 0;
  const put8 = (n: number) => buf.setUint8(p++, n);
  const put16 = (n: number, at = p) => (buf.setUint16(at, n, le), at === p && (p += 2));
  const put32 = (n: number, at = p) => (buf.setUint32(at, n, le), at === p && (p += 4));
  for (const c of "Exif\0\0") put8(c.charCodeAt(0));
  const tiff = p;
  put8(le ? 0x49 : 0x4d);
  put8(le ? 0x49 : 0x4d);
  put16(42);
  put32(8); // IFD0 ngay sau header

  // Vùng dữ liệu (chuỗi dài, RATIONAL) để sau các IFD
  let data = 200;
  const writeIfd = (entries: Entry[]) => {
    put16(entries.length);
    for (const e of entries) {
      put16(e.tag);
      put16(e.type);
      put32(e.count);
      if (typeof e.value === "string") {
        if (e.count <= 4) {
          for (let i = 0; i < 4; i++) put8(i < e.value.length ? e.value.charCodeAt(i) : 0);
        } else {
          put32(data);
          for (let i = 0; i < e.value.length; i++) buf.setUint8(tiff + data + i, e.value.charCodeAt(i));
          data += e.count;
        }
      } else if (e.type === 5) {
        put32(data);
        for (const n of e.value) {
          buf.setUint32(tiff + data, n, le);
          data += 4;
        }
      } else put32(e.value[0]);
    }
    put32(0);
  };

  const ifd0: Entry[] = [];
  if (opts.dateTime) ifd0.push({ tag: 0x0132, type: 2, count: opts.dateTime.length + 1, value: opts.dateTime + "\0" });
  const gpsAt = 8 + 2 + 12 * (ifd0.length + (opts.gps ? 1 : 0)) + 4;
  if (opts.gps) ifd0.push({ tag: 0x8825, type: 4, count: 1, value: [gpsAt] });
  writeIfd(ifd0);
  if (opts.gps) {
    const g = opts.gps;
    // Mỗi số = tử / mẫu; giây nhân 100 để có phần lẻ
    const rat = ([d, m, s]: [number, number, number]) => [d, 1, m, 1, Math.round(s * 100), 100];
    writeIfd([
      { tag: 1, type: 2, count: 2, value: g.latRef },
      { tag: 2, type: 5, count: 3, value: rat(g.lat) },
      { tag: 3, type: 2, count: 2, value: g.lngRef },
      { tag: 4, type: 5, count: 3, value: rat(g.lng) },
    ]);
  }
  // Giả làm phần đầu file JPEG: vài byte rác trước khối EXIF
  return new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0, 0]), new Uint8Array(buf.buffer)]);
}

describe("exif", () => {
  it("reads the time taken and GPS position (Đà Lạt, north / east)", async () => {
    const file = exifBlock({
      le: true,
      dateTime: "2026:07:15 14:32:10",
      gps: { lat: [11, 56, 24.6], latRef: "N", lng: [108, 26, 30], lngRef: "E" },
    });
    const info = await readExif(file);
    assert.equal(info.takenAt, "2026-07-15T07:32:10.000Z"); // không có múi giờ → coi là giờ Việt Nam
    assert.ok(Math.abs(info.gps!.lat - 11.94017) < 1e-4);
    assert.ok(Math.abs(info.gps!.lng - 108.44167) < 1e-4);
    assert.equal(await readTakenAt(file), info.takenAt);
  });

  it("handles big-endian files and south / west coordinates", async () => {
    const info = await readExif(
      exifBlock({ le: false, gps: { lat: [33, 52, 4], latRef: "S", lng: [151, 12, 26], lngRef: "W" } }),
    );
    assert.equal(info.takenAt, undefined);
    assert.ok(info.gps!.lat < -33.8 && info.gps!.lng < -151.2);
  });

  it("ignores missing or blank GPS", async () => {
    assert.deepEqual(await readExif(exifBlock({ le: true, dateTime: "2026:01:01 00:00:00" })), {
      takenAt: "2025-12-31T17:00:00.000Z",
    });
    const blank = await readExif(exifBlock({ le: true, gps: { lat: [0, 0, 0], latRef: "N", lng: [0, 0, 0], lngRef: "E" } }));
    assert.equal(blank.gps, undefined);
    assert.deepEqual(await readExif(new Blob([new Uint8Array(64)])), {});
  });
});
