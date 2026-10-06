"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useFavorites } from "@/lib/favorites";
import { dayKey, formatDayHeading, plural } from "@/lib/format";
import type { Photo } from "@/lib/types";
import { EmptyState } from "./EmptyState";
import { IconGrid, IconHeart, IconImage, IconTimeline } from "./Icons";
import { Lightbox } from "./Lightbox";
import { PhotoGrid } from "./PhotoGrid";

type View = "grid" | "days";
const ALL = "all";

type Props = { photos: Photo[]; initialPhotoId?: string };

/** Phần thân trang album: thanh lọc, lưới / dòng thời gian, lightbox. */
export function AlbumView({ photos, initialPhotoId }: Props) {
  const favorites = useFavorites();
  const [person, setPerson] = useState(ALL);
  const [favOnly, setFavOnly] = useState(false);
  const [view, setView] = useState<View>("grid");
  const deepLinked = initialPhotoId && photos.some((p) => p.id === initialPhotoId) ? initialPhotoId : null;
  const [openId, setOpenId] = useState<string | null>(deepLinked);
  // Danh sách lightbox duyệt qua, chốt lại lúc mở (bỏ tim khi đang lọc "Yêu thích" không làm lightbox đóng)
  const [lightboxList, setLightboxList] = useState<Photo[]>(deepLinked ? photos : []);

  const people = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of photos) counts.set(p.uploadedBy, (counts.get(p.uploadedBy) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [photos]);

  const visible = useMemo(
    () =>
      photos.filter(
        (p) => (person === ALL || p.uploadedBy === person) && (!favOnly || favorites.ids.has(p.id)),
      ),
    [photos, person, favOnly, favorites.ids],
  );

  const days = useMemo(() => {
    const groups = new Map<string, Photo[]>();
    for (const p of visible) {
      const k = dayKey(p.takenAt);
      groups.set(k, [...(groups.get(k) ?? []), p]);
    }
    return [...groups.entries()];
  }, [visible]);

  const openIndex = openId ? lightboxList.findIndex((p) => p.id === openId) : -1;

  // Đồng bộ ?photo=… để copy link là mở đúng tấm ảnh
  useEffect(() => {
    const url = new URL(window.location.href);
    if (openId) url.searchParams.set("photo", openId);
    else url.searchParams.delete("photo");
    window.history.replaceState(null, "", url.pathname + url.search);
  }, [openId]);

  const tileProps = {
    onOpen: (p: Photo) => {
      setLightboxList(visible);
      setOpenId(p.id);
    },
    isFavorite: favorites.has,
    onToggleFavorite: favorites.toggle,
  };

  if (photos.length === 0) {
    return (
      <EmptyState icon={<IconImage size={26} />} title="This album is empty">
        No photos from this trip yet. Hit “Upload photos” to add the first ones.
      </EmptyState>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 border-y-2 border-dashed border-line py-3 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="eyebrow shrink-0">Taken by</span>
          <div className="scrollbar-none -my-1 flex min-w-0 gap-1.5 overflow-x-auto py-1 pr-1">
            <button type="button" className="chip" aria-pressed={person === ALL} onClick={() => setPerson(ALL)}>
              All · {photos.length}
            </button>
            {people.map(([name, count]) => (
              <button key={name} type="button" className="chip" aria-pressed={person === name} onClick={() => setPerson(name)}>
                {name} · {count}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 lg:ml-auto">
          <button
            type="button"
            className="chip"
            aria-pressed={favOnly}
            onClick={() => setFavOnly((v) => !v)}
            title="Only show hearted photos (saved on this device)"
          >
            <IconHeart size={14} filled={favOnly} />
            Favorites · {photos.filter((p) => favorites.ids.has(p.id)).length}
          </button>
          <div className="ml-auto flex rounded-full border-2 border-line bg-surface p-0.5 lg:ml-0" role="group" aria-label="View mode">
            <ViewButton active={view === "grid"} onClick={() => setView("grid")} label="Grid">
              <IconGrid size={16} />
            </ViewButton>
            <ViewButton active={view === "days"} onClick={() => setView("days")} label="By day">
              <IconTimeline size={16} />
            </ViewButton>
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<IconHeart size={26} />}
          title={favOnly ? "No favorites yet" : "No matching photos"}
          action={
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setPerson(ALL);
                setFavOnly(false);
              }}
            >
              Show all photos
            </button>
          }
        >
          {favOnly
            ? "Tap the heart on a photo (or press F while viewing) to collect your favorites here."
            : "This person has no photos in the current filter."}
        </EmptyState>
      ) : view === "grid" ? (
        <PhotoGrid photos={visible} eagerCount={4} {...tileProps} />
      ) : (
        <div className="flex flex-col gap-10">
          {days.map(([key, list], i) => (
            <section key={key}>
              <h3 className="mb-4 flex items-baseline gap-3">
                <span className="rounded-md border-2 border-line bg-butter px-2 py-0.5 font-mono text-xs font-bold text-on-accent">
                  DAY {i + 1}
                </span>
                <span className="font-display text-xl font-bold tracking-tight">{formatDayHeading(list[0].takenAt)}</span>
                <span className="font-mono text-xs text-ink-soft">{plural(list.length, "photo")}</span>
              </h3>
              <PhotoGrid photos={list} eagerCount={i === 0 ? 4 : 0} {...tileProps} />
            </section>
          ))}
        </div>
      )}

      {openIndex >= 0 && (
        <Lightbox
          photos={lightboxList}
          index={openIndex}
          onIndexChange={(i) => setOpenId(lightboxList[i].id)}
          onClose={() => setOpenId(null)}
          isFavorite={favorites.has}
          onToggleFavorite={favorites.toggle}
        />
      )}
    </>
  );
}

function ViewButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors ${
        active ? "bg-ink text-bg" : "text-ink-soft hover:text-ink"
      }`}
    >
      {children}
      <span className="max-sm:sr-only">{label}</span>
    </button>
  );
}
