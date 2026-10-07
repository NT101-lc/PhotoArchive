"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { deletePhoto, retryVideo, updateAlbum } from "@/lib/api-client";
import { useFavorites } from "@/lib/favorites";
import { dayKey, formatDayHeading, plural } from "@/lib/format";
import { canDeletePhoto, canSetCover } from "@/lib/permissions";
import type { Album, Photo } from "@/lib/types";
import { ConfirmDialog } from "./ConfirmDialog";
import { EmptyState } from "./EmptyState";
import { useIdentity } from "./Identity";
import { useToast } from "./Toast";
import { IconGrid, IconHeart, IconImage, IconTimeline } from "./Icons";
import { Lightbox } from "./Lightbox";
import { PhotoGrid } from "./PhotoGrid";

type View = "grid" | "days";
const ALL = "all";

type Props = {
  album: Pick<Album, "id" | "coverPhotoId" | "createdById">;
  photos: Photo[];
  initialPhotoId?: string;
};

/** Phần thân trang album: thanh lọc, lưới / dòng thời gian, lightbox, đặt bìa / xoá ảnh. */
export function AlbumView({ album, photos, initialPhotoId }: Props) {
  const favorites = useFavorites();
  const me = useIdentity();
  const router = useRouter();
  const toast = useToast();
  const [toDelete, setToDelete] = useState<Photo | null>(null);
  // Bìa hiện tại: ảnh đã chọn, nếu chưa chọn thì ảnh đầu tiên (photos đã xếp theo thời gian chụp)
  const coverId = album.coverPhotoId ?? photos[0]?.id;
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

  // Lightbox giữ danh sách lúc mở, nhưng luôn lấy bản mới nhất của từng ảnh (vd video vừa xử lý xong)
  const byId = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);
  const liveList = useMemo(() => lightboxList.map((p) => byId.get(p.id) ?? p), [lightboxList, byId]);
  const openIndex = openId ? liveList.findIndex((p) => p.id === openId) : -1;

  // Còn video đang chờ / đang chuyển mã → hỏi lại server mỗi 10 giây
  const processing = photos.some((p) => p.kind === "video" && (p.status === "queued" || p.status === "processing"));
  useEffect(() => {
    if (!processing) return;
    const t = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(t);
  }, [processing, router]);

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
    onRetry: me ? retry : undefined,
  };

  async function retry(photo: Photo) {
    try {
      await retryVideo(photo.id);
      toast.show({ tone: "success", title: "Video queued again", message: "It’ll be ready in a few minutes." });
      router.refresh();
    } catch (err) {
      toast.show({ tone: "warn", title: "Couldn’t retry", message: (err as Error).message });
    }
  }

  async function setCover(photo: Photo) {
    if (photo.id === coverId) return;
    try {
      await updateAlbum(album.id, { coverPhotoId: photo.id });
      toast.show({ tone: "success", title: "Album cover updated" });
      router.refresh();
    } catch (err) {
      toast.show({ tone: "warn", title: "Couldn’t change cover", message: (err as Error).message });
    }
  }

  async function confirmDelete() {
    const photo = toDelete;
    if (!photo) return;
    try {
      await deletePhoto(photo.id);
      // Bỏ khỏi danh sách lightbox; chuyển sang ảnh kế tiếp (hoặc đóng nếu hết ảnh)
      const i = lightboxList.findIndex((p) => p.id === photo.id);
      const rest = lightboxList.filter((p) => p.id !== photo.id);
      setLightboxList(rest);
      setOpenId(rest.length ? rest[Math.min(i, rest.length - 1)].id : null);
      toast.show({ tone: "success", title: "Photo deleted" });
      setToDelete(null);
      router.refresh();
    } catch (err) {
      toast.show({ tone: "warn", title: "Couldn’t delete photo", message: (err as Error).message });
    }
  }

  if (photos.length === 0) {
    return (
      <EmptyState icon={<IconImage size={26} />} title="This album is empty">
        No photos from this trip yet. Hit “Upload photos” to add the first ones.
      </EmptyState>
    );
  }

  return (
    <>
      <div className="-mt-4 mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="eyebrow shrink-0">Taken by</span>
          <div className="scrollbar-none -my-1 flex min-w-0 gap-1.5 overflow-x-auto py-1 pr-1">
            <button type="button" className="chip" aria-pressed={person === ALL} onClick={() => setPerson(ALL)}>
              All <span className="opacity-60 tabular-nums">{photos.length}</span>
            </button>
            {people.map(([name, count]) => (
              <button key={name} type="button" className="chip" aria-pressed={person === name} onClick={() => setPerson(name)}>
                {name} <span className="opacity-60 tabular-nums">{count}</span>
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
            Favorites <span className="opacity-60 tabular-nums">{photos.filter((p) => favorites.ids.has(p.id)).length}</span>
          </button>
          <div className="ml-auto flex rounded-full border border-line bg-surface p-0.5 lg:ml-0" role="group" aria-label="View mode">
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
                <span className="frame-no text-sm">
                  Day {i + 1}
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
          photos={liveList}
          index={openIndex}
          onIndexChange={(i) => setOpenId(liveList[i].id)}
          onClose={() => setOpenId(null)}
          isFavorite={favorites.has}
          onToggleFavorite={favorites.toggle}
          cover={canSetCover(me, album) ? { isCover: (id) => id === coverId, onSet: setCover } : undefined}
          remove={{ canDelete: (p) => canDeletePhoto(me, p), onDelete: setToDelete }}
          paused={!!toDelete}
        />
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete this photo?"
        confirmLabel="Delete photo"
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      >
        The photo{toDelete?.uploadedBy ? ` uploaded by ${toDelete.uploadedBy}` : ""} will be removed from the album and
        from storage.
      </ConfirmDialog>
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
