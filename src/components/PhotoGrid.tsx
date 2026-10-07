"use client";

import { formatDuration } from "@/lib/format";
import type { Photo } from "@/lib/types";
import { IconHeart, IconPlay, IconReset } from "./Icons";
import { SmartImage } from "./SmartImage";

type Props = {
  photos: Photo[];
  onOpen: (photo: Photo) => void;
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
  /** Có thì video lỗi chuyển mã hiện nút "Try again" */
  onRetry?: (photo: Photo) => void;
  /** Số ảnh đầu tải ngay (nằm trên màn hình đầu tiên), còn lại lazy */
  eagerCount?: number;
};

/** Lưới ảnh masonry (CSS columns). Video hiện poster + thời lượng; đang chuyển mã thì hiện trạng thái. */
export function PhotoGrid({ photos, onOpen, isFavorite, onToggleFavorite, onRetry, eagerCount = 0 }: Props) {
  return (
    <ul className="columns-2 gap-3 sm:gap-4 md:columns-3 xl:columns-4">
      {photos.map((photo, i) => {
        const fav = isFavorite(photo.id);
        const video = photo.kind === "video";
        const pending = video && photo.status !== "ready";
        return (
          <li key={photo.id} className="group relative mb-3 break-inside-avoid sm:mb-4">
            <button
              type="button"
              onClick={() => onOpen(photo)}
              aria-label={`${video ? "Play video" : "View photo"} by ${photo.uploadedBy}`}
              className={`relative block w-full overflow-hidden rounded-[3px] transition-[filter] duration-150 hover:brightness-[1.06] ${
                pending ? "bg-film" : "bg-surface-2"
              }`}
              style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
            >
              {!pending && (
                <SmartImage
                  src={photo.thumbUrl}
                  alt={`${video ? "Video" : "Photo"} by ${photo.uploadedBy}`}
                  fill
                  loading={i < eagerCount ? "eager" : "lazy"}
                  sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
                  className="object-cover"
                />
              )}
              {pending && <ProcessingState photo={photo} />}
              {video && !pending && (
                <span className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/60 py-0.5 pr-2 pl-1 text-xs font-semibold text-white tabular-nums backdrop-blur-sm">
                  <IconPlay size={14} />
                  {photo.durationMs ? formatDuration(photo.durationMs) : "Video"}
                </span>
              )}
              <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2.5 pt-6 pb-2 text-right text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                {photo.uploadedBy}
              </span>
            </button>
            {video && photo.status === "failed" && onRetry && (
              <button
                type="button"
                onClick={() => onRetry(photo)}
                className="btn absolute bottom-2 left-1/2 h-8 -translate-x-1/2 px-3 text-xs"
              >
                <IconReset size={14} />
                Try again
              </button>
            )}
            <button
              type="button"
              onClick={() => onToggleFavorite(photo.id)}
              aria-pressed={fav}
              aria-label={fav ? "Remove favorite" : "Favorite"}
              className={`absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full border transition-all ${
                fav
                  ? "border-transparent bg-accent text-on-accent opacity-100"
                  : "border-transparent bg-black/45 text-white backdrop-blur-sm sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
              }`}
            >
              <IconHeart size={15} filled={fav} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Ô video chưa xem được: đang chờ / đang chuyển mã / lỗi. */
function ProcessingState({ photo }: { photo: Photo }) {
  const failed = photo.status === "failed";
  return (
    <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center text-white">
      {failed ? (
        <span className="text-sm font-semibold text-[#f0907c]">Couldn’t process this video</span>
      ) : (
        <>
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-[#6cc79c]" aria-hidden="true" />
          <span className="text-sm font-semibold">{photo.status === "processing" ? "Processing video…" : "Waiting to process…"}</span>
          <span className="text-xs text-white/60">Usually ready in a few minutes</span>
        </>
      )}
    </span>
  );
}
