// Bình luận & cảm xúc trên ảnh — hàm thuần, dùng chung cho server và lightbox.

/** Cảm xúc thả vào ảnh, mỗi người một cái cho mỗi ảnh (schema cũng dùng danh sách này cho ràng buộc CHECK). */
export const REACTIONS = ["❤️", "😂", "😮", "🔥", "👏"] as const;
export type Reaction = (typeof REACTIONS)[number];

export const MAX_COMMENT_LENGTH = 500;

export const isReaction = (s: unknown): s is Reaction => typeof s === "string" && (REACTIONS as readonly string[]).includes(s);

export type ReactionSummary = { emoji: Reaction; count: number; mine: boolean; names: string[] };

/** Gom cảm xúc theo emoji, giữ thứ tự cố định của REACTIONS; bỏ emoji không ai thả. */
export function summarizeReactions(rows: { emoji: string; memberId: string; name: string | null }[], meId: string | null) {
  return REACTIONS.map((emoji): ReactionSummary => {
    const mine = rows.filter((r) => r.emoji === emoji);
    return {
      emoji,
      count: mine.length,
      mine: !!meId && mine.some((r) => r.memberId === meId),
      names: mine.map((r) => r.name ?? "Someone"),
    };
  }).filter((r) => r.count > 0);
}

/** Bỏ khoảng trắng thừa đầu / cuối dòng, gộp nhiều dòng trống; rỗng → "". */
export function cleanComment(s: string) {
  return s
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_COMMENT_LENGTH);
}
