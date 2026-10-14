"use client";

import { useEffect, useState } from "react";

const DURATION = 900;

/**
 * Số đếm từ 0 lên `value`. Render lần đầu (SSR + hydrate) luôn là giá trị cuối để không nháy / lệch hydration;
 * chỉ sau khi mount mới chạy hoạt ảnh, và bỏ qua nếu người dùng chọn giảm chuyển động.
 */
export function CountUp({ value, locale }: { value: number; locale: string }) {
  // null = chưa/không chạy hoạt ảnh → hiện thẳng value (cũng đúng khi value đổi mà đang giảm chuyển động)
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    if (value <= 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let start = 0;
    const tick = (now: number) => {
      start ||= now;
      const p = Math.min(1, (now - start) / DURATION);
      setStep(p < 1 ? Math.round(value * (1 - (1 - p) ** 3)) : null); // easeOutCubic; xong thì trả về value
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <span className="tabular-nums">{(step ?? value).toLocaleString(locale === "vi" ? "vi-VN" : "en-US")}</span>;
}
