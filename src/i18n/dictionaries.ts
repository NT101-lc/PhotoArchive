import type { Locale } from "./config";
import { en, type Dict } from "./en";
import { vi } from "./vi";

// Cả hai từ điển đều nhỏ (vài KB) nên tải cùng nhau, kể cả ở trình duyệt: đổi ngôn ngữ không phải chờ.
export const dictionaries: Record<Locale, Dict> = { en, vi };

export type { Dict };
