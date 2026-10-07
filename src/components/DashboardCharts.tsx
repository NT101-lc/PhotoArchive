"use client";

import { useState } from "react";
import { plural } from "@/lib/format";
import { Avatar } from "./Avatar";

// Biểu đồ của /dashboard. Một chuỗi dữ liệu nên không có chú thích (tiêu đề đã nói tên),
// màu dữ liệu là token --chart (đã kiểm tra tương phản với nền ở cả hai chế độ).
// Mỗi cột / thanh có tooltip khi rê chuột hoặc focus bằng bàn phím; bảng ẩn cho trình đọc màn hình.

type YearRow = { year: number; trips: number; photos: number };

const CHART_H = 160;

/** Cột: số chuyến mỗi năm. Số ở đầu cột; tooltip thêm số ảnh. */
export function TripsByYear({ data }: { data: YearRow[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.trips));

  if (data.length === 0) return <p className="text-sm text-ink-soft">No trips yet.</p>;

  return (
    <figure className="m-0">
      <div className="relative" style={{ height: CHART_H + 28 }}>
        {/* Đường đáy */}
        <div className="absolute inset-x-0 h-px bg-line" style={{ top: CHART_H }} />
        <div className="absolute inset-x-0 top-0 flex justify-around" style={{ height: CHART_H }}>
          {data.map((d, i) => {
            const h = Math.max(4, (d.trips / max) * (CHART_H - 24));
            return (
              <div
                key={d.year}
                tabIndex={0}
                aria-label={`${d.year}: ${plural(d.trips, "trip")}, ${plural(d.photos, "photo")}`}
                className="relative flex h-full w-full max-w-24 cursor-default flex-col items-center justify-end rounded-md outline-offset-2"
                onPointerEnter={() => setActive(i)}
                onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              >
                <span className="mb-1 text-sm font-semibold tabular-nums" aria-hidden="true">{d.trips}</span>
                <span
                  className="w-6 rounded-t-[4px] bg-chart transition-[filter] duration-100"
                  style={{ height: h, filter: active === i ? "brightness(1.15)" : undefined }}
                />
                {active === i && <Tooltip value={plural(d.trips, "trip")} label={`${d.year}, ${plural(d.photos, "photo")}`} />}
              </div>
            );
          })}
        </div>
        <div className="absolute inset-x-0 flex justify-around" style={{ top: CHART_H + 6 }} aria-hidden="true">
          {data.map((d) => (
            <span key={d.year} className="w-full max-w-24 text-center text-xs text-ink-soft tabular-nums">
              {d.year}
            </span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>Trips per year</caption>
        <thead>
          <tr>
            <th>Year</th>
            <th>Trips</th>
            <th>Photos and videos</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.year}>
              <td>{d.year}</td>
              <td>{d.trips}</td>
              <td>{d.photos}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

type Uploader = { id: string; name: string; avatarUrl: string | null; photos: number; videos: number };

/** Thanh ngang: ai upload nhiều nhất. Tổng ở đầu thanh; tooltip tách ảnh / video. */
export function TopUploaders({ data }: { data: Uploader[] }) {
  const [active, setActive] = useState<string | null>(null);
  const max = Math.max(1, ...data.map((d) => d.photos + d.videos));

  if (data.length === 0) return <p className="text-sm text-ink-soft">Nobody has uploaded anything yet.</p>;

  return (
    <ol className="flex flex-col gap-3">
      {data.map((d) => {
        const total = d.photos + d.videos;
        const show = active === d.id;
        return (
          <li
            key={d.id}
            tabIndex={0}
            className="relative grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 rounded-md outline-offset-2 sm:grid-cols-[minmax(0,11rem)_1fr]"
            onPointerEnter={() => setActive(d.id)}
            onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
            onFocus={() => setActive(d.id)}
            onBlur={() => setActive(null)}
            aria-label={`${d.name}: ${plural(d.photos, "photo")}, ${plural(d.videos, "video")}`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <Avatar name={d.name} url={d.avatarUrl} size={26} />
              <span className="truncate text-sm font-semibold">{d.name}</span>
            </span>
            <span className="relative flex items-center gap-2">
              <span
                className="h-2.5 rounded-r-[4px] bg-chart transition-[filter] duration-100"
                style={{ width: `${Math.max(1.5, (total / max) * 82)}%`, filter: show ? "brightness(1.15)" : undefined }}
              />
              <span className="text-sm font-semibold tabular-nums">{total}</span>
              {show && (
                <Tooltip
                  value={plural(d.photos, "photo")}
                  label={d.videos ? `and ${plural(d.videos, "video")}` : "no videos yet"}
                />
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Tooltip: con số đậm trước, nhãn nhạt sau. */
function Tooltip({ value, label }: { value: string; label: string }) {
  return (
    <span
      role="status"
      className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-left whitespace-nowrap shadow-hard"
    >
      <span className="block text-sm font-semibold">{value}</span>
      <span className="block text-xs text-ink-soft">{label}</span>
    </span>
  );
}
