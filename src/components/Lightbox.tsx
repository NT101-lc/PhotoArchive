"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode, type TouchEvent } from "react";
import { formatDateTime, formatDuration, pad2 } from "@/lib/format";
import type { Photo } from "@/lib/types";
import { useVideoQuality, type Quality } from "@/lib/video-quality";
import {
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconDownload,
  IconExternal,
  IconHeart,
  IconInfo,
  IconLink,
  IconPause,
  IconPlay,
  IconStar,
  IconTrash,
  IconZoomIn,
  IconZoomOut,
} from "./Icons";
import { useBodyScrollLock } from "./Modal";
import { useToast } from "./Toast";

type Props = {
  photos: Photo[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
  /** Có thì hiện nút "Set as cover" cho ảnh này (người dùng có quyền đổi bìa) */
  cover?: { isCover: (id: string) => boolean; onSet: (photo: Photo) => void };
  /** Có thì hiện nút xoá cho những ảnh `canDelete` trả về true */
  remove?: { canDelete: (photo: Photo) => boolean; onDelete: (photo: Photo) => void };
  /** Tắt phím tắt khi có hộp thoại khác mở phía trên (vd xác nhận xoá) */
  paused?: boolean;
};

const SWIPE_MIN_PX = 50;
const SLIDESHOW_MS = 3500;
const DOUBLE_TAP_MS = 280;

/**
 * Xem ảnh gốc / phát video. Phím: ← → chuyển ảnh · Space slideshow (video: phát / dừng) · Z phóng to · F yêu thích · I thông tin · Esc đóng.
 * Mobile: vuốt trái/phải để chuyển, vuốt xuống để đóng, chạm 2 lần để phóng to.
 * Luôn dùng tông tối (phòng tối) bất kể theme.
 */
export function Lightbox({
  photos,
  index,
  onIndexChange,
  onClose,
  isFavorite,
  onToggleFavorite,
  cover,
  remove,
  paused = false,
}: Props) {
  const toast = useToast();
  const [showInfo, setShowInfo] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const lastTap = useRef(0);
  const stripRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const photo = photos[index];
  const total = photos.length;
  const fav = photo ? isFavorite(photo.id) : false;
  const isVideo = photo?.kind === "video";
  const playable = isVideo && photo.status === "ready" && !!photo.sources;
  const quality = useVideoQuality();

  useBodyScrollLock(true);

  const go = useCallback(
    (delta: number) => {
      setZoomed(false);
      onIndexChange((index + delta + total) % total);
    },
    [index, total, onIndexChange],
  );

  // Slideshow: tự chuyển ảnh; dừng khi đang phóng to
  useEffect(() => {
    if (!playing || zoomed || paused || total < 2 || playable) return;
    const t = setTimeout(() => go(1), SLIDESHOW_MS);
    return () => clearTimeout(t);
  }, [playing, zoomed, paused, go, total, index, playable]);

  useEffect(() => {
    if (paused) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (zoomed) setZoomed(false);
        else onClose();
      } else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === " ") {
        e.preventDefault();
        const v = videoRef.current;
        if (v) {
          if (v.paused) void v.play();
          else v.pause();
        } else setPlaying((p) => !p);
      } else if (e.key === "i" || e.key === "I") setShowInfo((v) => !v);
      else if ((e.key === "z" || e.key === "Z") && !isVideo) setZoomed((v) => !v);
      else if ((e.key === "f" || e.key === "F") && photo) onToggleFavorite(photo.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose, zoomed, photo, onToggleFavorite, paused, isVideo]);

  // Tải trước ảnh kế bên để chuyển ảnh mượt hơn
  useEffect(() => {
    for (const d of [1, -1]) {
      const p = photos[(index + d + total) % total];
      const src = p?.kind === "video" ? p.thumbUrl : p?.url;
      if (src) new window.Image().src = src;
    }
  }, [index, photos, total]);

  // Giữ ô đang xem ở giữa dải phim
  useEffect(() => {
    stripRef.current
      ?.querySelector<HTMLElement>(`[data-index="${index}"]`)
      ?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [index]);

  function onTouchStart(e: TouchEvent) {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }

  function onTouchEnd(e: TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;

    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      // Chạm 2 lần liên tiếp → phóng to / thu nhỏ
      const now = Date.now();
      if (now - lastTap.current < DOUBLE_TAP_MS && !isVideo) {
        e.preventDefault(); // chặn dblclick giả lập để không bị bật/tắt 2 lần
        setZoomed((v) => !v);
        lastTap.current = 0;
      } else lastTap.current = now;
      return;
    }
    if (zoomed) return; // đang phóng to thì vuốt = kéo xem ảnh
    if (Math.abs(dx) > SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
    else if (dy > SWIPE_MIN_PX * 2 && Math.abs(dy) > Math.abs(dx)) onClose();
  }

  async function download() {
    if (!photo) return;
    // Video có thể rất lớn: để trình duyệt tự tải qua link ký sẵn thay vì nạp vào bộ nhớ
    if (isVideo) {
      const a = document.createElement("a");
      a.href = `/api/photos/${encodeURIComponent(photo.id)}/raw?download=1`;
      a.click();
      return;
    }
    try {
      const res = await fetch(photo.url);
      if (!res.ok) throw new Error(String(res.status));
      const blobUrl = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = blobUrl;
      // Giữ đúng đuôi file gốc (key trên R2 có dạng .../uuid.png); ảnh seed không có đuôi → jpg
      const ext = new URL(photo.url, location.href).pathname.match(/\.(\w{3,4})$/)?.[1] ?? "jpg";
      a.download = `${photo.id}.${ext}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      // Storage không cho CORS → mở tab mới để người dùng tự lưu
      window.open(photo.url, "_blank", "noopener");
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.show({ tone: "success", title: "Photo link copied", message: "Opening it jumps straight to this photo." });
    } catch {
      toast.show({ tone: "warn", title: "Couldn't copy", message: "The browser blocked clipboard access." });
    }
  }

  if (!photo) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${isVideo ? "Video" : "Photo"} ${index + 1} of ${total}`}
      className="animate-fade fixed inset-0 z-[1100] flex flex-col bg-[#0b0e0d] text-[#e4e9e5]"
    >
      {/* Thanh tiến trình slideshow */}
      {playing && !zoomed && (
        <div className="absolute inset-x-0 top-0 z-10 h-[3px] bg-white/10">
          <div key={index} className="h-full origin-left bg-[#6cc79c]" style={{ animation: `lb-progress ${SLIDESHOW_MS}ms linear forwards` }} />
        </div>
      )}

      {/* Thanh trên */}
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2.5 sm:px-5">
        <span className="rounded-full border border-white/20 px-3 py-1 font-mono text-xs tabular-nums">
          {pad2(index + 1)} <span className="opacity-50">/ {pad2(total)}</span>
        </span>
        <div className="flex items-center gap-1 sm:gap-1.5">
          <LbButton onClick={() => onToggleFavorite(photo.id)} label={fav ? "Remove favorite (F)" : "Favorite (F)"} active={fav} accent>
            <IconHeart size={18} filled={fav} />
          </LbButton>
          <LbButton onClick={() => setPlaying((v) => !v)} label={playing ? "Pause slideshow (Space)" : "Slideshow (Space)"} active={playing}>
            {playing ? <IconPause size={18} /> : <IconPlay size={16} />}
          </LbButton>
          {isVideo ? (
            playable &&
            photo.sources?.["720"] &&
            photo.sources["1080"] && (
              <button
                type="button"
                onClick={() => quality.set(quality.value === "1080" ? "720" : "1080")}
                title="Switch video quality"
                className="h-9 rounded-full border border-white/20 px-3 text-xs font-semibold tabular-nums hover:bg-white/10 sm:h-10"
              >
                {quality.value}p
              </button>
            )
          ) : (
            <LbButton onClick={() => setZoomed((v) => !v)} label={zoomed ? "Zoom out (Z)" : "Zoom in (Z)"} active={zoomed} className="max-sm:hidden">
              {zoomed ? <IconZoomOut size={18} /> : <IconZoomIn size={18} />}
            </LbButton>
          )}
          <LbButton onClick={download} label={isVideo ? "Download video" : "Download original"} className="max-sm:hidden">
            <IconDownload size={18} />
          </LbButton>
          <LbButton onClick={copyLink} label="Copy photo link" className="max-sm:hidden">
            <IconLink size={18} />
          </LbButton>
          {cover && (!isVideo || playable) && (
            <LbButton
              onClick={() => cover.onSet(photo)}
              label={cover.isCover(photo.id) ? "This is the album cover" : "Set as album cover"}
              active={cover.isCover(photo.id)}
            >
              <IconStar size={18} filled={cover.isCover(photo.id)} />
            </LbButton>
          )}
          {remove?.canDelete(photo) && (
            <LbButton onClick={() => remove.onDelete(photo)} label={isVideo ? "Delete video" : "Delete photo"}>
              <IconTrash size={18} />
            </LbButton>
          )}
          <LbButton onClick={() => setShowInfo((v) => !v)} label="Info (I)" active={showInfo}>
            <IconInfo size={18} />
          </LbButton>
          <span className="mx-0.5 h-6 w-px bg-white/15" aria-hidden="true" />
          <LbButton onClick={onClose} label="Close (Esc)">
            <IconClose size={18} />
          </LbButton>
        </div>
      </div>

      {/* Ảnh */}
      <div
        className="relative min-h-0 flex-1 touch-pan-y select-none"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {isVideo ? (
          <VideoStage
            key={photo.id}
            photo={photo}
            quality={quality.value}
            videoRef={videoRef}
            onEnded={() => {
              if (playing && total > 1) go(1);
            }}
          />
        ) : zoomed ? (
          <ZoomedImage key={photo.id} photo={photo} onExit={() => setZoomed(false)} />
        ) : (
          <FittedImage key={photo.id} photo={photo} onDoubleClick={() => setZoomed(true)} />
        )}

        {total > 1 && !zoomed && (
          <>
            <NavButton side="left" onClick={() => go(-1)} />
            <NavButton side="right" onClick={() => go(1)} />
          </>
        )}

        {showInfo && <InfoPanel photo={photo} onClose={() => setShowInfo(false)} onDownload={download} onCopyLink={copyLink} />}
      </div>

      {/* Dải phim */}
      <div className="shrink-0 border-t border-white/10 bg-black/40">
        <div className="flex items-center justify-between gap-3 px-3 pt-2 font-mono text-[0.7rem] sm:px-5">
          <span className="truncate">
            <span className="text-[#6cc79c]">{photo.uploadedBy}</span>
            <span className="opacity-60"> · {formatDateTime(photo.takenAt)}</span>
          </span>
          <span className="hidden opacity-40 md:inline">← → navigate · Space slideshow · Z zoom · F favorite · Esc close</span>
        </div>
        <div ref={stripRef} className="scrollbar-none flex gap-1.5 overflow-x-auto px-3 py-2.5 sm:px-5">
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              data-index={i}
              onClick={() => {
                setZoomed(false);
                onIndexChange(i);
              }}
              aria-label={`${p.kind === "video" ? "Video" : "Photo"} ${i + 1}`}
              aria-current={i === index}
              className={`relative h-12 shrink-0 overflow-hidden rounded-md border transition-all sm:h-14 ${
                i === index ? "border-[#6cc79c] opacity-100" : "border-transparent opacity-45 hover:opacity-80"
              }`}
              style={{ aspectRatio: `${p.width} / ${p.height}` }}
            >
              {p.thumbUrl ? (
                <Image src={p.thumbUrl} alt="" fill sizes="96px" className="object-cover" />
              ) : (
                <span className="absolute inset-0 bg-white/10" />
              )}
              {p.kind === "video" && (
                <span className="absolute inset-0 flex items-center justify-center text-white drop-shadow" aria-hidden="true">
                  <IconPlay size={16} />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <style>{`@keyframes lb-progress { from { transform: scaleX(0) } to { transform: scaleX(1) } }`}</style>
    </div>
  );
}

function Spinner() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-white/15 border-t-[#6cc79c]" />
    </div>
  );
}

/**
 * Video: phát bản đã chuyển mã theo chất lượng đang chọn (giữ nguyên vị trí khi đổi 720p ↔ 1080p).
 * Chưa chuyển mã xong thì hiện trạng thái.
 */
function VideoStage({
  photo,
  quality,
  videoRef,
  onEnded,
}: {
  photo: Photo;
  quality: Quality;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onEnded: () => void;
}) {
  const resumeAt = useRef(0);
  const sources = photo.status === "ready" ? photo.sources : null;
  const src = sources ? (sources[quality] ?? sources["720"] ?? sources["1080"]) : undefined;

  if (!src) {
    const failed = photo.status === "failed";
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
        {failed ? (
          <>
            <p className="font-display text-xl font-bold">This video couldn’t be processed</p>
            <p className="max-w-sm text-sm text-white/60">
              {photo.processingError ?? "Something went wrong while converting it."} Use “Try again” on the album page, or download
              the original.
            </p>
          </>
        ) : (
          <>
            <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-white/15 border-t-[#6cc79c]" aria-hidden="true" />
            <p className="font-display text-xl font-bold">{photo.status === "processing" ? "Processing video…" : "Waiting to process…"}</p>
            <p className="max-w-sm text-sm text-white/60">It’s being converted so it plays on every device. This page updates by itself.</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="absolute inset-2 sm:inset-x-20 sm:inset-y-2">
      <video
        ref={videoRef}
        src={src}
        poster={photo.thumbUrl || undefined}
        controls
        autoPlay
        playsInline
        preload="metadata"
        // Lúc đổi nguồn, trình duyệt báo currentTime = 0 trước khi có dữ liệu → bỏ qua để còn nhảy về chỗ cũ
        onTimeUpdate={(e) => {
          if (e.currentTarget.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) resumeAt.current = e.currentTarget.currentTime;
        }}
        onLoadedMetadata={(e) => {
          if (resumeAt.current > 0) e.currentTarget.currentTime = resumeAt.current;
        }}
        onEnded={onEnded}
        className="h-full w-full object-contain"
      />
    </div>
  );
}

function FittedImage({ photo, onDoubleClick }: { photo: Photo; onDoubleClick: () => void }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="absolute inset-2 sm:inset-x-20 sm:inset-y-2" onDoubleClick={onDoubleClick}>
      {!loaded && <Spinner />}
      {/* unoptimized: hiển thị đúng ảnh gốc, không qua bộ resize của Next */}
      <Image
        src={photo.url}
        alt={`Photo by ${photo.uploadedBy}`}
        fill
        unoptimized
        sizes="100vw"
        loading="eager"
        draggable={false}
        onLoad={() => setLoaded(true)}
        className={`cursor-zoom-in object-contain transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}

/** Ảnh ở kích thước thật trong khung cuộn được — kéo / cuộn để xem chi tiết. */
function ZoomedImage({ photo, onExit }: { photo: Photo; onExit: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null);

  // Mở ra ở giữa ảnh
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    box.scrollLeft = (box.scrollWidth - box.clientWidth) / 2;
    box.scrollTop = (box.scrollHeight - box.clientHeight) / 2;
  }, []);

  function onDoubleClick(e: MouseEvent) {
    e.stopPropagation();
    onExit();
  }

  return (
    <div ref={boxRef} className="absolute inset-0 overflow-auto overscroll-contain" onDoubleClick={onDoubleClick}>
      <div className="flex min-h-full min-w-full items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- cần kích thước thật để cuộn, đã được tải sẵn ở chế độ thường */}
        <img
          src={photo.url}
          alt={`Photo by ${photo.uploadedBy} (zoomed)`}
          width={photo.width}
          height={photo.height}
          draggable={false}
          className="max-w-none cursor-zoom-out"
        />
      </div>
    </div>
  );
}

function NavButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? IconChevronLeft : IconChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous photo (←)" : "Next photo (→)"}
      className={`absolute top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/5 backdrop-blur-sm transition-colors hover:bg-[#6cc79c] hover:text-[#0b1a14] sm:flex ${
        side === "left" ? "left-4" : "right-4"
      }`}
    >
      <Icon size={24} />
    </button>
  );
}

function LbButton({
  onClick,
  label,
  children,
  active = false,
  accent = false,
  className = "",
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
  active?: boolean;
  accent?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors sm:h-10 sm:w-10 ${
        active ? (accent ? "bg-[#6cc79c] text-[#0b1a14]" : "bg-[#e4e9e5] text-[#0b1a14]") : "hover:bg-white/10"
      } ${className}`}
    >
      {children}
    </button>
  );
}

/** Bảng chi tiết ảnh. */
function InfoPanel({
  photo,
  onClose,
  onDownload,
  onCopyLink,
}: {
  photo: Photo;
  onClose: () => void;
  onDownload: () => void;
  onCopyLink: () => void;
}) {
  const rows: Array<[string, string]> = [
    ["Taken by", photo.uploadedBy],
    ["Taken at", formatDateTime(photo.takenAt)],
    ["Size", `${photo.width} × ${photo.height}`],
    photo.kind === "video" && photo.durationMs
      ? ["Length", formatDuration(photo.durationMs)]
      : ["Orientation", photo.width >= photo.height ? "Landscape" : "Portrait"],
  ];

  return (
    <aside className="animate-rise absolute inset-x-2 bottom-2 z-10 rounded-2xl border border-white/15 bg-[#171c1b]/95 p-4 shadow-2xl backdrop-blur-md sm:inset-x-auto sm:top-2 sm:right-4 sm:bottom-auto sm:w-[300px]">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-[#97a29e]">{photo.kind === "video" ? "Video details" : "Photo details"}</span>
        <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-white/10" aria-label="Close details">
          <IconClose size={14} />
        </button>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[0.7rem] text-[#97a29e]">{k}</dt>
            <dd className="text-sm font-semibold">{v}</dd>
          </div>
        ))}
        <div className="col-span-2">
          <dt className="text-[0.7rem] text-[#97a29e]">ID</dt>
          <dd className="truncate font-mono text-xs">{photo.id}</dd>
        </div>
      </dl>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <PanelAction onClick={onDownload} icon={<IconDownload size={16} />} label="Download" />
        <PanelAction onClick={onCopyLink} icon={<IconLink size={16} />} label="Copy link" />
        <a
          href={photo.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-1 rounded-xl border border-white/15 py-2 text-xs font-semibold hover:bg-white/10"
        >
          <IconExternal size={16} /> {photo.kind === "video" ? "Open file" : "Original"}
        </a>
      </div>
    </aside>
  );
}

function PanelAction({ onClick, icon, label }: { onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-xl border border-white/15 py-2 text-xs font-semibold hover:bg-white/10"
    >
      {icon} {label}
    </button>
  );
}
