"use client";

import { useEffect, useRef, useState } from "react";

const DURATION = 900;

/**
 * Số đếm từ 0 lên `value`. SSR + hydrate luôn render giá trị cuối (khỏi lệch hydration, và không JS vẫn đúng số);
 * khi phần tử vào viewport thì mới nhảy về 0 rồi đếm lên một lần, nên chỗ nhảy nằm ngay lúc người dùng bắt đầu nhìn thấy.
 * Bỏ qua hoạt ảnh nếu người dùng chọn giảm chuyển động.
 */
export function CountUp({ value, locale }: { value: number; locale: string }) {
  // null = không chạy hoạt ảnh → hiện thẳng value
  const [step, setStep] = useState<number | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || value <= 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let start = 0;
    const tick = (now: number) => {
      start ||= now;
      const p = Math.min(1, (now - start) / DURATION);
      setStep(p < 1 ? Math.round(value * (1 - (1 - p) ** 3)) : null); // easeOutCubic; xong thì trả về value
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      io.disconnect(); // chỉ chạy một lần
      raf = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      // Reset ở cleanup (không gọi setState thẳng trong thân effect): value đổi giữa lúc đếm thì không kẹt ở giá trị trung gian,
      // và các nhánh return sớm ở trên luôn bắt đầu từ step = null
      setStep(null);
    };
  }, [value]);

  return (
    <span ref={ref} className="tabular-nums">
      {(step ?? value).toLocaleString(locale === "vi" ? "vi-VN" : "en-US")}
    </span>
  );
}
