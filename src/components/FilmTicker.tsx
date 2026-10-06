import type { Album } from "@/lib/types";
import { plural, yearOf } from "@/lib/format";

/** Dải phim chạy ngang liệt kê các chuyến đi. Rê chuột vào để dừng. */
export function FilmTicker({ albums }: { albums: Album[] }) {
  const items = albums.map((a) => `${a.location} ${yearOf(a.tripDate)} · ${plural(a.photoCount, "photo")}`);

  return (
    <div className="group relative overflow-hidden border-b-2 border-line bg-ink text-bg" aria-label="Trips">
      <div className="sprockets h-2" aria-hidden="true" />
      <div className="flex w-max animate-[marquee_40s_linear_infinite] group-hover:[animation-play-state:paused]">
        {/* Lặp 2 lần để vòng chạy liền mạch */}
        {[0, 1].map((copy) => (
          <ul key={copy} aria-hidden={copy === 1} className="flex shrink-0 items-center">
            {items.map((text, i) => (
              <li key={i} className="flex items-center gap-4 px-4 py-1.5 font-mono text-xs font-bold tracking-[0.12em] uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
        ))}
      </div>
      <div className="sprockets h-2" aria-hidden="true" />
    </div>
  );
}
