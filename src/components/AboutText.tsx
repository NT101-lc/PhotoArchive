"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { ABOUT_LIMITS, cleanParagraphs } from "@/lib/about-text";
import { updateAbout } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { canEditAbout } from "@/lib/permissions";
import { IconEdit, IconPlus, IconTrash } from "./Icons";
import { useIdentity } from "./Identity";
import { useToast } from "./Toast";

type Props = { paragraphs: string[]; updatedAt: string | null; updatedBy: string | null };

type Draft = { id: number; text: string };

/**
 * Các đoạn chữ của trang About. Thành viên đã chọn tên bấm "Edit text" để sửa ngay tại chỗ:
 * mỗi đoạn một ô, thêm / xoá đoạn, Ctrl+Enter để lưu, Esc để huỷ.
 */
export function AboutText({ paragraphs, updatedAt, updatedBy }: Props) {
  const me = useIdentity();
  const toast = useToast();
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [saving, setSaving] = useState(false);
  const nextId = useRef(0);
  // Ô vừa mở / vừa thêm thì được focus
  const [focusId, setFocusId] = useState<number | null>(null);

  const editing = drafts !== null;
  const canEdit = canEditAbout(me);

  function startEditing() {
    const list = paragraphs.map((text) => ({ id: nextId.current++, text }));
    setFocusId(list[0]?.id ?? null);
    setDrafts(list);
  }

  function addParagraph() {
    const id = nextId.current++;
    setFocusId(id);
    setDrafts((d) => [...(d ?? []), { id, text: "" }]);
  }

  async function save() {
    if (!drafts || saving) return;
    const next = cleanParagraphs(drafts.map((d) => d.text));
    if (next.join("\n") === paragraphs.join("\n")) {
      setDrafts(null);
      return;
    }
    setSaving(true);
    try {
      await updateAbout(next);
      toast.show({ tone: "success", title: "About page saved" });
      setDrafts(null);
      router.refresh();
    } catch (err) {
      toast.show({ tone: "warn", title: "Couldn’t save the About page", message: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      save();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDrafts(null);
    }
  }

  if (!editing) {
    return (
      <div className="flex flex-col gap-5">
        {paragraphs.map((p, i) => (
          <p
            key={i}
            className={
              i === 0
                ? "text-[1.3rem] leading-[1.55] font-medium text-pretty text-ink sm:text-[1.45rem]"
                : "text-[1.05rem] leading-relaxed text-pretty text-ink-soft"
            }
          >
            {p}
          </p>
        ))}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-dashed border-line pt-4 text-sm text-ink-soft">
          <span>
            {updatedBy && updatedAt ? (
              <>
                Last edited by <b className="font-semibold text-ink">{updatedBy}</b>, {formatDate(updatedAt)}
              </>
            ) : (
              "Written by the crew. Anyone in it can edit this."
            )}
          </span>
          {canEdit && (
            <button type="button" onClick={startEditing} className="btn ml-auto h-9">
              <IconEdit size={15} />
              Edit text
            </button>
          )}
        </div>
      </div>
    );
  }

  const full = drafts.length >= ABOUT_LIMITS.paragraphs;

  return (
    <form
      className="flex flex-col gap-4"
      onKeyDown={onKeyDown}
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      aria-label="Edit the About text"
    >
      <ol className="flex flex-col gap-3">
        {drafts.map((d, i) => (
          <li key={d.id} className="group grid grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-2">
            <span className="frame-no pt-3 text-right text-[0.75rem]" aria-hidden="true">
              {i + 1}
            </span>
            <AutoGrowArea
              value={d.text}
              autoFocus={focusId === d.id}
              lead={i === 0}
              aria-label={`Paragraph ${i + 1}`}
              onChange={(text) => setDrafts((list) => list!.map((x) => (x.id === d.id ? { ...x, text } : x)))}
            />
            <button
              type="button"
              onClick={() => setDrafts((list) => list!.filter((x) => x.id !== d.id))}
              className="mt-1.5 rounded-md p-2 text-ink-soft hover:bg-surface-2 hover:text-danger"
              aria-label={`Remove paragraph ${i + 1}`}
              title="Remove paragraph"
            >
              <IconTrash size={17} />
            </button>
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={addParagraph}
        disabled={full}
        className="ml-10 flex h-11 items-center justify-center gap-1.5 rounded-lg border border-dashed border-ink-soft/50 text-sm font-semibold text-ink-soft hover:border-accent hover:text-accent disabled:opacity-45"
      >
        <IconPlus size={16} />
        {full ? `Up to ${ABOUT_LIMITS.paragraphs} paragraphs` : "Add paragraph"}
      </button>

      <div className="sticky bottom-3 z-10 ml-10 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface/95 p-2 pl-4 shadow-[var(--shadow-hard)] backdrop-blur">
        <span className="text-sm text-ink-soft max-sm:hidden">Ctrl+Enter to save, Esc to cancel. Empty paragraphs are dropped.</span>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => setDrafts(null)} disabled={saving} className="btn">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}

/** Ô chữ tự cao theo nội dung; đoạn đầu chữ to như khi hiển thị. */
function AutoGrowArea({
  value,
  onChange,
  lead,
  autoFocus,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  lead: boolean;
  autoFocus: boolean;
  "aria-label": string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);

  const left = ABOUT_LIMITS.paragraphLength - value.length;
  return (
    <span className="flex flex-col gap-1">
      <textarea
        ref={ref}
        rows={2}
        value={value}
        autoFocus={autoFocus}
        maxLength={ABOUT_LIMITS.paragraphLength}
        aria-label={ariaLabel}
        placeholder="Write a paragraph…"
        onChange={(e) => onChange(e.target.value)}
        className={`field h-auto resize-none overflow-hidden py-2.5 ${
          lead ? "text-[1.15rem] leading-[1.55] font-medium sm:text-[1.25rem]" : "text-[1.02rem] leading-relaxed"
        }`}
      />
      {left <= 150 && <span className="self-end text-xs text-ink-soft tabular-nums">{left} characters left</span>}
    </span>
  );
}
