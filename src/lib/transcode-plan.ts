// Kế hoạch chuyển mã video — hàm thuần, dùng trong scripts/transcode-worker.ts (và test).

/**
 * Cấu hình mã hoá — ưu tiên dung lượng (R2 tính tiền theo GB lưu; CPU trên GitHub Actions thì miễn phí).
 * Mỗi video chỉ còn một bản MP4 H.264, thay luôn file gốc (worker xoá file gốc sau khi xong).
 * Đo trên video quay điện thoại trong nhà (720p, nhiều nhiễu), so với preset veryfast / CRF 23 cũ:
 * - preset "slow": cùng chất lượng nhưng nhỏ hơn, mã hoá chậm hơn ~3 lần;
 * - CRF 26 + trần bitrate: cảnh dễ vẫn nhỏ, cảnh nhiễu / rung không phình lên 6 Mbps như trước,
 *   nên dung lượng tối đa tỉ lệ với độ dài video, không phụ thuộc file gốc nặng bao nhiêu;
 * - tối đa 30 fps: video 60 fps của điện thoại tốn gần gấp đôi mà xem lại không khác mấy.
 * Vẫn giữ H.264 (không HEVC / AV1) vì chỉ có một bản duy nhất, phải phát được trên mọi trình duyệt.
 */
export const ENCODE = {
  preset: "slow",
  crf: 26,
  maxFps: 30,
  audioKbps: 96,
} as const;

/**
 * Mức nén theo độ dài: clip ngắn giữ 720p đẹp; video dài xuống 540p + trần thấp hơn để không chiếm cả bucket.
 * Cùng bitrate 1,5 Mbps, 540p trông đẹp hơn 720p (VMAF 81,5 so với 78,5) nên video dài hạ độ phân giải
 * thay vì chỉ bóp bitrate. Độ phân giải tính theo cạnh ngắn (video dọc 720×1280 vẫn là "720"); nguồn nhỏ hơn giữ nguyên.
 */
export const TIERS = [
  // ≤ 5 phút: tối đa ~19 MB/phút (≤ ~95 MB một clip)
  { maxDurationMs: 5 * 60_000, shortSide: 720, maxrateKbps: 2500 },
  // dài hơn: tối đa ~12 MB/phút (video 1 giờ ≤ ~700 MB)
  { maxDurationMs: Infinity, shortSide: 540, maxrateKbps: 1500 },
] as const;

export type Tier = (typeof TIERS)[number];

/** Mức nén cho video; không đọc được độ dài (0) thì coi như clip ngắn. */
export function pickTier(durationMs: number): Tier {
  return TIERS.find((t) => durationMs <= t.maxDurationMs) ?? TIERS[TIERS.length - 1];
}

/** Ước tính dung lượng tối đa của bản đã nén (byte) — video + âm thanh chạm trần suốt video. */
export function maxOutputBytes(durationMs: number) {
  return Math.round(((pickTier(durationMs).maxrateKbps + ENCODE.audioKbps) * 1000 * (durationMs / 1000)) / 8);
}

export type ProbeStream = {
  codec_type?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  r_frame_rate?: string;
  color_transfer?: string;
  tags?: Record<string, string>;
  side_data_list?: Array<{ rotation?: number | string }>;
};

export type Probe = { streams?: ProbeStream[]; format?: { duration?: string } };

export type SourceInfo = {
  /** Kích thước khi hiển thị (đã tính xoay) */
  width: number;
  height: number;
  durationMs: number;
  /** Số khung hình / giây (0 nếu không đọc được) */
  fps: number;
  hdr: boolean;
};

/** "30000/1001" → 29.97; "0/0" hay thiếu → 0 */
function parseRate(rate: string | undefined) {
  const [num, den = "1"] = (rate ?? "").split("/");
  const v = Number(num) / Number(den);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/** Đọc kết quả `ffprobe -show_streams -show_format -print_format json`. */
export function sourceInfo(probe: Probe): SourceInfo {
  const v = probe.streams?.find((s) => s.codec_type === "video");
  if (!v?.width || !v.height) throw new Error("No video stream found");
  const rotation = Number(v.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? v.tags?.rotate ?? 0);
  const quarterTurn = Math.abs(rotation) % 180 === 90;
  const seconds = Number(probe.format?.duration ?? 0);
  return {
    width: quarterTurn ? v.height : v.width,
    height: quarterTurn ? v.width : v.height,
    durationMs: Number.isFinite(seconds) ? Math.round(seconds * 1000) : 0,
    // Video VFR (iPhone) có avg thấp hơn r_frame_rate; lấy avg, thiếu thì lấy r
    fps: Math.round((parseRate(v.avg_frame_rate) || parseRate(v.r_frame_rate)) * 100) / 100,
    // PQ (HDR10, Dolby Vision) hoặc HLG (iPhone quay HDR mặc định)
    hdr: v.color_transfer === "smpte2084" || v.color_transfer === "arib-std-b67",
  };
}

const even = (n: number) => Math.max(2, Math.floor(n / 2) * 2);

/**
 * Chuỗi filter `-vf`: (giảm về 30 fps) → (tone-map HDR → SDR) → thu nhỏ cạnh ngắn theo mức nén (`pickTier`) → yuv420p.
 * ffmpeg tự xoay theo metadata trước khi chạy filter, nên iw/ih đã là kích thước hiển thị.
 */
export function videoFilter(src: SourceInfo, opts: { tonemap: boolean }) {
  const short = even(Math.min(pickTier(src.durationMs).shortSide, Math.min(src.width, src.height)));
  const scale = src.width >= src.height ? `scale=-2:${short}` : `scale=${short}:-2`;
  const steps: string[] = [];
  // Chừa 1 fps cho nguồn 30 fps ghi lệch (30.02…); giảm fps trước để các bước sau xử lý ít khung hơn
  if (src.fps > ENCODE.maxFps + 1) steps.push(`fps=${ENCODE.maxFps}`);
  if (src.hdr && opts.tonemap) {
    steps.push(
      "zscale=t=linear:npl=100",
      "format=gbrpf32le",
      "zscale=p=bt709",
      "tonemap=tonemap=hable:desat=0",
      "zscale=t=bt709:m=bt709:r=tv",
    );
  }
  steps.push(`${scale}:flags=lanczos`, "format=yuv420p");
  return steps.join(",");
}

/** Tham số ffmpeg cho bản MP4 H.264 + AAC, phát được ngay khi đang tải (faststart). */
export function encodeArgs(input: string, output: string, filter: string, tier: Tier) {
  return [
    "-hide_banner",
    "-y",
    "-i",
    input,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    "-vf",
    filter,
    "-c:v",
    "libx264",
    "-preset",
    ENCODE.preset,
    "-crf",
    String(ENCODE.crf),
    "-maxrate",
    `${tier.maxrateKbps}k`,
    "-bufsize",
    `${tier.maxrateKbps * 2}k`,
    "-profile:v",
    "high",
    "-color_primaries",
    "bt709",
    "-color_trc",
    "bt709",
    "-colorspace",
    "bt709",
    "-c:a",
    "aac",
    "-b:a",
    `${ENCODE.audioKbps}k`,
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    output,
  ];
}

/** Lấy khung hình làm poster: giây thứ 1 (video ngắn hơn thì lấy giữa video). */
export function posterArgs(input: string, output: string, durationMs: number) {
  const at = Math.min(1, durationMs / 2000);
  return ["-hide_banner", "-y", "-ss", at.toFixed(2), "-i", input, "-frames:v", "1", "-q:v", "3", output];
}

/** Key R2 của các file sinh ra, cạnh file gốc: `albums/<album>/<uuid>.720.mp4` (hoặc `.540.mp4`), `.poster.jpg`. */
export function outputKeys(originalKey: string, tier: Tier) {
  const base = originalKey.replace(/\.[^./]+$/, "");
  return {
    video: `${base}.${tier.shortSide}.mp4`,
    poster: `${base}.poster.jpg`,
  };
}
