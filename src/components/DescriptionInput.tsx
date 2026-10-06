"use client";

import type { TextareaHTMLAttributes } from "react";
import { MAX_DESCRIPTION_LENGTH } from "@/lib/format";

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & {
  value: string;
  onChange: (v: string) => void;
};

/** Ô mô tả chuyến đi (không bắt buộc), hiện số ký tự còn lại khi gần chạm giới hạn. Dùng cho form sửa và form tạo album. */
export function DescriptionInput({ value, onChange, className = "", ...props }: Props) {
  const left = MAX_DESCRIPTION_LENGTH - value.length;
  return (
    <>
      <textarea
        rows={3}
        placeholder="What happened on this trip? Who came, where you stayed, the moment you’ll remember."
        {...props}
        className={`field h-auto min-h-[96px] resize-y py-2.5 leading-relaxed ${className}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={MAX_DESCRIPTION_LENGTH}
      />
      {left <= 100 && <span className="self-end text-xs text-ink-soft tabular-nums">{left} characters left</span>}
    </>
  );
}
