// Đọc thời điểm chụp (EXIF DateTimeOriginal) ngay trên trình duyệt, không cần thư viện.
// Tìm khối "Exif\0\0" trong phần đầu file (JPEG APP1, và phần lớn HEIC/HEIF), rồi đọc cấu trúc TIFF bên trong.

const SCAN_BYTES = 512 * 1024;
const TAG_EXIF_IFD = 0x8769;
const TAG_DATETIME = 0x0132;
const TAG_DATETIME_ORIGINAL = 0x9003;
const TAG_OFFSET_TIME_ORIGINAL = 0x9011;
/** EXIF không ghi múi giờ thì coi như giờ Việt Nam, cùng múi giờ cả app đang dùng */
const DEFAULT_OFFSET = "+07:00";

/** ISO string của thời điểm chụp, hoặc undefined nếu file không có / đọc không được EXIF. */
export async function readTakenAt(file: Blob): Promise<string | undefined> {
  try {
    const buf = new Uint8Array(await file.slice(0, SCAN_BYTES).arrayBuffer());
    const start = findExif(buf);
    if (start < 0) return undefined;
    return parseTiff(new DataView(buf.buffer, buf.byteOffset + start, buf.length - start));
  } catch {
    return undefined;
  }
}

function findExif(b: Uint8Array) {
  for (let i = 0; i + 10 < b.length; i++) {
    // "Exif\0\0" theo sau là "II" hoặc "MM"
    if (b[i] === 0x45 && b[i + 1] === 0x78 && b[i + 2] === 0x69 && b[i + 3] === 0x66 && b[i + 4] === 0 && b[i + 5] === 0) {
      const o = b[i + 6];
      if ((o === 0x49 && b[i + 7] === 0x49) || (o === 0x4d && b[i + 7] === 0x4d)) return i + 6;
    }
  }
  return -1;
}

function parseTiff(v: DataView) {
  const le = v.getUint16(0) === 0x4949;
  const u16 = (o: number) => v.getUint16(o, le);
  const u32 = (o: number) => v.getUint32(o, le);
  const ascii = (entry: number) => {
    const count = u32(entry + 4);
    const at = count > 4 ? u32(entry + 8) : entry + 8;
    let s = "";
    for (let i = 0; i < count && at + i < v.byteLength; i++) {
      const c = v.getUint8(at + i);
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s;
  };
  const readIfd = (offset: number) => {
    const tags = new Map<number, number>();
    if (offset + 2 > v.byteLength) return tags;
    const n = u16(offset);
    for (let i = 0; i < n; i++) {
      const entry = offset + 2 + i * 12;
      if (entry + 12 > v.byteLength) break;
      tags.set(u16(entry), entry);
    }
    return tags;
  };

  const ifd0 = readIfd(u32(4));
  const exifPtr = ifd0.get(TAG_EXIF_IFD);
  const exif = exifPtr !== undefined ? readIfd(u32(exifPtr + 8)) : new Map<number, number>();

  const original = exif.get(TAG_DATETIME_ORIGINAL);
  const entry = original ?? ifd0.get(TAG_DATETIME);
  if (entry === undefined) return undefined;
  const offsetEntry = original !== undefined ? exif.get(TAG_OFFSET_TIME_ORIGINAL) : undefined;
  return toIso(ascii(entry), offsetEntry !== undefined ? ascii(offsetEntry) : undefined);
}

/** "2025:12:20 14:03:11" (+ "+07:00") → ISO; bỏ qua giá trị rỗng / "0000:00:00 ..." */
function toIso(raw: string, offset?: string) {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(raw.trim());
  if (!m || m[1] === "0000") return undefined;
  const tz = offset && /^[+-]\d{2}:\d{2}$/.test(offset) ? offset : DEFAULT_OFFSET;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${tz}`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}
