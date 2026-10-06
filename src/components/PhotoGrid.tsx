"use client";

import type { Photo } from "@/lib/types";
import { IconHeart } from "./Icons";
import { SmartImage } from "./SmartImage";

type Props = {
  photos: Photo[];
  onOpen: (photo: Photo) => void;
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
  /** Số ảnh đầu tải ngay (nằm trên màn hình đầu tiên), còn lại lazy */
  eagerCount?: number;
};

/** Lưới ảnh masonry (CSS columns). */
export function PhotoGrid({ photos, onOpen, isFavorite, onToggleFavorite, eagerCount = 0 }: Props) {
  return (
    <ul className="columns-2 gap-3 sm:gap-4 md:columns-3 xl:columns-4">
      {photos.map((photo, i) => {
        const fav = isFavorite(photo.id);
        return (
          <li key={photo.id} className="group relative mb-3 break-inside-avoid sm:mb-4">
            <button
              type="button"
              onClick={() => onOpen(photo)}
              aria-label={`Xem ảnh của ${photo.uploadedBy}`}
              className="relative block w-full overflow-hidden rounded-xl border-2 border-line bg-surface-2 shadow-hard-sm transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-hard"
              style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
            >
              <SmartImage
                src={photo.thumbUrl}
                alt={`Ảnh của ${photo.uploadedBy}`}
                fill
                loading={i < eagerCount ? "eager" : "lazy"}
                sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
                className="object-cover"
              />
              <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2.5 pt-6 pb-2 text-left text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                {photo.uploadedBy}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onToggleFavorite(photo.id)}
              aria-pressed={fav}
              aria-label={fav ? "Bỏ yêu thích" : "Yêu thích"}
              className={`absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${
                fav
                  ? "border-line bg-accent text-on-accent opacity-100"
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
