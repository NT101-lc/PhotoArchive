"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { deleteAlbum, updateAlbum } from "@/lib/api-client";
import { useI18n } from "@/i18n/client";
import { canDeleteAlbum, canEditAlbum, canEditAlbumDate } from "@/lib/permissions";
import type { Album } from "@/lib/types";
import { ConfirmDialog } from "./ConfirmDialog";
import { DateRangeFields } from "./DateRangeFields";
import { DescriptionInput } from "./DescriptionInput";
import { IconEdit, IconTrash } from "./Icons";
import { PlacesInput } from "./PlacesInput";
import { withDraft } from "@/lib/places-format";
import { useIdentity } from "./Identity";
import { Modal } from "./Modal";
import { useToast } from "./Toast";

/**
 * Nút sửa / xoá album. Admin: sửa tên, nơi, ngày, mô tả + xoá. Thành viên thường: sửa ngày và mô tả.
 * (API cũng kiểm tra lại quyền.)
 */
export function AlbumAdminActions({
  album,
}: {
  album: Pick<Album, "id" | "title" | "places" | "tripDate" | "endDate" | "description" | "photoCount">;
}) {
  const me = useIdentity();
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    title: album.title,
    places: album.places,
    placeDraft: "",
    tripDate: album.tripDate,
    endDate: album.endDate ?? "",
    description: album.description ?? "",
  });
  const [saving, setSaving] = useState(false);

  const fullEdit = canEditAlbum(me);
  if (!fullEdit && !canEditAlbumDate(me) && !canDeleteAlbum(me)) return null;

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      // Chỉ gửi những trường người dùng được sửa
      const shared = { tripDate: form.tripDate, endDate: form.endDate || null, description: form.description };
      const { slug } = await updateAlbum(
        album.id,
        fullEdit ? { title: form.title.trim(), places: withDraft(form.places, form.placeDraft), ...shared } : shared,
      );
      toast.show({ tone: "success", title: t.albumEdit.updated });
      setEditing(false);
      // Đổi tên / ngày có thể đổi slug → chuyển sang URL mới
      if (slug !== album.id) router.replace(`/albums/${slug}`);
      router.refresh();
    } catch (err) {
      toast.show({ tone: "warn", title: t.albumEdit.couldntUpdate, message: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    try {
      await deleteAlbum(album.id);
      toast.show({ tone: "success", title: t.albumEdit.deleted(album.title) });
      router.push("/albums");
      router.refresh();
    } catch (err) {
      toast.show({ tone: "warn", title: t.albumEdit.couldntDelete, message: (err as Error).message });
    }
  }

  return (
    <>
      <div className="flex gap-2 max-sm:[&>*]:flex-1">
        {(fullEdit || canEditAlbumDate(me)) && (
          <button type="button" className="btn" onClick={() => setEditing(true)}>
            <IconEdit size={16} />
            {fullEdit ? t.albumEdit.edit : t.albumEdit.editTrip}
          </button>
        )}
        {canDeleteAlbum(me) && (
          <button type="button" className="btn hover:border-danger hover:text-danger" onClick={() => setDeleting(true)}>
            <IconTrash size={16} />
            {t.common.delete}
          </button>
        )}
      </div>

      <Modal
        open={editing}
        onClose={() => !saving && setEditing(false)}
        eyebrow={fullEdit ? t.albumEdit.admin : undefined}
        title={fullEdit ? t.albumEdit.editAlbum : t.albumEdit.editTrip}
        maxWidth="max-w-[480px]"
      >
        <form onSubmit={save} className="flex flex-col gap-4 p-5">
          <Field label={t.albumEdit.tripName}>
            <input
              className="field disabled:bg-surface-2 disabled:text-ink-soft"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              maxLength={120}
              disabled={!fullEdit}
            />
          </Field>
          {/* Không bọc <label> như các ô khác: bấm vào chữ của label sẽ "bấm" luôn nút × đầu tiên trong ô */}
          <div className="flex flex-col gap-1.5">
            <span className="eyebrow">{t.albumEdit.places}</span>
            <PlacesInput
              places={form.places}
              draft={form.placeDraft}
              onChange={(places, placeDraft) => setForm({ ...form, places, placeDraft })}
              disabled={!fullEdit}
              aria-label={t.albumEdit.places}
            />
          </div>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="eyebrow mb-1.5">{t.albumEdit.tripDates}</legend>
            <DateRangeFields
              start={form.tripDate}
              end={form.endDate}
              onChange={({ start, end }) => setForm({ ...form, tripDate: start, endDate: end })}
            />
          </fieldset>
          <Field label={t.albumEdit.description}>
            <DescriptionInput value={form.description} onChange={(description) => setForm({ ...form, description })} />
          </Field>
          {!fullEdit && (
            <p className="text-xs text-ink-soft">{t.albumEdit.adminOnly}</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn" onClick={() => setEditing(false)} disabled={saving}>
              {t.common.cancel}
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? t.common.saving : t.albumEdit.saveChanges}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleting}
        title={t.albumEdit.deleteTitle(album.title)}
        confirmLabel={t.albumEdit.deleteAlbum}
        onConfirm={remove}
        onClose={() => setDeleting(false)}
      >
        {t.albumEdit.deleteBody(album.photoCount)}
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
