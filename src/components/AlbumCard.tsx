import Link from "next/link";
import { formatDateRange, plural } from "@/lib/format";
import type { Album } from "@/lib/types";
import { CoverPrint } from "./CoverPrint";
import { IconPin } from "./Icons";

type Props = { album: Album; index: number; preload?: boolean };

/** Album là một tấm ảnh in nằm trên bàn soi; tên chuyến và thông tin viết bên dưới như ghi chú. */
export function AlbumCard({ album, preload = false }: Props) {
  return (
    <Link href={`/albums/${album.id}`} prefetch className="group flex flex-col gap-3 rounded-md focus-visible:outline-offset-4">
      <CoverPrint
        album={album}
        preload={preload}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        className="transition-transform duration-200 group-hover:-translate-y-1"
      />

      <div className="flex flex-col gap-1 px-0.5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl leading-tight font-bold tracking-[-0.015em] group-hover:text-accent">{album.title}</h2>
          <span className="shrink-0 text-sm text-ink-soft tabular-nums">{plural(album.photoCount, "photo")}</span>
        </div>
        <p className="flex items-center gap-1 text-sm text-ink-soft">
          <IconPin size={15} className="shrink-0" />
          <span className="font-medium text-ink">{album.location}</span>
          <span className="ml-auto tabular-nums">{formatDateRange(album.tripDate, album.endDate)}</span>
        </p>
        {album.description && <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-soft">{album.description}</p>}
      </div>
    </Link>
  );
}
