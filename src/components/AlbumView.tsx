"use client";

import { BlankRoll } from "./BlankRoll";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { deletePhoto, retryVideo, updateAlbum } from "@/lib/api-client";
import { useFavorites } from "@/lib/favorites";
import { dayKey } from "@/lib/format";
import { canDeletePhoto, canSetCover } from "@/lib/permissions";
import type { Album, Photo } from "@/lib/types";
import { ConfirmDialog } from "./ConfirmDialog";
import { EmptyState } from "./EmptyState";
import { useIdentity } from "./Identity";
import { useToast } from "./Toast";
import { useI18n } from "@/i18n/client";
import { ContactSheet } from "./ContactSheet";
import { IconFilm, IconGrid, IconHeart } from "./Icons";
import { Lightbox } from "./Lightbox";
import type { SocialCounts } from "./PhotoSocial";
import { PhotoGrid } from "./PhotoGrid";

type View = "grid" | "days";
const ALL = "all";

type Props = {
  album: Pick<Album, "id" | "title" | "location" | "coverPhotoId" | "createdById">;
  photos: Photo[];
  initialPhotoId?: string;
};

/** Phần thân trang album: thanh lọc, lưới / dòng thời gian, lightbox, đặt bìa / xoá ảnh. */
export function AlbumView({ album, photos: serverPhotos, initialPhotoId }: Props) {
  const favorites = useFavorites();
  const me = useIdentity();
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const [toDelete, setToDelete] = useState<Photo | null>(null);
  // Số bình luận / cảm xúc vừa đổi trong lightbox, đè lên số từ server để ô ảnh cập nhật ngay
  const [socialCounts, setSocialCounts] = useState<ReadonlyMap<string, SocialCounts>>(new Map());
  const photos = useMemo(
    () => (socialCounts.size ? serverPhotos.map((p) => ({ ...p, ...socialCounts.get(p.id) })) : serverPhotos),
    [serverPhotos, socialCounts],
  );
  // Mở lightbox từ huy hiệu bình luận → mở sẵn bảng bình luận
  const [startWithComments, setStartWithComments] = useState(false);
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
  // Số khung trên cuộn phim = vị trí trong cả album (không đổi khi lọc theo người / yêu thích)
  const frameIndex = useMemo(() => new Map(photos.map((p, i) => [p.id, i + 1])), [photos]);
  const frameNo = (id: string) => frameIndex.get(id) ?? 0;
  const liveList = useMemo(() => lightboxList.map((p) => byId.get(p.id) ?? p), [lightboxList, byId]);
  const openIndex = openId ? liveList.findIndex((p) => p.id === openId) : -1;

  // Còn video / ảnh HEIC đang chờ xử lý → hỏi lại server mỗi 10 giây
  const processing = photos.some((p) => p.status === "queued" || p.status === "processing");
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
      setStartWithComments(false);
      setLightboxList(visible);
      setOpenId(p.id);
    },
    onOpenComments: (p: Photo) => {
      setStartWithComments(true);
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
      toast.show({ tone: "success", title: photo.kind === "video" ? t.album.videoQueued : t.album.photoQueued, message: t.album.videoQueuedBody });
      router.refresh();
    } catch (err) {
      toast.show({ tone: "warn", title: t.album.couldntRetry, message: (err as Error).message });
    }
  }

  async function setCover(photo: Photo) {
    if (photo.id === coverId) return;
    try {
      await updateAlbum(album.id, { coverPhotoId: photo.id });
      toast.show({ tone: "success", title: t.album.coverUpdated });
      router.refresh();
    } catch (err) {
      toast.show({ tone: "warn", title: t.album.couldntChangeCover, message: (err as Error).message });
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
      toast.show({ tone: "success", title: t.album.photoDeleted });
      setToDelete(null);
      router.refresh();
    } catch (err) {
      toast.show({ tone: "warn", title: t.album.couldntDeletePhoto, message: (err as Error).message });
    }
  }

  if (photos.length === 0) {
    return <BlankRoll album={album} />;
  }

  return (
    <>
      <div className="-mt-4 mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="eyebrow shrink-0">{t.album.takenBy}</span>
          <div className="scrollbar-none -my-1 flex min-w-0 gap-1.5 overflow-x-auto py-1 pr-1">
            <button type="button" className="chip" aria-pressed={person === ALL} onClick={() => setPerson(ALL)}>
              {t.album.all} <span className="opacity-60 tabular-nums">{photos.length}</span>
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
            title={t.album.favoritesHint}
          >
            <IconHeart size={14} filled={favOnly} />
            {t.album.favorites} <span className="opacity-60 tabular-nums">{photos.filter((p) => favorites.ids.has(p.id)).length}</span>
          </button>
          <div className="ml-auto flex rounded-full border border-line bg-surface p-0.5 lg:ml-0" role="group" aria-label={t.album.viewMode}>
            <ViewButton active={view === "grid"} onClick={() => setView("grid")} label={t.album.grid}>
              <IconGrid size={16} />
            </ViewButton>
            <ViewButton active={view === "days"} onClick={() => setView("days")} label={t.album.contactSheet}>
              <IconFilm size={16} />
            </ViewButton>
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<IconHeart size={26} />}
          title={favOnly ? t.album.noFavorites : t.album.noMatching}
          action={
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setPerson(ALL);
                setFavOnly(false);
              }}
            >
              {t.album.showAll}
            </button>
          }
        >
          {favOnly ? t.album.favoritesEmpty : t.album.personEmpty}
        </EmptyState>
      ) : view === "grid" ? (
        <PhotoGrid photos={visible} eagerCount={4} {...tileProps} />
      ) : (
        <ContactSheet
          days={days}
          frameNo={frameNo}
          onOpen={tileProps.onOpen}
          onOpenComments={tileProps.onOpenComments}
          onRetry={tileProps.onRetry}
        />
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
          startWithComments={startWithComments}
          onSocialChange={(id, counts) => setSocialCounts((m) => new Map(m).set(id, counts))}
        />
      )}

      <ConfirmDialog
        open={!!toDelete}
        title={t.album.deletePhotoTitle}
        confirmLabel={t.album.deletePhoto}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      >
        {t.album.deletePhotoBody(toDelete?.uploadedBy ?? null)}
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
