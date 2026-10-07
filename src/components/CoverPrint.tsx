import { ViewTransition } from "react";
import type { Album } from "@/lib/types";
import { UnexposedCover } from "./BlankRoll";
import { SmartImage } from "./SmartImage";

/** Tên chung để ảnh bìa "bay" từ thẻ album sang trang album khi chuyển trang. */
export const coverTransitionName = (albumId: string) => `cover-${albumId}`;

/**
 * Ảnh bìa đã in: viền giấy trắng, đổ bóng trên bàn soi. `morph` nối ảnh này với cùng ảnh bìa
 * ở trang khác (thẻ album ↔ đầu trang album). Album chưa có ảnh → tấm in chưa tráng.
 */
export function CoverPrint({
  album,
  sizes,
  preload = false,
  morph = true,
  className = "",
}: {
  album: Pick<Album, "id" | "title" | "coverUrl">;
  sizes: string;
  preload?: boolean;
  morph?: boolean;
  className?: string;
}) {
  const image = (
    <span className="relative block aspect-[3/2] overflow-hidden rounded-[1px] bg-surface-2">
      {album.coverUrl ? (
        <SmartImage src={album.coverUrl} alt={`Cover of ${album.title}`} fill preload={preload} sizes={sizes} className="object-cover" />
      ) : (
        <UnexposedCover />
      )}
    </span>
  );

  // Cả tấm in (gồm viền giấy) cùng bay, không để viền trắng hiện trước khi ảnh tới
  const print = <span className={`print block ${className}`}>{image}</span>;
  if (!morph) return print;
  return (
    <ViewTransition name={coverTransitionName(album.id)} share="morph" default="none">
      {print}
    </ViewTransition>
  );
}
