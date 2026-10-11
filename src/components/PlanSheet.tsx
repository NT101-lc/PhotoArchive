"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { deletePlan, getPlan, patchPlan } from "@/lib/api-client";
import { canDeletePlan, canEditPlan } from "@/lib/permissions";
import {
  cellKey,
  formatVnd,
  parseVnd,
  PLAN_LIMITS,
  planDays,
  planTotals,
  type PlanItem,
  type PlanSlot,
} from "@/lib/plan-utils";
import type { Crewmate, Plan } from "@/lib/plans";
import { Avatar } from "./Avatar";
import { ConfirmDialog } from "./ConfirmDialog";
import { IconCheck, IconClose, IconPlus, IconTrash } from "./Icons";
import { useIdentity } from "./Identity";
import { useToast } from "./Toast";
import { useI18n } from "@/i18n/client";
import { INTL_LOCALE } from "@/i18n/config";

/** Hỏi lại server định kỳ để thấy người khác sửa. */
const POLL_MS = 8000;

const newId = () => Math.random().toString(36).slice(2, 10);

type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Bảng kế hoạch chuyến đi, sửa trực tiếp như bảng tính:
 * ai đi (join / leave), lịch trình ngày × buổi (mỗi ô một textarea), việc cần làm & chi phí.
 * Mỗi lần sửa gửi một thao tác nhỏ lên server; trong lúc không ai đang gõ thì tự cập nhật bản mới.
 */
export function PlanSheet({ initial, crew }: { initial: Plan; crew: Crewmate[] }) {
  const me = useIdentity();
  const toast = useToast();
  const { t, locale } = useI18n();
  // Tiêu đề cột ngày: en "Sat 20 Dec", vi "Th 7, 20 thg 12"
  const dayFmt = new Intl.DateTimeFormat(INTL_LOCALE[locale], { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const router = useRouter();
  const [plan, setPlan] = useState(initial);
  const [save, setSave] = useState<SaveState>("idle");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pending = useRef(0);

  const canEdit = canEditPlan(me);
  const days = planDays(plan.startDate, plan.endDate);
  const byId = new Map(crew.map((c) => [c.id, c]));
  const going = plan.going.map((id) => byId.get(id)).filter((c): c is Crewmate => !!c);
  const imGoing = !!me && plan.going.includes(me.id);

  /** Gửi một thao tác; `apply` = có lấy bản server trả về thay cho bản đang có không. */
  const send = useCallback(
    async (op: Record<string, unknown>, apply = false) => {
      pending.current++;
      setSave("saving");
      try {
        const next = await patchPlan<Plan>(plan.slug, op);
        if (apply) setPlan(next);
        setSave("saved");
      } catch (err) {
        setSave("error");
        toast.show({ tone: "warn", title: t.sheet.couldntSave, message: (err as Error).message });
      } finally {
        pending.current--;
      }
    },
    [plan.slug, toast, t],
  );

  // Hỏi lại định kỳ; bỏ qua khi đang gõ trong bảng hoặc còn thao tác chưa lưu xong
  useEffect(() => {
    const tick = async () => {
      if (document.hidden || pending.current > 0) return;
      if (rootRef.current?.contains(document.activeElement) && document.activeElement !== document.body) {
        const tag = document.activeElement?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      }
      try {
        const next = await getPlan<Plan>(plan.slug);
        if (pending.current === 0) setPlan((cur) => (cur.updatedAt === next.updatedAt ? cur : next));
      } catch {
        // mạng chập chờn: thử lại lần sau
      }
    };
    const id = setInterval(tick, POLL_MS);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", tick);
    };
  }, [plan.slug]);

  // ---- Ô lịch trình ----
  function setCell(key: string, value: string) {
    if ((plan.cells[key] ?? "") === value.trim()) return;
    setPlan((p) => {
      const cells = { ...p.cells };
      if (value.trim()) cells[key] = value.trim();
      else delete cells[key];
      return { ...p, cells };
    });
    send({ op: "cell", key, value });
  }

  // ---- Buổi (dòng của lịch trình) ----
  function setSlots(slots: PlanSlot[]) {
    setPlan((p) => ({ ...p, slots }));
    send({ op: "slots", slots });
  }

  // ---- Việc cần làm & chi phí: gom các lần gõ liên tiếp rồi gửi cả danh sách ----
  const itemsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function setItems(items: PlanItem[], now = false) {
    setPlan((p) => ({ ...p, items }));
    if (itemsTimer.current) clearTimeout(itemsTimer.current);
    if (now) send({ op: "items", items });
    else itemsTimer.current = setTimeout(() => send({ op: "items", items }), 700);
  }

  const totals = planTotals(plan.items, going.length);

  return (
    <div ref={rootRef} className="flex flex-col gap-12">
      {/* ---------- Ai đi ---------- */}
      <section aria-labelledby="going-title" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3">
          <h2 id="going-title" className="font-display text-xl font-extrabold tracking-[-0.02em]">
            {t.sheet.whosGoing} <span className="text-ink-soft tabular-nums">{going.length}</span>
          </h2>
          {going.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {going.map((c) => (
                <li key={c.id} className="tag h-8 gap-2 py-0 pr-3 pl-1 text-sm">
                  <Avatar name={c.name} url={c.avatarUrl} size={24} />
                  {c.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-soft">{t.sheet.nobodyYet}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <SaveIndicator state={save} />
          {canEdit &&
            (imGoing ? (
              <button type="button" className="btn" onClick={() => send({ op: "leave" }, true)}>
                <IconClose size={15} />
                {t.sheet.cantMakeIt}
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => send({ op: "join" }, true)}>
                <IconCheck size={15} />
                {t.sheet.imIn}
              </button>
            ))}
        </div>
      </section>

      {/* ---------- Lịch trình ---------- */}
      <section aria-labelledby="itinerary-title" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="itinerary-title" className="font-display text-xl font-extrabold tracking-[-0.02em]">
            {t.sheet.itinerary}
          </h2>
          <span className="text-sm text-ink-soft max-sm:hidden">{t.sheet.itineraryHint}</span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-line bg-surface shadow-[var(--shadow-hard-sm)]">
          <table className="sheet w-full min-w-max border-collapse text-sm">
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 w-36 bg-film px-3 py-2 text-left font-semibold text-white/70">
                  {t.sheet.time}
                </th>
                {days.map((d, i) => (
                  <th key={d} scope="col" className="min-w-[190px] bg-film px-3 py-2 text-left font-semibold text-white">
                    <span className="frame-no mr-2 text-[0.7rem]">{t.sheet.day(i + 1)}</span>
                    {dayFmt.format(new Date(`${d}T00:00:00Z`))}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plan.slots.map((slot, r) => (
                <tr key={slot.id}>
                  <th scope="row" className="group sticky left-0 z-10 bg-surface-2 p-0 text-left align-top font-normal">
                    <SlotHeader
                      slot={slot}
                      disabled={!canEdit}
                      canRemove={plan.slots.length > 1}
                      onChange={(next) => setSlots(plan.slots.map((s) => (s.id === slot.id ? next : s)))}
                      onRemove={() => setSlots(plan.slots.filter((s) => s.id !== slot.id))}
                    />
                  </th>
                  {days.map((d, c) => {
                    const key = cellKey(d, slot.id);
                    return (
                      <td key={key} className="p-0 align-top">
                        <Cell
                          value={plan.cells[key] ?? ""}
                          disabled={!canEdit}
                          label={t.sheet.cellLabel(slot.label, c + 1)}
                          row={r}
                          col={c}
                          onCommit={(v) => setCell(key, v)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canEdit && plan.slots.length < PLAN_LIMITS.slots && (
          <button
            type="button"
            className="btn self-start"
            onClick={() => setSlots([...plan.slots, { id: newId(), label: "", time: "" }])}
          >
            <IconPlus size={15} />
            {t.sheet.addRow}
          </button>
        )}
      </section>

      {/* ---------- Việc cần làm & chi phí ---------- */}
      <section aria-labelledby="items-title" className="flex flex-col gap-3">
        <h2 id="items-title" className="font-display text-xl font-extrabold tracking-[-0.02em]">
          {t.sheet.todoCosts}
        </h2>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface shadow-[var(--shadow-hard-sm)]">
          <table className="sheet w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="bg-film text-left text-white">
                <th scope="col" className="w-11 px-3 py-2 font-semibold">
                  <span className="sr-only">{t.sheet.done}</span>
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">{t.sheet.item}</th>
                <th scope="col" className="w-40 px-3 py-2 font-semibold">{t.sheet.who}</th>
                <th scope="col" className="w-36 px-3 py-2 text-right font-semibold">{t.sheet.cost}</th>
                <th scope="col" className="px-3 py-2 font-semibold">{t.sheet.note}</th>
                <th scope="col" className="w-11">
                  <span className="sr-only">{t.sheet.remove}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {plan.items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  crew={crew}
                  disabled={!canEdit}
                  onChange={(next, now) => setItems(plan.items.map((i) => (i.id === item.id ? next : i)), now)}
                  onRemove={() => setItems(plan.items.filter((i) => i.id !== item.id), true)}
                />
              ))}
              {plan.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-ink-soft">
                    {t.sheet.itemsEmpty}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-surface-2 font-semibold">
                <td />
                <td className="px-3 py-2.5" colSpan={2}>
                  {t.sheet.total}
                  {totals.perPerson !== null && (
                    <span className="ml-2 font-normal text-ink-soft">
                      {t.sheet.perPerson(formatVnd(totals.perPerson), going.length)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatVnd(totals.total)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
        {canEdit && plan.items.length < PLAN_LIMITS.items && (
          <button
            type="button"
            className="btn self-start"
            onClick={() =>
              setItems([...plan.items, { id: newId(), done: false, text: "", who: null, cost: null, note: "" }], true)
            }
          >
            <IconPlus size={15} />
            {t.sheet.addRow}
          </button>
        )}
      </section>

      {canDeletePlan(me, plan) && (
        <div className="border-t border-dashed border-line pt-6">
          <button type="button" className="btn text-danger" onClick={() => setConfirmDelete(true)}>
            <IconTrash size={15} />
            {t.sheet.deletePlan}
          </button>
          <ConfirmDialog
            open={confirmDelete}
            title={t.sheet.deleteTitle(plan.title)}
            confirmLabel={t.sheet.deletePlan}
            onClose={() => setConfirmDelete(false)}
            onConfirm={async () => {
              try {
                await deletePlan(plan.slug);
                toast.show({ tone: "success", title: t.sheet.deleted });
                router.push("/plans");
                router.refresh();
              } catch (err) {
                toast.show({ tone: "warn", title: t.sheet.couldntDelete, message: (err as Error).message });
              }
            }}
          >
            {t.sheet.deleteBody}
          </ConfirmDialog>
        </div>
      )}
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const { t } = useI18n();
  if (state === "idle") return null;
  const text = { saving: t.sheet.saving, saved: t.sheet.saved, error: t.sheet.notSaved }[state];
  return (
    <span className={`text-sm ${state === "error" ? "text-danger" : "text-ink-soft"}`} aria-live="polite">
      {text}
    </span>
  );
}

/** Ô lịch trình: textarea tự cao. Lưu khi rời ô; Enter xuống ô dưới, Esc huỷ phần vừa gõ. */
function Cell({
  value,
  disabled,
  label,
  row,
  col,
  onCommit,
}: {
  value: string;
  disabled: boolean;
  label: string;
  row: number;
  col: number;
  onCommit: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  // Bản mới từ server (người khác sửa) → cập nhật nếu mình không đang gõ ô này
  if (value !== lastValue) {
    setLastValue(value);
    if (!focused) setDraft(value);
  }

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 64)}px`;
  }, [draft]);

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const below = document.querySelector<HTMLTextAreaElement>(`[data-cell="${row + 1}:${col}"]`);
      if (below) below.focus();
      else e.currentTarget.blur();
    } else if (e.key === "Escape") {
      setDraft(value);
      e.currentTarget.blur();
    }
  }

  return (
    <textarea
      ref={ref}
      data-cell={`${row}:${col}`}
      value={draft}
      disabled={disabled}
      aria-label={label}
      rows={2}
      maxLength={PLAN_LIMITS.cellLength}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        onCommit(draft);
      }}
      onKeyDown={onKeyDown}
      className="block w-full resize-none overflow-hidden bg-transparent px-3 py-2.5 leading-snug outline-none placeholder:text-ink-soft/40 focus:bg-accent/[0.06] focus:shadow-[inset_0_0_0_2px_var(--accent)] disabled:cursor-default"
    />
  );
}

/** Cột đầu của một dòng lịch trình: tên buổi + giờ, sửa tại chỗ; nút xoá hiện khi rê chuột. */
function SlotHeader({
  slot,
  disabled,
  canRemove,
  onChange,
  onRemove,
}: {
  slot: PlanSlot;
  disabled: boolean;
  canRemove: boolean;
  onChange: (s: PlanSlot) => void;
  onRemove: () => void;
}) {
  const [label, setLabel] = useState(slot.label);
  const [time, setTime] = useState(slot.time);
  const { t } = useI18n();
  const [last, setLast] = useState(slot);
  if (slot !== last) {
    setLast(slot);
    setLabel(slot.label);
    setTime(slot.time);
  }
  const commit = () => {
    if (label.trim() !== slot.label || time.trim() !== slot.time) onChange({ ...slot, label: label.trim(), time: time.trim() });
  };

  return (
    <div className="relative flex flex-col px-3 py-2">
      <input
        value={label}
        disabled={disabled}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        placeholder={t.sheet.slot}
        aria-label={t.sheet.slotName}
        maxLength={40}
        className="w-full bg-transparent font-semibold outline-none placeholder:text-ink-soft/50 focus:text-accent"
      />
      <input
        value={time}
        disabled={disabled}
        onChange={(e) => setTime(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        placeholder={t.sheet.time}
        aria-label={t.sheet.time}
        maxLength={20}
        className="w-full bg-transparent text-xs text-ink-soft tabular-nums outline-none placeholder:text-ink-soft/50 focus:text-accent"
      />
      {!disabled && canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-1.5 right-1.5 rounded p-1 text-ink-soft opacity-0 group-hover:opacity-100 hover:text-danger focus-visible:opacity-100"
          aria-label={t.sheet.removeRowOf(slot.label)}
          title={t.sheet.removeRow}
        >
          <IconTrash size={14} />
        </button>
      )}
    </div>
  );
}

/** Một dòng việc cần làm: tick xong, nội dung, ai lo, chi phí (gõ 200k, 1,5tr...), ghi chú. */
function ItemRow({
  item,
  crew,
  disabled,
  onChange,
  onRemove,
}: {
  item: PlanItem;
  crew: Crewmate[];
  disabled: boolean;
  onChange: (item: PlanItem, now?: boolean) => void;
  onRemove: () => void;
}) {
  const [costText, setCostText] = useState(item.cost === null ? "" : formatVnd(item.cost));
  const { t } = useI18n();
  const [lastCost, setLastCost] = useState(item.cost);
  if (item.cost !== lastCost) {
    setLastCost(item.cost);
    setCostText(item.cost === null ? "" : formatVnd(item.cost));
  }
  const field = "w-full bg-transparent px-3 py-2.5 outline-none focus:bg-accent/[0.06] focus:shadow-[inset_0_0_0_2px_var(--accent)]";

  return (
    <tr className={`group ${item.done ? "text-ink-soft" : ""}`}>
      <td className="px-3 text-center">
        <input
          type="checkbox"
          checked={item.done}
          disabled={disabled}
          onChange={(e) => onChange({ ...item, done: e.target.checked }, true)}
          aria-label={t.sheet.markDone(item.text)}
          className="h-4 w-4 accent-[var(--accent)]"
        />
      </td>
      <td className="p-0">
        <input
          value={item.text}
          disabled={disabled}
          onChange={(e) => onChange({ ...item, text: e.target.value })}
          placeholder={t.sheet.itemPlaceholder}
          aria-label={t.sheet.item}
          maxLength={PLAN_LIMITS.textLength}
          className={`${field} ${item.done ? "line-through" : ""}`}
        />
      </td>
      <td className="p-0">
        <select
          value={item.who ?? ""}
          disabled={disabled}
          onChange={(e) => onChange({ ...item, who: e.target.value || null }, true)}
          aria-label={t.sheet.whoHandles}
          className={`${field} cursor-pointer`}
        >
          <option value="">{t.sheet.anyone}</option>
          {crew.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </td>
      <td className="p-0">
        <input
          value={costText}
          disabled={disabled}
          inputMode="decimal"
          onChange={(e) => setCostText(e.target.value)}
          onFocus={() => setCostText(item.cost === null ? "" : String(item.cost))}
          onBlur={() => {
            const cost = parseVnd(costText);
            setCostText(cost === null ? "" : formatVnd(cost));
            if (cost !== item.cost) onChange({ ...item, cost }, true);
          }}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          placeholder="200k"
          aria-label={t.sheet.cost}
          className={`${field} text-right tabular-nums`}
        />
      </td>
      <td className="p-0">
        <input
          value={item.note}
          disabled={disabled}
          onChange={(e) => onChange({ ...item, note: e.target.value })}
          placeholder="—"
          aria-label={t.sheet.note}
          maxLength={PLAN_LIMITS.textLength}
          className={field}
        />
      </td>
      <td className="px-1 text-center">
        {!disabled && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded p-1.5 text-ink-soft opacity-0 group-hover:opacity-100 hover:text-danger focus-visible:opacity-100 max-sm:opacity-100"
            aria-label={t.sheet.removeItem(item.text)}
          >
            <IconTrash size={15} />
          </button>
        )}
      </td>
    </tr>
  );
}
