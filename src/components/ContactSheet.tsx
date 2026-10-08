"use client";

import { formatDayHeading, plural } from "@/lib/format";
import type { Photo } from "@/lib/types";
import { IconPlay, IconReset } from "./Icons";
import { SocialBadge } from "./PhotoSocial";
import { SmartImage } from "./SmartImage";

/** Một dải phim trên tờ contact sheet 35mm có 6 khung. */
const FRAMES_PER_STRIP = 6;

type Props = {
  /** Ảnh theo từng ngày (đã lọc), theo thứ tự thời gian */
  days: Array<[string, Photo[]]>;
  /** Số khung của mỗi ảnh trong cả cuộn (album), bắt đầu từ 1 — giữ nguyên khi lọc */
  frameNo: (id: string) => number;
  onOpen: (photo: Photo) => void;
  onOpenComments?: (photo: Photo) => void;
  onRetry?: (photo: Photo) => void;
};

/**
 * Chế độ xem "Contact sheet": mỗi ngày là một chồng dải phim 6 khung, số khung màu hổ phách ở mép
 * như chữ in trên phim. Khung cắt 3:2 như phim 35mm; bấm vào để xem cả ảnh.
 */
export function ContactSheet({ days, frameNo, onOpen, onOpenComments, onRetry }: Props) {
  return (
    <div className="flex flex-col gap-10">
      {days.map(([key, list], i) => (
        <section key={key} aria-label={`Day ${i + 1}`}>
          <h3 className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="frame-no text-sm">Day {i + 1}</span>
            <span className="font-display text-xl font-bold tracking-tight">{formatDayHeading(list[0].takenAt)}</span>
            <span className="text-sm text-ink-soft">{plural(list.length, "frame")}</span>
          </h3>
          <div className="flex flex-col gap-2">
            {chunk(list, FRAMES_PER_STRIP).map((strip) => (
              <Strip key={strip[0].id} frames={strip} frameNo={frameNo} onOpen={onOpen} onOpenComments={onOpenComments} onRetry={onRetry} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Strip({
  frames,
  frameNo,
  onOpen,
  onOpenComments,
  onRetry,
}: {
  frames: Photo[];
  frameNo: (id: string) => number;
  onOpen: (photo: Photo) => void;
  onOpenComments?: (photo: Photo) => void;
  onRetry?: (photo: Photo) => void;
}) {
  return (
    <div className="overflow-hidden rounded-[3px] bg-film text-white">
      <div className="sprockets h-3" aria-hidden="true" />
      <ol
        className="scrollbar-none flex snap-x snap-mandatory scroll-px-3 gap-2 overflow-x-auto px-3 py-1 md:grid md:overflow-visible"
        style={{ gridTemplateColumns: `repeat(${FRAMES_PER_STRIP}, minmax(0, 1fr))` }}
      >
        {frames.map((p) => (
          <Frame key={p.id} photo={p} n={frameNo(p.id)} onOpen={onOpen} onOpenComments={onOpenComments} onRetry={onRetry} />
        ))}
      </ol>
      <div className="sprockets h-3" aria-hidden="true" />
    </div>
  );
}

function Frame({
  photo,
  n,
  onOpen,
  onOpenComments,
  onRetry,
}: {
  photo: Photo;
  n: number;
  onOpen: (photo: Photo) => void;
  onOpenComments?: (photo: Photo) => void;
  onRetry?: (photo: Photo) => void;
}) {
  const video = photo.kind === "video";
  const pending = video && photo.status !== "ready";
  const failed = video && photo.status === "failed";

  return (
    <li className="relative w-[44vw] shrink-0 snap-start sm:w-[28vw] md:w-auto">
      <span className="frame-no flex justify-between px-0.5 pb-1 text-[0.68rem]" aria-hidden="true">
        <span>{n}</span>
        <span>&#9656; {n}A</span>
      </span>
      <button
        type="button"
        onClick={() => onOpen(photo)}
        aria-label={`${video ? "Play video" : "View photo"} ${n} by ${photo.uploadedBy}`}
        className="group relative block aspect-[3/2] w-full overflow-hidden rounded-[2px] bg-white/5"
      >
        {!pending && photo.thumbUrl && (
          <SmartImage
            src={photo.thumbUrl}
            alt=""
            fill
            sizes="(max-width: 768px) 44vw, 220px"
            className="object-cover transition-[filter] duration-150 group-hover:brightness-110"
          />
        )}
        {pending && !failed && (
          <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-[#6cc79c]" />
          </span>
        )}
        {failed && (
          <span className="absolute inset-0 flex items-center justify-center px-2 text-center text-xs font-semibold text-[#f0907c]">
            Couldn’t process
          </span>
        )}
        {video && !pending && (
          <span className="absolute bottom-1.5 left-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60" aria-hidden="true">
            <IconPlay size={14} />
          </span>
        )}
      </button>
      <SocialBadge
        commentCount={photo.commentCount}
        reactionCount={photo.reactionCount}
        onClick={() => (onOpenComments ?? onOpen)(photo)}
        className="absolute top-[1.6rem] right-1.5"
      />
      {failed && onRetry && (
        <button
          type="button"
          onClick={() => onRetry(photo)}
          className="mt-1 flex w-full items-center justify-center gap-1 text-xs font-semibold text-white/80 underline hover:text-white"
        >
          <IconReset size={12} /> Try again
        </button>
      )}
    </li>
  );
}

function chunk<T>(list: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
