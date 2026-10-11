// Đọc thời điểm chụp (EXIF DateTimeOriginal) và toạ độ GPS ngay trên trình duyệt, không cần thư viện.
// Tìm khối "Exif\0\0" trong phần đầu file (JPEG APP1, và phần lớn HEIC/HEIF), rồi đọc cấu trúc TIFF bên trong.

const SCAN_BYTES = 512 * 1024;
const TAG_EXIF_IFD = 0x8769;
const TAG_DATETIME = 0x0132;
const TAG_DATETIME_ORIGINAL = 0x9003;
const TAG_OFFSET_TIME_ORIGINAL = 0x9011;
const TAG_GPS_IFD = 0x8825;
const GPS_LAT_REF = 1;
const GPS_LAT = 2;
const GPS_LNG_REF = 3;
const GPS_LNG = 4;
/** EXIF không ghi múi giờ thì coi như giờ Việt Nam, cùng múi giờ cả app đang dùng */
const DEFAULT_OFFSET = "+07:00";

export type ExifInfo = {
  /** ISO string của thời điểm chụp */
  takenAt?: string;
  /** Nơi chụp; ảnh gửi qua Zalo / Messenger thường đã bị xoá GPS */
  gps?: { lat: number; lng: number };
};

/** Giờ chụp + GPS; file không có / đọc không được EXIF thì trả về object rỗng. */
export async function readExif(file: Blob): Promise<ExifInfo> {
  try {
    const buf = new Uint8Array(await file.slice(0, SCAN_BYTES).arrayBuffer());
    const start = findExif(buf);
    if (start < 0) return {};
    return parseTiff(new DataView(buf.buffer, buf.byteOffset + start, buf.length - start));
  } catch {
    return {};
  }
}

/** ISO string của thời điểm chụp, hoặc undefined nếu file không có / đọc không được EXIF. */
export async function readTakenAt(file: Blob): Promise<string | undefined> {
  return (await readExif(file)).takenAt;
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

function parseTiff(v: DataView): ExifInfo {
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
  const offsetEntry = original !== undefined ? exif.get(TAG_OFFSET_TIME_ORIGINAL) : undefined;
  const takenAt = entry !== undefined ? toIso(ascii(entry), offsetEntry !== undefined ? ascii(offsetEntry) : undefined) : undefined;

  // GPS: độ / phút / giây, mỗi số là một RATIONAL (2 × uint32), cộng hướng N/S, E/W
  const gpsPtr = ifd0.get(TAG_GPS_IFD);
  const gpsIfd = gpsPtr !== undefined ? readIfd(u32(gpsPtr + 8)) : new Map<number, number>();
  const dms = (tag: number) => {
    const e = gpsIfd.get(tag);
    if (e === undefined || u32(e + 4) < 3) return undefined;
    const at = u32(e + 8);
    if (at + 24 > v.byteLength) return undefined;
    const r = (i: number) => {
      const den = u32(at + i * 8 + 4);
      return den ? u32(at + i * 8) / den : Number.NaN;
    };
    const deg = r(0) + r(1) / 60 + r(2) / 3600;
    return Number.isFinite(deg) ? deg : undefined;
  };
  const ref = (tag: number) => {
    const e = gpsIfd.get(tag);
    return e !== undefined ? String.fromCharCode(v.getUint8(e + 8)) : "";
  };
  const lat = dms(GPS_LAT);
  const lng = dms(GPS_LNG);
  // 0,0 = điện thoại ghi chỗ trống khi chưa bắt được GPS
  const gps =
    lat !== undefined && lng !== undefined && (lat !== 0 || lng !== 0) && lat <= 90 && lng <= 180
      ? { lat: ref(GPS_LAT_REF) === "S" ? -lat : lat, lng: ref(GPS_LNG_REF) === "W" ? -lng : lng }
      : undefined;

  return { ...(takenAt && { takenAt }), ...(gps && { gps }) };
}

/** "2025:12:20 14:03:11" (+ "+07:00") → ISO; bỏ qua giá trị rỗng / "0000:00:00 ..." */
function toIso(raw: string, offset?: string) {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(raw.trim());
  if (!m || m[1] === "0000") return undefined;
  const tz = offset && /^[+-]\d{2}:\d{2}$/.test(offset) ? offset : DEFAULT_OFFSET;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${tz}`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}
