"use client";

import { useEffect, useState } from "react";
import { reversePlace } from "./api-client";
import { readExif } from "./exif";
import { gpsClusters, type Coords, type Place } from "./places-format";

/** Đọc GPS của tối đa chừng này ảnh (rải đều cả bộ) — đủ để biết chuyến đi ở đâu mà không phải đọc cả nghìn file */
const SAMPLE = 60;

/**
 * Gợi ý nơi chụp cho album mới từ GPS trong ảnh: gom toạ độ thành vài khu vực, khu đông ảnh nhất trước,
 * rồi tìm ngược ra tên thành phố. Ảnh không có GPS (qua Zalo / Messenger, ảnh chụp màn hình) thì bỏ qua.
 */
export function usePhotoPlaces(files: File[], enabled: boolean) {
  // Kết quả gắn với bộ ảnh đã đọc; bộ ảnh đổi thì kết quả cũ tự hết hiệu lực
  const [found, setFound] = useState<{ signature: string; places: Place[] }>({ signature: "", places: [] });
  // Chỉ chạy lại khi bộ ảnh đổi thật (thêm / bớt), không phải mỗi lần render
  const signature = enabled ? files.map((f) => `${f.name}:${f.size}`).join("|") : "";

  useEffect(() => {
    if (!signature) return;
    let alive = true;
    (async () => {
      const photos = files.filter((f) => f.type.startsWith("image/") || /\.(jpe?g|heic|heif)$/i.test(f.name));
      const step = Math.max(1, Math.floor(photos.length / SAMPLE));
      const sample = photos.filter((_, i) => i % step === 0).slice(0, SAMPLE);
      const points = (await Promise.all(sample.map(async (f) => (await readExif(f)).gps))).filter((g): g is Coords => !!g);
      if (!alive || points.length === 0) return;

      const places: Place[] = [];
      for (const c of gpsClusters(points)) {
        const place = await reversePlace(c).then((r) => r.place).catch(() => null);
        if (!alive) return;
        // Hai khu vực gần nhau có thể cùng một thành phố
        if (place && !places.some((p) => p.name === place.name)) places.push(place);
      }
      setFound({ signature, places });
    })();
    return () => {
      alive = false;
    };
    // `files` đổi tham chiếu mỗi lần render; `signature` mới là thứ quyết định
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return found.signature === signature ? found.places : [];
}
