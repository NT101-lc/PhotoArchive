"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { formatBytes, plural } from "@/lib/format";
import type { Album, Member } from "@/lib/types";
import {
  ACCEPTED_EXT,
  createAlbum,
  getMembers,
  getUploadStatus,
  mimeOf,
  uploadPhotos,
  type UploadProgress,
} from "@/lib/upload-client";
import { IconChevronDown, IconClose, IconFolder, IconImage, IconPlus, IconUpload } from "./Icons";
import { Modal } from "./Modal";
import { useToast } from "./Toast";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const PREVIEW_LIMIT = 24; // số ảnh preview mỗi thư mục trước khi bấm "xem thêm"
const LOOSE = ""; // nhóm ảnh lẻ (không nằm trong thư mục)
const UPLOADER_KEY = "b6-uploader"; // chưa có đăng nhập → nhớ "Uploading as" trên máy này

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
};

type Target =
  | { mode: "existing"; albumId: string }
  | { mode: "new"; title: string; location: string; tripDate: string };

type Props = {
  albums: Pick<Album, "id" | "title">[];
  /** Album chọn sẵn (khi mở từ trang album) */
  defaultAlbumId?: string;
};

/**
 * Nút "Upload ảnh" + modal. File được upload thẳng lên R2 qua URL đã ký (xem lib/upload-client.ts).
 * Truyền `children` + `className` để đổi giao diện nút (vd thẻ lối tắt ở trang chủ).
 */
export function UploadButton({
  albums,
  defaultAlbumId,
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
      {open && <UploadModal albums={albums} defaultAlbumId={defaultAlbumId} onClose={() => setOpen(false)} />}
    </>
  );
}

function isImage(file: File) {
  return ACCEPTED_EXT.test(file.name) || mimeOf(file).startsWith("image/");
}

function newTarget(title = "", tripDate = localDate(Date.now())): Target {
  return { mode: "new", title, location: "", tripDate };
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

function UploadModal({ albums, defaultAlbumId, onClose }: Props & { onClose: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const [items, setItems] = useState<Picked[]>([]);
  const [target, setTarget] = useState<Target>(() =>
    albums.length > 0 ? { mode: "existing", albumId: defaultAlbumId ?? albums[0].id } : newTarget(),
  );
  const [targetTouched, setTargetTouched] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const [storageReady, setStorageReady] = useState<boolean | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [uploaderId, setUploaderId] = useState("");
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const uploading = progress !== null;

  // Kiểm tra R2 đã cấu hình chưa + lấy danh sách thành viên
  useEffect(() => {
    let alive = true;
    getUploadStatus()
      .then((s) => alive && setStorageReady(s.configured))
      .catch(() => alive && setStorageReady(false));
    getMembers()
      .then((list) => {
        if (!alive) return;
        setMembers(list);
        let saved = "";
        try {
          saved = localStorage.getItem(UPLOADER_KEY) ?? "";
        } catch {}
        if (list.some((m) => m.id === saved)) setUploaderId(saved);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

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
      if (!isImage(file)) {
        skippedType++;
        return false;
      }
      if (file.size > MAX_FILE_BYTES) {
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
          skippedType && `${plural(skippedType, "file")} not an image`,
          skippedSize && `${plural(skippedSize, "photo")} over ${formatBytes(MAX_FILE_BYTES)}`,
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
      added.push({ key, file, path, folder: dirname(path), previewUrl: URL.createObjectURL(file) });
    }
    if (added.length === 0) return;
    setItems((prev) => [...prev, ...added]);

    // Có thư mục → gợi ý tạo album mới theo tên thư mục gốc (nếu người dùng chưa tự chọn)
    // Ngày đi gợi ý = ngày của file cũ nhất
    const rootFolder = added.find((a) => a.folder)?.folder.split("/")[0];
    if (rootFolder && !targetTouched) {
      const earliest = Math.min(...added.map((a) => a.file.lastModified || Date.now()));
      setTarget(newTarget(rootFolder, localDate(earliest)));
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

  async function onSave() {
    try {
      localStorage.setItem(UPLOADER_KEY, uploaderId);
    } catch {}
    setProgress({ done: 0, failed: 0, total: items.length });
    try {
      const slug =
        target.mode === "existing"
          ? target.albumId
          : (
              await createAlbum({
                title: target.title.trim(),
                location: target.location.trim(),
                tripDate: target.tripDate,
                createdById: uploaderId || undefined,
              })
            ).slug;

      const { added, failed } = await uploadPhotos(
        slug,
        items.map((i) => i.file),
        uploaderId || undefined,
        setProgress,
      );

      toast.show({
        tone: failed ? "warn" : "success",
        title: `Uploaded ${plural(added, "photo")}`,
        message: failed ? `${plural(failed, "file")} failed — try those again.` : undefined,
      });
      onClose();
      router.push(`/albums/${slug}`);
      router.refresh();
    } catch (err) {
      toast.show({ tone: "warn", title: "Upload failed", message: err instanceof Error ? err.message : undefined });
      setProgress(null);
    }
  }

  return (
    <Modal
      open
      onClose={() => {
        if (!uploading) onClose();
      }}
      maxWidth="max-w-[720px]"
      eyebrow="Add photos"
      title="Upload photos or whole folders"
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="font-mono text-xs text-ink-soft sm:flex-1">
            {items.length > 0
              ? `${plural(items.length, "photo")} · ${formatBytes(totalSize)}${folderCount ? ` · ${plural(folderCount, "folder")}` : ""}`
              : "No photos selected"}
          </p>
          <button
            type="button"
            className="btn btn-primary h-11 px-6"
            disabled={items.length === 0 || !targetValid || uploading || storageReady !== true}
            onClick={onSave}
          >
            {uploading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-on-accent/25 border-t-on-accent" />
                Uploading {progress.done + progress.failed}/{progress.total}…
              </>
            ) : (
              <>
                <IconUpload size={16} />
                Save {items.length > 0 ? plural(items.length, "photo") : ""}
              </>
            )}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-5 p-5">
        {storageReady === false && (
          <p role="alert" className="rounded-xl border-2 border-accent bg-accent/10 px-4 py-3 text-sm">
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
            <div className="grid gap-2 sm:grid-cols-[2fr_1.4fr_1fr]">
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
              <input
                type="date"
                value={target.tripDate}
                onChange={(e) => setTarget({ ...target, tripDate: e.target.value })}
                className="field"
                aria-label="Trip date"
              />
            </div>
          )}
        </fieldset>

        <label className="flex flex-col gap-2">
          <span className="eyebrow">Uploading as</span>
          <select value={uploaderId} onChange={(e) => setUploaderId(e.target.value)} className="field">
            <option value="">— Choose your name —</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>

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
          className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
            dragging ? "border-accent bg-accent/10" : "border-line bg-surface-2/40"
          }`}
        >
          <span className="flex h-14 w-14 rotate-[-6deg] items-center justify-center rounded-xl border-2 border-line bg-butter text-on-accent shadow-hard-sm">
            {reading ? (
              <span className="h-6 w-6 animate-spin rounded-full border-[3px] border-on-accent/20 border-t-on-accent" />
            ) : (
              <IconImage size={26} />
            )}
          </span>
          <div>
            <p className="font-display text-lg font-bold">
              {reading ? "Reading folder…" : dragging ? "Drop it here" : "Drag & drop photos or folders here"}
            </p>
            <p className="text-sm text-ink-soft">Subfolders included · JPG, PNG, HEIC, WEBP · up to 50 MB per photo</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <label className="btn cursor-pointer">
              <IconImage size={16} /> Choose photos
              <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => {
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
}: {
  folder: string;
  items: Picked[];
  onRemoveGroup: () => void;
  onRemoveItem: (key: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const size = items.reduce((s, f) => s + f.file.size, 0);
  const shown = showAll ? items : items.slice(0, PREVIEW_LIMIT);

  return (
    <section className="rounded-xl border-2 border-line bg-surface">
      <div className="flex items-center gap-2 px-3 py-2">
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={open}>
          <IconChevronDown size={16} className={`shrink-0 transition-transform ${open ? "" : "-rotate-90"}`} />
          {folder ? <IconFolder size={16} className="shrink-0 text-accent" /> : <IconImage size={16} className="shrink-0" />}
          <span className="truncate font-semibold">{folder || "Loose photos"}</span>
          <span className="shrink-0 font-mono text-xs text-ink-soft">
            {items.length} · {formatBytes(size)}
          </span>
        </button>
        <button type="button" onClick={onRemoveGroup} className="rounded-md p-1 text-ink-soft hover:bg-surface-2 hover:text-accent" aria-label={`Remove ${folder || "loose photos"}`}>
          <IconClose size={15} />
        </button>
      </div>
      {open && (
        <div className="border-t-2 border-dashed border-line p-3">
          <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {shown.map((f) => (
              <PreviewTile key={f.key} item={f} onRemove={() => onRemoveItem(f.key)} />
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

function PreviewTile({ item, onRemove }: { item: Picked; onRemove: () => void }) {
  const [broken, setBroken] = useState(false); // vd HEIC: đa số trình duyệt không hiển thị được
  const name = item.path.split("/").pop();

  return (
    <li className="group relative" title={`${item.path} · ${formatBytes(item.file.size)}`}>
      <div className="aspect-square overflow-hidden rounded-lg border-2 border-line bg-surface-2">
        {broken ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 p-1 text-ink-soft">
            <IconImage size={18} />
            <span className="w-full truncate text-center font-mono text-[0.55rem]">{name}</span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- blob: URL cục bộ, không qua next/image
          <img src={item.previewUrl} alt={name} loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover" />
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-line bg-surface opacity-100 shadow-hard-sm sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        aria-label={`Remove ${name}`}
      >
        <IconClose size={11} />
      </button>
    </li>
  );
}
