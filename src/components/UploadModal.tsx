"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { formatBytes, plural } from "@/lib/format";
import { api, createAlbum } from "@/lib/api-client";
import { canSetCover } from "@/lib/permissions";
import type { Album, Member } from "@/lib/types";
import { mediaTypeOf } from "@/lib/media";
import { ACCEPT, getUploadStatus, isVideoFile, MAX_PHOTO_BYTES } from "@/lib/upload-client";
import { IconChevronDown, IconClose, IconFolder, IconImage, IconPlay, IconPlus, IconStar, IconUpload, IconUser } from "./Icons";
import { useIdentity } from "./Identity";
import { IdentityForm } from "./IdentityForm";
import { Modal } from "./Modal";
import { useToast } from "./Toast";
import { DateRangeFields } from "./DateRangeFields";
import { DescriptionInput } from "./DescriptionInput";
import { useUploads } from "./UploadManager";

const PREVIEW_LIMIT = 24; // số ảnh preview mỗi thư mục trước khi bấm "xem thêm"
const LOOSE = ""; // nhóm ảnh lẻ (không nằm trong thư mục)

/** `YYYY-MM-DD` theo giờ máy */
function localDate(ms: number) {
  const d = new Date(ms);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

type Picked = {
  key: string;
  file: File;
  /** Đường dẫn tương đối, vd `DaLat/ngay-1/IMG_01.jpg` */
  path: string;
  /** Thư mục chứa, `""` nếu là ảnh lẻ */
  folder: string;
  previewUrl: string;
  video: boolean;
};

type Target =
  | { mode: "existing"; albumId: string }
  | { mode: "new"; title: string; location: string; tripDate: string; endDate: string; description: string };

type Props = {
  albums: Pick<Album, "id" | "title" | "createdById">[];
  /** Album chọn sẵn (khi mở từ trang album) */
  defaultAlbumId?: string;
  /** Mở thẳng ở chế độ "New album" (nút tạo album, chưa cần ảnh) */
  startNew?: boolean;
};

/**
 * Nút "Upload" + modal chọn ảnh / video / thư mục. Bấm lưu thì giao file cho UploadManager chạy nền
 * (upload thẳng lên R2 qua URL đã ký, xem lib/upload-client.ts) và đóng modal ngay.
 * Truyền `children` + `className` để đổi giao diện nút (vd thẻ lối tắt ở trang chủ).
 */
export function UploadButton({
  albums,
  defaultAlbumId,
  startNew,
  className = "btn btn-primary",
  children,
}: Props & { className?: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children ?? (
          <>
            <IconUpload size={16} />
            Upload photos
          </>
        )}
      </button>
      {open && <UploadModal albums={albums} defaultAlbumId={defaultAlbumId} startNew={startNew} onClose={() => setOpen(false)} />}
    </>
  );
}

function isAccepted(file: File) {
  return mediaTypeOf(file) !== null;
}

function newTarget(title = "", tripDate = localDate(Date.now()), endDate = ""): Target {
  return { mode: "new", title, location: "", tripDate, endDate, description: "" };
}

function dirname(path: string) {
  const i = path.lastIndexOf("/");
  return i === -1 ? LOOSE : path.slice(0, i);
}

// ---- Đọc thư mục khi kéo thả (File System Entries API) ----

function readAllEntries(dir: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  const reader = dir.createReader();
  const all: FileSystemEntry[] = [];
  // readEntries trả theo từng đợt (~100 mục) nên phải gọi tới khi rỗng
  return new Promise((resolve, reject) => {
    const next = () =>
      reader.readEntries((batch) => {
        if (batch.length === 0) resolve(all);
        else {
          all.push(...batch);
          next();
        }
      }, reject);
    next();
  });
}

async function walkEntry(entry: FileSystemEntry): Promise<Array<{ file: File; path: string }>> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
    return [{ file, path: entry.fullPath.replace(/^\//, "") }];
  }
  if (entry.isDirectory) {
    const children = await readAllEntries(entry as FileSystemDirectoryEntry);
    return (await Promise.all(children.map(walkEntry))).flat();
  }
  return [];
}

function UploadModal({ albums, defaultAlbumId, startNew, onClose }: Props & { onClose: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const [items, setItems] = useState<Picked[]>([]);
  const [target, setTarget] = useState<Target>(() =>
    albums.length > 0 && !startNew ? { mode: "existing", albumId: defaultAlbumId ?? albums[0].id } : newTarget(),
  );
  const [targetTouched, setTargetTouched] = useState(!!startNew);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const [storageReady, setStorageReady] = useState<boolean | null>(null);
  const me = useIdentity();
  // Chọn tên ngay trong modal (không rời trang) để không mất ảnh / thông tin đang điền
  const [picking, setPicking] = useState(false);
  const [members, setMembers] = useState<Member[] | null>(null);
  // Tên vừa chọn, chờ server làm mới danh tính (router.refresh) xong
  const [pickedName, setPickedName] = useState<string | null>(null);
  const switching = pickedName !== null && me?.name !== pickedName;
  // Ảnh được chọn làm bìa; null = mặc định (ảnh đầu tiên của album)
  const [coverKey, setCoverKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const uploads = useUploads();

  // Kiểm tra R2 đã cấu hình chưa
  useEffect(() => {
    let alive = true;
    getUploadStatus()
      .then((s) => alive && setStorageReady(s.configured))
      .catch(() => alive && setStorageReady(false));
    return () => {
      alive = false;
    };
  }, []);

  function openPicker() {
    setPicking(true);
    if (!members) {
      api<{ members: Member[] }>("/api/members")
        .then((r) => setMembers(r.members))
        .catch(() => toast.show({ tone: "warn", title: "Couldn’t load the crew list" }));
    }
  }

  // Giải phóng object URL của preview khi đóng modal
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => () => itemsRef.current.forEach((f) => URL.revokeObjectURL(f.previewUrl)), []);

  function addFiles(list: Array<{ file: File; path: string }>) {
    let skippedType = 0;
    let skippedSize = 0;
    const accepted = list.filter(({ file }) => {
      if (file.name.startsWith(".")) return false; // .DS_Store, file ẩn
      if (!isAccepted(file)) {
        skippedType++;
        return false;
      }
      // Video không giới hạn dung lượng; ảnh tối đa 50 MB
      if (!isVideoFile(file) && file.size > MAX_PHOTO_BYTES) {
        skippedSize++;
        return false;
      }
      return true;
    });

    if (skippedType || skippedSize) {
      toast.show({
        tone: "warn",
        title: `Skipped ${plural(skippedType + skippedSize, "file")}`,
        message: [
          skippedType && `${plural(skippedType, "file")} not a photo or video`,
          skippedSize && `${plural(skippedSize, "photo")} over ${formatBytes(MAX_PHOTO_BYTES)}`,
        ]
          .filter(Boolean)
          .join(" · "),
      });
    }

    const existing = new Set(itemsRef.current.map((p) => p.key));
    const added: Picked[] = [];
    for (const { file, path } of accepted) {
      const key = `${path}-${file.size}-${file.lastModified}`;
      if (existing.has(key)) continue;
      existing.add(key);
      added.push({ key, file, path, folder: dirname(path), previewUrl: URL.createObjectURL(file), video: isVideoFile(file) });
    }
    if (added.length === 0) return;
    setItems((prev) => [...prev, ...added]);

    // Có thư mục → gợi ý tạo album mới theo tên thư mục gốc (nếu người dùng chưa tự chọn)
    // Khoảng ngày gợi ý = từ file cũ nhất tới file mới nhất
    const rootFolder = added.find((a) => a.folder)?.folder.split("/")[0];
    if (rootFolder && !targetTouched) {
      const times = added.map((a) => a.file.lastModified || Date.now());
      const [first, last] = [localDate(Math.min(...times)), localDate(Math.max(...times))];
      setTarget(newTarget(rootFolder, first, last === first ? "" : last));
    }
  }

  async function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    // Phải lấy entry ngay trong sự kiện, sau await DataTransfer sẽ bị xoá
    const entries = Array.from(e.dataTransfer.items)
      .map((it) => it.webkitGetAsEntry?.())
      .filter((x): x is FileSystemEntry => !!x);

    if (entries.length === 0) {
      addFiles(Array.from(e.dataTransfer.files).map((file) => ({ file, path: file.name })));
      return;
    }
    setReading(true);
    try {
      addFiles((await Promise.all(entries.map(walkEntry))).flat());
    } catch {
      toast.show({ tone: "warn", title: "Couldn't read the folder", message: "Try the “Choose folder” button instead." });
    } finally {
      setReading(false);
    }
  }

  function onPick(list: FileList | null) {
    if (!list) return;
    addFiles(Array.from(list).map((file) => ({ file, path: file.webkitRelativePath || file.name })));
  }

  function removeWhere(pred: (p: Picked) => boolean) {
    setCoverKey((k) => (k && itemsRef.current.some((p) => p.key === k && pred(p)) ? null : k));
    setItems((prev) => {
      prev.filter(pred).forEach((p) => URL.revokeObjectURL(p.previewUrl));
      return prev.filter((p) => !pred(p));
    });
  }

  const groups = useMemo(() => {
    const map = new Map<string, Picked[]>();
    for (const it of items) map.set(it.folder, [...(map.get(it.folder) ?? []), it]);
    // Thư mục trước, ảnh lẻ cuối
    return [...map.entries()].sort(([a], [b]) => (a === LOOSE ? 1 : b === LOOSE ? -1 : a.localeCompare(b, "vi")));
  }, [items]);

  const totalSize = items.reduce((s, f) => s + f.file.size, 0);
  const folderCount = groups.filter(([f]) => f !== LOOSE).length;
  const targetValid =
    target.mode === "existing"
      ? !!target.albumId
      : !!target.title.trim() && !!target.location.trim() && !!target.tripDate;

  // Album mới: người tạo luôn được chọn bìa. Album có sẵn: admin hoặc người tạo album đó.
  const targetAlbum = target.mode === "existing" ? albums.find((a) => a.id === target.albumId) : undefined;
  const canPickCover = target.mode === "new" || (!!targetAlbum && canSetCover(me, targetAlbum));
  const coverItem = canPickCover && coverKey ? items.find((i) => i.key === coverKey) : undefined;

  const videoCount = items.filter((i) => i.video).length;
  const photoCount = items.length - videoCount;
  const countLabel = [photoCount && plural(photoCount, "photo"), videoCount && plural(videoCount, "video")]
    .filter(Boolean)
    .join(" and ");

  // Album mới được tạo rỗng (thêm ảnh sau); album có sẵn thì phải chọn ít nhất một file
  const emptyAlbum = items.length === 0 && target.mode === "new";

  /** Tạo album (nếu cần) rồi giao file cho UploadManager chạy nền; modal đóng ngay. */
  async function onSave() {
    setSaving(true);
    try {
      let slug: string;
      let title: string;
      if (target.mode === "existing") {
        slug = target.albumId;
        title = albums.find((a) => a.id === slug)?.title ?? "Album";
      } else {
        title = target.title.trim();
        slug = (
          await createAlbum({
            title,
            location: target.location.trim(),
            tripDate: target.tripDate,
            endDate: target.endDate || null,
            description: target.description,
          })
        ).slug;
      }

      if (items.length > 0) {
        uploads.enqueue({
          albumSlug: slug,
          albumTitle: title,
          files: items.map((i) => i.file),
          coverIndex: coverItem ? items.indexOf(coverItem) : undefined,
        });
      }
      onClose();
      // Album mới → mở luôn để thấy ảnh hiện dần; album có sẵn → để người dùng ở yên chỗ đang xem
      if (target.mode === "new") {
        router.push(`/albums/${slug}`);
        router.refresh();
      }
    } catch (err) {
      toast.show({ tone: "warn", title: "Couldn’t create the album", message: err instanceof Error ? err.message : undefined });
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => {
        if (!saving) onClose();
      }}
      maxWidth="max-w-[720px]"
      eyebrow="Add to the archive"
      title={startNew ? "Start a new trip album" : "Upload photos, videos or folders"}
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="font-mono text-xs text-ink-soft sm:flex-1">
            {items.length > 0
              ? `${countLabel} · ${formatBytes(totalSize)}${folderCount ? ` · ${plural(folderCount, "folder")}` : ""}`
              : emptyAlbum
                ? "No files yet: the album starts empty, add photos any time"
                : "Nothing selected yet"}
            {items.length > 0 && canPickCover && (
              <span className="block">
                Cover: {coverItem ? coverItem.path.split("/").pop() : "first photo (default)"}
              </span>
            )}
          </p>
          <button
            type="button"
            className="btn btn-primary h-11 px-6"
            disabled={(items.length === 0 && !emptyAlbum) || !targetValid || saving || storageReady !== true || !me || switching || picking}
            onClick={onSave}
          >
            {saving ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-on-accent/25 border-t-on-accent" />
                Creating album…
              </>
            ) : emptyAlbum ? (
              <>
                <IconPlus size={16} />
                Create empty album
              </>
            ) : (
              <>
                <IconUpload size={16} />
                Upload {items.length > 0 ? plural(items.length, "file") : ""}
              </>
            )}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-5 p-5">
        {storageReady === false && (
          <p role="alert" className="rounded-lg border border-danger bg-danger/10 px-4 py-3 text-sm">
            <b>Storage isn’t configured yet.</b> Set <code className="font-mono">R2_BUCKET</code> (and the other R2
            variables) in <code className="font-mono">.env</code>, then restart the server to enable uploads.
          </p>
        )}

        {/* Album đích */}
        <fieldset className="flex flex-col gap-2">
          <legend className="eyebrow mb-2">Save to</legend>
          <div className="flex gap-1.5">
            <button
              type="button"
              className="chip"
              aria-pressed={target.mode === "existing"}
              onClick={() => {
                setTargetTouched(true);
                setTarget({ mode: "existing", albumId: defaultAlbumId ?? albums[0]?.id ?? "" });
              }}
            >
              Existing album
            </button>
            <button
              type="button"
              className="chip"
              aria-pressed={target.mode === "new"}
              onClick={() => {
                setTargetTouched(true);
                setTarget(newTarget(groups.find(([f]) => f)?.[0].split("/")[0] ?? ""));
              }}
            >
              <IconPlus size={13} />
              New album
            </button>
          </div>
          {target.mode === "existing" ? (
            <select
              value={target.albumId}
              onChange={(e) => {
                setTargetTouched(true);
                setTarget({ mode: "existing", albumId: e.target.value });
              }}
              className="field"
              aria-label="Choose album"
            >
              {albums.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          ) : (
            <div className="grid gap-2 sm:grid-cols-[3fr_2fr]">
              <input
                value={target.title}
                onChange={(e) => {
                  setTargetTouched(true);
                  setTarget({ ...target, title: e.target.value });
                }}
                placeholder="Trip name, e.g. Sapa in March"
                className="field"
                aria-label="New album name"
              />
              <input
                value={target.location}
                onChange={(e) => setTarget({ ...target, location: e.target.value })}
                placeholder="Place, e.g. Sapa"
                className="field"
                aria-label="Place"
              />
              <DateRangeFields
                className="sm:col-span-2"
                start={target.tripDate}
                end={target.endDate}
                onChange={({ start, end }) => {
                  setTargetTouched(true);
                  setTarget({ ...target, tripDate: start, endDate: end });
                }}
              />
              <div className="flex flex-col gap-1 sm:col-span-2">
                <DescriptionInput
                  value={target.description}
                  onChange={(description) => {
                    setTargetTouched(true);
                    setTarget({ ...target, description });
                  }}
                  aria-label="Trip description (optional)"
                  placeholder="Description (optional): who came, where you stayed, the moment you’ll remember."
                  rows={2}
                  className="min-h-[72px]"
                />
              </div>
            </div>
          )}
        </fieldset>

        {picking ? (
          <section className="rounded-xl border border-line bg-surface-2/40 p-4" aria-label="Choose who you are">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm">
                <b>Who’s uploading?</b> <span className="text-ink-soft">Your photos and album details stay as they are.</span>
              </p>
              {me && (
                <button type="button" onClick={() => setPicking(false)} className="shrink-0 text-sm font-semibold underline hover:text-accent">
                  Cancel
                </button>
              )}
            </div>
            {members ? (
              <IdentityForm
                members={members}
                current={me}
                onDone={(name) => {
                  setPickedName(name);
                  setPicking(false);
                }}
              />
            ) : (
              <p className="text-sm text-ink-soft">Loading the crew…</p>
            )}
          </section>
        ) : switching ? (
          <p className="flex items-center gap-2 text-sm text-ink-soft" aria-live="polite">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" />
            Switching to <b className="text-ink">{pickedName}</b>…
          </p>
        ) : me ? (
          <p className="flex items-center gap-2 text-sm text-ink-soft">
            <IconUser size={15} />
            Uploading as <b className="text-ink">{me.name}</b>
            <button type="button" onClick={openPicker} disabled={saving} className="ml-auto font-semibold underline hover:text-accent">
              Not you?
            </button>
          </p>
        ) : (
          <p role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-danger bg-danger/10 px-4 py-3 text-sm">
            <b>Pick your name before uploading.</b>
            <span className="text-ink-soft">You won’t lose anything you’ve added.</span>
            <button type="button" onClick={openPicker} className="btn btn-primary ml-auto h-9">
              Choose who you are
            </button>
          </p>
        )}

        {/* Vùng thả */}
        <div
          onDragEnter={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
          }}
          onDrop={onDrop}
          className={`flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-4 py-8 text-center transition-colors ${
            dragging ? "border-accent bg-accent/10" : "border-line bg-surface-2/40"
          }`}
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-xl border border-line bg-butter text-on-accent shadow-hard-sm">
            {reading ? (
              <span className="h-6 w-6 animate-spin rounded-full border-[3px] border-on-accent/20 border-t-on-accent" />
            ) : (
              <IconImage size={26} />
            )}
          </span>
          <div>
            <p className="font-display text-lg font-bold">
              {reading ? "Reading folder…" : dragging ? "Drop it here" : "Drag photos, videos or folders here"}
            </p>
            <p className="text-sm text-ink-soft">
              Subfolders included. Photos up to 50 MB each; videos any size. You can keep browsing while they upload.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <label className="btn cursor-pointer">
              <IconImage size={16} /> Choose files
              <input type="file" accept={ACCEPT} multiple className="sr-only" onChange={(e) => {
                onPick(e.target.files);
                e.target.value = "";
              }} />
            </label>
            <label className="btn cursor-pointer">
              <IconFolder size={16} /> Choose folder
              <input
                type="file"
                multiple
                className="sr-only"
                ref={(el) => el?.setAttribute("webkitdirectory", "")}
                onChange={(e) => {
                  onPick(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>

        {/* Danh sách đã chọn, gom theo thư mục */}
        {groups.length > 0 && (
          <div className="flex flex-col gap-3">
            {groups.map(([folder, list]) => (
              <FolderGroup
                key={folder || "__loose"}
                folder={folder}
                items={list}
                onRemoveGroup={() => removeWhere((p) => p.folder === folder)}
                onRemoveItem={(key) => removeWhere((p) => p.key === key)}
                coverKey={canPickCover ? coverKey : undefined}
                onToggleCover={canPickCover ? (key) => setCoverKey((k) => (k === key ? null : key)) : undefined}
              />
            ))}
            {items.length > 1 && (
              <button type="button" onClick={() => removeWhere(() => true)} className="self-end text-sm font-semibold text-ink-soft underline hover:text-accent">
                Remove all
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function FolderGroup({
  folder,
  items,
  onRemoveGroup,
  onRemoveItem,
  coverKey,
  onToggleCover,
}: {
  folder: string;
  items: Picked[];
  onRemoveGroup: () => void;
  onRemoveItem: (key: string) => void;
  coverKey?: string | null;
  onToggleCover?: (key: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const size = items.reduce((s, f) => s + f.file.size, 0);
  const shown = showAll ? items : items.slice(0, PREVIEW_LIMIT);

  return (
    <section className="rounded-xl border border-line bg-surface">
      <div className="flex items-center gap-2 px-3 py-2">
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={open}>
          <IconChevronDown size={16} className={`shrink-0 transition-transform ${open ? "" : "-rotate-90"}`} />
          {folder ? <IconFolder size={16} className="shrink-0 text-accent" /> : <IconImage size={16} className="shrink-0" />}
          <span className="truncate font-semibold">{folder || "Loose photos"}</span>
          <span className="shrink-0 font-mono text-xs text-ink-soft">
            {items.length} · {formatBytes(size)}
          </span>
        </button>
        <button type="button" onClick={onRemoveGroup} className="rounded-md p-1 text-ink-soft hover:bg-surface-2 hover:text-danger" aria-label={`Remove ${folder || "loose photos"}`}>
          <IconClose size={15} />
        </button>
      </div>
      {open && (
        <div className="border-t border-dashed border-line p-3">
          <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {shown.map((f) => (
              <PreviewTile
                key={f.key}
                item={f}
                onRemove={() => onRemoveItem(f.key)}
                isCover={coverKey === f.key}
                onToggleCover={onToggleCover && !f.video ? () => onToggleCover(f.key) : undefined}
              />
            ))}
          </ul>
          {items.length > PREVIEW_LIMIT && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 text-sm font-semibold underline">
              {showAll ? "Show less" : `Show ${items.length - PREVIEW_LIMIT} more`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function PreviewTile({
  item,
  onRemove,
  isCover = false,
  onToggleCover,
}: {
  item: Picked;
  onRemove: () => void;
  isCover?: boolean;
  onToggleCover?: () => void;
}) {
  const [broken, setBroken] = useState(false); // vd HEIC: đa số trình duyệt không hiển thị được
  const name = item.path.split("/").pop();

  return (
    <li className="group relative" title={`${item.path} · ${formatBytes(item.file.size)}`}>
      <div
        className={`aspect-square overflow-hidden rounded-lg border bg-surface-2 ${
          isCover ? "border-accent ring-2 ring-accent" : "border-line"
        }`}
      >
        {broken ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 p-1 text-ink-soft">
            {item.video ? <IconPlay size={18} /> : <IconImage size={18} />}
            <span className="w-full truncate text-center font-mono text-[0.55rem]">{name}</span>
          </div>
        ) : item.video ? (
          // #t=0.1: hiện khung hình đầu làm preview; codec trình duyệt không đọc được (vd HEVC) thì hiện icon
          <video
            src={`${item.previewUrl}#t=0.1`}
            muted
            playsInline
            preload="metadata"
            onError={() => setBroken(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- blob: URL cục bộ, không qua next/image
          <img src={item.previewUrl} alt={name} loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover" />
        )}
      </div>
      {item.video && !broken && (
        <span className="pointer-events-none absolute bottom-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white" aria-hidden="true">
          <IconPlay size={12} />
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-line bg-surface opacity-100 shadow-hard-sm sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        aria-label={`Remove ${name}`}
      >
        <IconClose size={11} />
      </button>
      {isCover && (
        <span className="absolute inset-x-1 bottom-1 rounded bg-accent px-1 text-center font-mono text-[0.55rem] font-bold text-on-accent">
          COVER
        </span>
      )}
      {onToggleCover && (
        <button
          type="button"
          onClick={onToggleCover}
          aria-pressed={isCover}
          title={isCover ? "Unset cover (use first photo)" : "Use as album cover"}
          aria-label={isCover ? `Unset ${name} as cover` : `Use ${name} as cover`}
          className={`absolute -top-1.5 -left-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-line shadow-hard-sm ${
            isCover
              ? "bg-accent text-on-accent"
              : "bg-surface opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
          }`}
        >
          <IconStar size={12} filled={isCover} />
        </button>
      )}
    </li>
  );
}
