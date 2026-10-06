"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { deleteAlbum, updateAlbum } from "@/lib/api-client";
import { plural } from "@/lib/format";
import { canDeleteAlbum, canEditAlbum } from "@/lib/permissions";
import type { Album } from "@/lib/types";
import { ConfirmDialog } from "./ConfirmDialog";
import { IconEdit, IconTrash } from "./Icons";
import { useIdentity } from "./Identity";
import { Modal } from "./Modal";
import { useToast } from "./Toast";

/** Nút sửa / xoá album — chỉ hiện với admin (API cũng chặn lại nếu không phải admin). */
export function AlbumAdminActions({ album }: { album: Pick<Album, "id" | "title" | "location" | "tripDate" | "photoCount"> }) {
  const me = useIdentity();
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({ title: album.title, location: album.location, tripDate: album.tripDate });
  const [saving, setSaving] = useState(false);

  if (!canEditAlbum(me) && !canDeleteAlbum(me)) return null;

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { slug } = await updateAlbum(album.id, {
        title: form.title.trim(),
        location: form.location.trim(),
        tripDate: form.tripDate,
      });
      toast.show({ tone: "success", title: "Album updated" });
      setEditing(false);
      // Đổi tên / ngày có thể đổi slug → chuyển sang URL mới
      if (slug !== album.id) router.replace(`/albums/${slug}`);
      router.refresh();
    } catch (err) {
      toast.show({ tone: "warn", title: "Couldn’t update album", message: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    try {
      await deleteAlbum(album.id);
      toast.show({ tone: "success", title: `Deleted “${album.title}”` });
      router.push("/albums");
      router.refresh();
    } catch (err) {
      toast.show({ tone: "warn", title: "Couldn’t delete album", message: (err as Error).message });
    }
  }

  return (
    <>
      <div className="flex gap-2 max-sm:[&>*]:flex-1">
        {canEditAlbum(me) && (
          <button type="button" className="btn" onClick={() => setEditing(true)}>
            <IconEdit size={16} />
            Edit
          </button>
        )}
        {canDeleteAlbum(me) && (
          <button type="button" className="btn hover:bg-accent hover:text-on-accent" onClick={() => setDeleting(true)}>
            <IconTrash size={16} />
            Delete
          </button>
        )}
      </div>

      <Modal
        open={editing}
        onClose={() => !saving && setEditing(false)}
        eyebrow="Admin"
        title="Edit album"
        maxWidth="max-w-[480px]"
      >
        <form onSubmit={save} className="flex flex-col gap-4 p-5">
          <Field label="Trip name">
            <input
              className="field"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              maxLength={120}
            />
          </Field>
          <Field label="Place">
            <input
              className="field"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              required
              maxLength={120}
            />
          </Field>
          <Field label="Trip date">
            <input
              type="date"
              className="field"
              value={form.tripDate}
              onChange={(e) => setForm({ ...form, tripDate: e.target.value })}
              required
            />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleting}
        title={`Delete “${album.title}”?`}
        confirmLabel="Delete album"
        onConfirm={remove}
        onClose={() => setDeleting(false)}
      >
        The album and all {plural(album.photoCount, "photo")} in it will be deleted, including the files in storage.
      </ConfirmDialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="eyebrow">{label}</span>
      {children}
    </label>
  );
}
