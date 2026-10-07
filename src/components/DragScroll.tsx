"use client";

import { useRef, type ComponentProps, type PointerEvent } from "react";

/** Kéo quá chừng này px thì coi là kéo, không phải bấm */
const DRAG_THRESHOLD = 5;

/**
 * Danh sách cuộn ngang kéo được bằng chuột (bấm giữ rồi kéo, như trên điện thoại).
 * Cảm ứng vẫn dùng cuộn gốc của trình duyệt. Trong lúc kéo tắt snap; kéo xong thì chặn cú click vào link.
 */
export function DragScroll({ className = "", children, ...rest }: ComponentProps<"ol">) {
  const ref = useRef<HTMLOListElement>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);

  const onPointerDown = (e: PointerEvent<HTMLOListElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || !ref.current) return;
    drag.current = { x: e.clientX, left: ref.current.scrollLeft, moved: false };
  };

  const onPointerMove = (e: PointerEvent<HTMLOListElement>) => {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el) return;
    const dx = e.clientX - d.x;
    if (!d.moved) {
      if (Math.abs(dx) < DRAG_THRESHOLD) return;
      d.moved = true;
      el.setPointerCapture(e.pointerId);
      el.style.scrollSnapType = "none";
      el.style.cursor = "grabbing";
    }
    el.scrollLeft = d.left - dx;
  };

  const end = (e: PointerEvent<HTMLOListElement>) => {
    const el = ref.current;
    if (!drag.current || !el) return;
    if (drag.current.moved) {
      el.releasePointerCapture(e.pointerId);
      el.style.cursor = "";
      // Bật lại snap rồi để trình duyệt tự trượt tới khung gần nhất
      const left = el.scrollLeft;
      el.style.scrollSnapType = "";
      el.scrollLeft = left;
    }
    // Giữ cờ "moved" tới sau sự kiện click
    setTimeout(() => (drag.current = null));
  };

  return (
    <ol
      ref={ref}
      {...rest}
      className={`cursor-grab select-none ${className}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onDragStart={(e) => e.preventDefault()}
      onClickCapture={(e) => {
        if (drag.current?.moved) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      {children}
    </ol>
  );
}
