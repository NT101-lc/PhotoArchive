"use client";

import { useCallback, useSyncExternalStore } from "react";

// Chất lượng phát video: người dùng chọn tay thì nhớ trên máy này; chưa chọn thì đoán theo mạng + màn hình.

export type Quality = "720" | "1080";

const KEY = "thesix.video-quality";
const listeners = new Set<() => void>();

type NetworkInfo = { saveData?: boolean; effectiveType?: string; downlink?: number };

/** Mạng tiết kiệm / chậm, hoặc màn hình nhỏ → 720p; còn lại 1080p. */
export function autoQuality(): Quality {
  const c = (navigator as Navigator & { connection?: NetworkInfo }).connection;
  if (c?.saveData) return "720";
  if (c?.effectiveType && ["slow-2g", "2g", "3g"].includes(c.effectiveType)) return "720";
  if (c?.downlink !== undefined && c.downlink < 5) return "720";
  const longSidePx = Math.max(screen.width, screen.height) * (window.devicePixelRatio || 1);
  return longSidePx >= 1600 ? "1080" : "720";
}

function read(): Quality {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "720" || v === "1080") return v;
  } catch {}
  return autoQuality();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useVideoQuality() {
  const value = useSyncExternalStore(subscribe, read, () => "720" as Quality);
  const set = useCallback((q: Quality) => {
    try {
      localStorage.setItem(KEY, q);
    } catch {}
    listeners.forEach((l) => l());
  }, []);
  return { value, set };
}
