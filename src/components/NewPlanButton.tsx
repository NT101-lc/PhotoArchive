"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createPlan } from "@/lib/api-client";
import { canEditPlan } from "@/lib/permissions";
import { DateRangeFields } from "./DateRangeFields";
import { IconPlus } from "./Icons";
import { useIdentity } from "./Identity";
import { Modal } from "./Modal";
import { useToast } from "./Toast";

/** Nút "New plan" + form ngắn (tên, nơi, ngày đi / về). Tạo xong mở thẳng bảng kế hoạch. */
export function NewPlanButton({ className = "btn btn-primary" }: { className?: string }) {
  const me = useIdentity();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", location: "", start: "", end: "" });
  const [saving, setSaving] = useState(false);

  if (!canEditPlan(me)) return null;
  const valid = form.title.trim() && form.location.trim() && form.start;

  async function submit() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const { slug } = await createPlan({
        title: form.title.trim(),
        location: form.location.trim(),
        startDate: form.start,
        endDate: form.end || form.start,
      });
      router.push(`/plans/${slug}`);
    } catch (err) {
      toast.show({ tone: "warn", title: "Couldn’t create the plan", message: (err as Error).message });
      setSaving(false);
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        <IconPlus size={16} />
        New plan
      </button>
      <Modal
        open={open}
        onClose={() => !saving && setOpen(false)}
        eyebrow="Planner"
        title="Plan a trip"
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="new-plan" className="btn btn-primary" disabled={!valid || saving}>
              {saving ? "Creating…" : "Create plan"}
            </button>
          </div>
        }
      >
        <form
          id="new-plan"
          className="grid gap-3 p-5 sm:grid-cols-[3fr_2fr]"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Trip name, e.g. Đà Lạt for Tết"
            className="field"
            aria-label="Trip name"
            autoFocus
          />
          <input
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="Place, e.g. Đà Lạt"
            className="field"
            aria-label="Place"
          />
          <DateRangeFields
            className="sm:col-span-2"
            start={form.start}
            end={form.end}
            onChange={({ start, end }) => setForm({ ...form, start, end })}
          />
          <p className="text-sm text-ink-soft sm:col-span-2">
            You get a sheet with one column per day. Everyone in the crew can fill it in.
          </p>
        </form>
      </Modal>
    </>
  );
}
