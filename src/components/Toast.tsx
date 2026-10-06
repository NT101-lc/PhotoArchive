"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { IconClose } from "./Icons";

type ToastTone = "info" | "warn" | "success";
type Toast = { id: number; title: string; message?: string; tone: ToastTone };

type ToastApi = { show: (t: Omit<Toast, "id" | "tone"> & { tone?: ToastTone }) => void };

const ToastContext = createContext<ToastApi | null>(null);

const TONE_DOT: Record<ToastTone, string> = {
  info: "bg-sky",
  warn: "bg-accent",
  success: "bg-teal",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback<ToastApi["show"]>(
    ({ tone = "info", ...rest }) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-2), { id, tone, ...rest }]);
      setTimeout(() => dismiss(id), 4200);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[2000] flex flex-col items-center gap-2.5 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="animate-rise pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border-2 border-line bg-ink py-3 pr-2 pl-4 text-bg shadow-hard"
          >
            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${TONE_DOT[t.tone]}`} />
            <div className="flex-1">
              <p className="font-display font-bold">{t.title}</p>
              {t.message && <p className="mt-0.5 text-sm opacity-75">{t.message}</p>}
            </div>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Đóng thông báo" className="rounded-md p-1 opacity-70 hover:opacity-100">
              <IconClose size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast phải nằm trong <ToastProvider>");
  return ctx;
}
