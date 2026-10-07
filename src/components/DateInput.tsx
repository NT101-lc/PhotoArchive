"use client";

import { useRef, useState } from "react";
import { dmyToIso, isoToDmy, maskDmy } from "@/lib/format";
import { IconCalendar } from "./Icons";

type Props = {
  /** ISO `YYYY-MM-DD`, rỗng = chưa chọn */
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  required?: boolean;
  "aria-label"?: string;
  /** Thông báo khi ngày gõ vào trước `min` */
  minMessage?: string;
};

const MESSAGES = {
  format: "Type the date as dd/mm/yyyy.",
  required: "Pick a date.",
} as const;

/**
 * Ô ngày hiển thị dd/mm/yyyy, không phụ thuộc ngôn ngữ trình duyệt (input type="date" gốc
 * luôn theo locale máy, thường là mm/dd). Gõ tay (tự chèn "/") hoặc bấm icon để mở lịch gốc.
 */
export function DateInput({ value, onChange, min, required, minMessage = "That date is too early.", "aria-label": ariaLabel }: Props) {
  const [text, setText] = useState(isoToDmy(value));
  const [problem, setProblem] = useState<string | null>(null);
  const pickerRef = useRef<HTMLInputElement>(null);

  // Giá trị đổi từ bên ngoài (chọn lịch, reset form) → hiện lại theo dd/mm/yyyy
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (dmyToIso(text) !== value) setText(isoToDmy(value));
    setProblem(null);
  }

  function commit(next: string) {
    if (!next) {
      setProblem(required ? MESSAGES.required : null);
      if (!required) onChange("");
      return;
    }
    const iso = dmyToIso(next);
    if (!iso) return setProblem(MESSAGES.format);
    if (min && iso < min) return setProblem(minMessage);
    setProblem(null);
    setText(isoToDmy(iso));
    if (iso !== value) onChange(iso);
  }

  return (
    <span className="relative flex flex-col gap-1">
      <span className="relative flex">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="dd/mm/yyyy"
          maxLength={10}
          value={text}
          required={required}
          aria-label={ariaLabel}
          aria-invalid={!!problem}
          onChange={(e) => {
            const next = maskDmy(e.target.value);
            setText(next);
            // Gõ đủ 8 chữ số thì nhận ngay, không cần rời ô
            if (next.length === 10) commit(next);
          }}
          onBlur={() => commit(text)}
          className={`field pr-11 tabular-nums ${problem ? "border-danger" : ""}`}
        />
        <button
          type="button"
          onClick={() => {
            const el = pickerRef.current;
            if (!el) return;
            try {
              el.showPicker();
            } catch {
              el.focus();
            }
          }}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-ink-soft hover:text-ink"
          aria-label="Open calendar"
          tabIndex={-1}
        >
          <IconCalendar size={17} />
        </button>
        {/* Lịch gốc của trình duyệt, ẩn — chỉ dùng để chọn ngày bằng chuột */}
        <input
          ref={pickerRef}
          type="date"
          value={value}
          min={min}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            setProblem(null);
            setText(isoToDmy(e.target.value));
            onChange(e.target.value);
          }}
          className="pointer-events-none absolute right-0 bottom-0 h-full w-10 opacity-0"
        />
      </span>
      {problem && <span className="text-xs text-danger">{problem}</span>}
    </span>
  );
}
