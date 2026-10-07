import { NextResponse } from "next/server";
import { handle, json } from "@/lib/api";
import { getOriginalDownload } from "@/lib/mutations";
import { presignDownload } from "@/lib/storage";

/**
 * GET /api/photos/:id/raw — chuyển hướng tới URL đọc tạm thời của file gốc trên R2.
 * `?download=1` → trình duyệt tải file về (dùng cho video lớn, khỏi tải cả file vào bộ nhớ).
 */
export const GET = handle(async (req: Request, ctx: RouteContext<"/api/photos/[id]/raw">) => {
  const { id } = await ctx.params;
  const original = await getOriginalDownload(id);
  if (!original) return json({ error: "Photo not found" }, { status: 404 });
  const download = new URL(req.url).searchParams.get("download") === "1";
  return NextResponse.redirect(await presignDownload(original.key, download ? original.filename : undefined), {
    status: 302,
    // URL ký có hạn 1 giờ; cache ngắn hơn để không trả về link đã hết hạn
    headers: { "Cache-Control": "private, max-age=1800" },
  });
});
