"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createPlan } from "@/lib/api-client";
import { canEditPlan } from "@/lib/permissions";
import { DateRangeFields } from "./DateRangeFields";
import { IconPlus } from "./Icons";
import { PlacesInput } from "./PlacesInput";
import { useI18n } from "@/i18n/client";
import { joinPlaces, withDraft, type TripPlace } from "@/lib/places-format";
import { useIdentity } from "./Identity";
import { Modal } from "./Modal";
import { useToast } from "./Toast";

/** Nút "New plan" + form ngắn (tên, nơi, ngày đi / về). Tạo xong mở thẳng bảng kế hoạch. */
export function NewPlanButton({ className = "btn btn-primary" }: { className?: string }) {
  const me = useIdentity();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  // Kế hoạch chỉ lưu tên các nơi ghép thành một chuỗi ("Đà Lạt, Nha Trang"), không lưu toạ độ
  const [form, setForm] = useState({ title: "", places: [] as TripPlace[], placeDraft: "", start: "", end: "" });
  const [saving, setSaving] = useState(false);
  const { t } = useI18n();

  if (!canEditPlan(me)) return null;
  const valid = form.title.trim() && (form.places.length > 0 || form.placeDraft.trim()) && form.start;

  async function submit() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const { slug } = await createPlan({
        title: form.title.trim(),
        location: joinPlaces(withDraft(form.places, form.placeDraft)),
        startDate: form.start,
        endDate: form.end || form.start,
      });
      router.push(`/plans/${slug}`);
    } catch (err) {
      toast.show({ tone: "warn", title: t.newPlan.couldntCreate, message: (err as Error).message });
      setSaving(false);
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        <IconPlus size={16} />
        {t.newPlan.button}
      </button>
      <Modal
        open={open}
        onClose={() => !saving && setOpen(false)}
        eyebrow={t.newPlan.eyebrow}
        title={t.newPlan.title}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={() => setOpen(false)} disabled={saving}>
              {t.common.cancel}
            </button>
            <button type="submit" form="new-plan" className="btn btn-primary" disabled={!valid || saving}>
              {saving ? t.newPlan.creating : t.newPlan.create}
            </button>
          </div>
        }
      >
        <form
          id="new-plan"
          className="grid gap-3 p-5 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder={t.newPlan.tripNamePlaceholder}
            className="field sm:col-span-2"
            aria-label={t.newPlan.tripName}
            autoFocus
          />
          <PlacesInput
            className="sm:col-span-2"
            places={form.places}
            draft={form.placeDraft}
            onChange={(places, placeDraft) => setForm({ ...form, places, placeDraft })}
            placeholder={t.newPlan.placesPlaceholder}
            aria-label={t.newPlan.places}
          />
          <DateRangeFields
            className="sm:col-span-2"
            start={form.start}
            end={form.end}
            onChange={({ start, end }) => setForm({ ...form, start, end })}
          />
          <p className="text-sm text-ink-soft sm:col-span-2">
            {t.newPlan.hint}
          </p>
        </form>
      </Modal>
    </>
  );
}
