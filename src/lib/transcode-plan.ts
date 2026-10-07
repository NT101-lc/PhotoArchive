// Kế hoạch chuyển mã video — hàm thuần, dùng trong scripts/transcode-worker.ts (và test).

/**
 * Mỗi video chỉ còn một bản: MP4 H.264 720p, tính theo cạnh ngắn (video dọc 720×1280 vẫn là "720";
 * nguồn nhỏ hơn thì giữ nguyên cỡ). Bản này thay luôn file gốc — worker xoá file gốc sau khi xong.
 */
export const TARGET_SHORT_SIDE = 720;

export type ProbeStream = {
  codec_type?: string;
  width?: number;
  height?: number;
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
  hdr: boolean;
};

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
    // PQ (HDR10, Dolby Vision) hoặc HLG (iPhone quay HDR mặc định)
    hdr: v.color_transfer === "smpte2084" || v.color_transfer === "arib-std-b67",
  };
}

const even = (n: number) => Math.max(2, Math.floor(n / 2) * 2);

/**
 * Chuỗi filter `-vf`: (tone-map HDR → SDR) → thu nhỏ cạnh ngắn về 720 → yuv420p.
 * ffmpeg tự xoay theo metadata trước khi chạy filter, nên iw/ih đã là kích thước hiển thị.
 */
export function videoFilter(src: SourceInfo, opts: { tonemap: boolean }) {
  const short = even(Math.min(TARGET_SHORT_SIDE, Math.min(src.width, src.height)));
  const scale = src.width >= src.height ? `scale=-2:${short}` : `scale=${short}:-2`;
  const steps: string[] = [];
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
export function encodeArgs(input: string, output: string, filter: string) {
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
    "veryfast",
    "-crf",
    "23",
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
    "128k",
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

/** Key R2 của các file sinh ra, cạnh file gốc: `albums/<album>/<uuid>.720.mp4`, `.poster.jpg`. */
export function outputKeys(originalKey: string) {
  const base = originalKey.replace(/\.[^./]+$/, "");
  return {
    video: `${base}.${TARGET_SHORT_SIDE}.mp4`,
    poster: `${base}.poster.jpg`,
  };
}
