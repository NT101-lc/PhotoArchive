// Planner chuyến đi — hàm thuần, dùng chung cho server và bảng tính phía trình duyệt.

import type { PlanItem, PlanSlot } from "@/db/schema";

export type { PlanItem, PlanSlot };

export const PLAN_LIMITS = {
  /** Chuyến dài nhất (số cột của bảng lịch trình) */
  days: 21,
  slots: 12,
  items: 100,
  cellLength: 500,
  textLength: 300,
} as const;

/** Mỗi kế hoạch mới bắt đầu với 4 buổi trong ngày. */
export function defaultSlots(): PlanSlot[] {
  return [
    { id: "s1", label: "Morning", time: "8:00" },
    { id: "s2", label: "Noon", time: "12:00" },
    { id: "s3", label: "Afternoon", time: "15:00" },
    { id: "s4", label: "Evening", time: "19:00" },
  ];
}

/** Các ngày của chuyến, `YYYY-MM-DD`, tính cả ngày đầu và cuối. */
export function planDays(startDate: string, endDate: string) {
  const days: string[] = [];
  const end = Date.parse(`${endDate}T00:00:00Z`);
  for (let t = Date.parse(`${startDate}T00:00:00Z`); t <= end && days.length < PLAN_LIMITS.days; t += 86_400_000) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days;
}

export const cellKey = (day: string, slotId: string) => `${day}|${slotId}`;

/** Tổng chi phí và chia đều cho người đi (làm tròn lên nghìn đồng). */
export function planTotals(items: PlanItem[], goingCount: number) {
  const total = items.reduce((s, i) => s + (i.cost ?? 0), 0);
  const perPerson = goingCount > 0 ? Math.ceil(total / goingCount / 1000) * 1000 : null;
  return { total, perPerson };
}

const vnd = new Intl.NumberFormat("vi-VN");
/** `1500000` → `1.500.000 ₫` */
export function formatVnd(n: number) {
  return `${vnd.format(n)} ₫`;
}

/** Ô tiền gõ tự do: `1.500.000`, `1,5tr`, `200k`, `1.5m` → số đồng; không hiểu được → null. */
export function parseVnd(text: string): number | null {
  const s = text.trim().toLowerCase().replace(/\s|₫|đ|vnd/g, "");
  if (!s) return null;
  const m = s.match(/^(\d+(?:[.,]\d+)?)(k|tr|m|triệu)?$/);
  if (m) {
    const [, num, unit] = m;
    if (unit) {
      const value = Number(num.replace(",", "."));
      return Math.round(value * (unit === "k" ? 1_000 : 1_000_000));
    }
  }
  // Không đơn vị: dấu . và , chỉ là phân cách hàng nghìn
  const digits = s.replace(/[.,]/g, "");
  return /^\d+$/.test(digits) ? Number(digits) : null;
}

/** Số ngày từ hôm nay (giờ VN) tới ngày đi; âm nếu đã qua. */
export function daysUntil(startDate: string, now = Date.now()) {
  const today = new Date(now + 7 * 3_600_000).toISOString().slice(0, 10);
  return Math.round((Date.parse(startDate) - Date.parse(today)) / 86_400_000);
}
