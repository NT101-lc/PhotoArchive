"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

// Ảnh yêu thích lưu tạm ở localStorage của từng máy.
// Khi có backend, thay bằng API (yêu thích theo tài khoản) mà không đổi chữ ký hook.

const KEY = "b6-favorites";
const EVENT = "b6-favorites-change";

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

export function useFavorites() {
  // Snapshot là chuỗi thô → ổn định giữa các lần gọi; server luôn trả rỗng
  const raw = useSyncExternalStore(subscribe, read, () => "[]");
  const ids = useMemo(() => {
    try {
      return new Set<string>(JSON.parse(raw));
    } catch {
      return new Set<string>();
    }
  }, [raw]);

  const toggle = useCallback((id: string) => {
    const next = new Set<string>(JSON.parse(read()));
    if (next.has(id)) next.delete(id);
    else next.add(id);
    try {
      localStorage.setItem(KEY, JSON.stringify([...next]));
    } catch {}
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { ids, has: (id: string) => ids.has(id), toggle };
}
