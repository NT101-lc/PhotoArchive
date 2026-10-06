import Link from "next/link";
import { formatDate, pad2, yearOf } from "@/lib/format";
import type { Album } from "@/lib/types";
import { IconImage, IconPin } from "./Icons";
import { SmartImage } from "./SmartImage";

// Màu tem năm, xoay vòng
const STAMPS = ["bg-butter", "bg-teal", "bg-lilac", "bg-sky", "bg-accent"];

type Props = { album: Album; index: number; preload?: boolean };

/** Card album trông như một tấm ảnh in có viền giấy. */
export function AlbumCard({ album, index, preload = false }: Props) {
  return (
    <Link
      href={`/albums/${album.id}`}
      className="group card flex flex-col p-2.5 transition-[transform,box-shadow] duration-150 hover:-translate-y-1 hover:rotate-[-0.6deg] hover:shadow-hard-lg active:translate-y-0 active:rotate-0 active:shadow-hard-sm"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-[9px] border-2 border-line bg-surface-2">
        <SmartImage
          src={album.coverUrl}
          alt={`Cover of ${album.title}`}
          fill
          preload={preload}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
        <span
          className={`absolute top-2.5 left-2.5 rotate-[-4deg] rounded-md border-2 border-line px-2 py-0.5 font-mono text-xs font-bold text-on-accent shadow-hard-sm ${
            STAMPS[index % STAMPS.length]
          }`}
        >
          {yearOf(album.tripDate)}
        </span>
        <span className="tag absolute right-2.5 bottom-2.5 border-transparent bg-black/65 text-white backdrop-blur-sm">
          <IconImage size={12} />
          {album.photoCount}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1 px-1.5 pt-3 pb-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-[1.35rem] leading-tight font-bold tracking-tight">{album.title}</h2>
          <span className="shrink-0 font-mono text-[0.68rem] text-ink-soft">№{pad2(index + 1)}</span>
        </div>
        <p className="flex items-center gap-1.5 text-sm text-ink-soft">
          <IconPin size={14} />
          <span className="font-semibold text-ink">{album.location}</span>
          <span aria-hidden="true">·</span>
          {formatDate(album.tripDate)}
        </p>
      </div>
    </Link>
  );
}
