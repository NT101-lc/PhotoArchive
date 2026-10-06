"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { IconClose } from "./Icons";

/** Khoá scroll của body khi overlay đang mở. */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);
}

type Props = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
};

/** Modal: bottom sheet trên mobile, hộp giữa màn hình trên desktop. */
export function Modal({ open, onClose, title, eyebrow, children, footer, maxWidth = "max-w-[560px]" }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useBodyScrollLock(open);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Chỉ chạy khi mở/đóng, để không giật focus mỗi lần component cha re-render
  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prevFocus?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="animate-fade fixed inset-0 z-[1000] flex items-end justify-center bg-veil backdrop-blur-[2px] sm:items-center sm:p-5"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`animate-rise flex max-h-[92dvh] w-full flex-col rounded-t-2xl border-2 border-line bg-surface shadow-hard-lg sm:max-h-[88vh] sm:rounded-2xl ${maxWidth}`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b-2 border-dashed border-line px-5 pt-4 pb-3.5">
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow mb-0.5">{eyebrow}</p>}
            <h2 className="font-display text-xl leading-tight font-extrabold tracking-tight">{title}</h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="btn btn-icon h-9 w-9 shrink-0" aria-label="Đóng">
            <IconClose size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="shrink-0 rounded-b-2xl border-t-2 border-line bg-surface-2/60 px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}
