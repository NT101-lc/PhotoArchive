// heic-decode không kèm type. Chỉ khai báo phần worker dùng (scripts/transcode-worker.ts).
declare module "heic-decode" {
  /** Giải mã ảnh đầu tiên (ảnh chính) của file HEIC / HEIF → pixel RGBA, đã xoay đúng chiều */
  export default function decode(input: { buffer: ArrayBufferLike | Uint8Array }): Promise<{
    width: number;
    height: number;
    data: Uint8ClampedArray;
  }>;
}
