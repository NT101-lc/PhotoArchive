// Luật cho chữ trang About — hàm thuần, dùng chung cho server (lưu) và form sửa (đếm ký tự).

export const ABOUT_LIMITS = { paragraphs: 12, paragraphLength: 1200 } as const;

/** Bỏ khoảng trắng thừa, gộp xuống dòng trong một đoạn thành dấu cách, bỏ đoạn trống. */
export function cleanParagraphs(paragraphs: string[]) {
  return paragraphs
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, ABOUT_LIMITS.paragraphs);
}
