"use client";

import { tripDays } from "@/lib/format";
import { DateInput } from "./DateInput";

/**
 * Ngày đi + ngày về (hiển thị dd/mm/yyyy). Ngày về để trống = đi trong ngày.
 * Đổi ngày đi sang sau ngày về → ngày về bị xoá để khoảng ngày luôn hợp lệ.
 */
export function DateRangeFields({
  start,
  end,
  onChange,
  className = "",
}: {
  start: string;
  end: string;
  onChange: (range: { start: string; end: string }) => void;
  className?: string;
}) {
  const days = start && end ? tripDays(start, end) : 1;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-ink-soft">First day</span>
          <DateInput
            value={start}
            required
            onChange={(next) => onChange({ start: next, end: end && next && end < next ? "" : end })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-ink-soft">Last day (optional)</span>
          <DateInput
            value={end}
            min={start || undefined}
            minMessage="The last day can’t be before the first day."
            onChange={(next) => onChange({ start, end: next })}
          />
        </label>
      </div>
      <p className="flex items-center gap-2 text-xs text-ink-soft" aria-live="polite">
        {days > 1 ? `${days}-day trip` : "Day trip"}
        {end && (
          <button type="button" onClick={() => onChange({ start, end: "" })} className="font-semibold underline hover:text-accent">
            Make it a day trip
          </button>
        )}
      </p>
    </div>
  );
}
