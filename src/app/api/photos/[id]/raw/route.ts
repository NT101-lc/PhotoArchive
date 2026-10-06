import { NextResponse } from "next/server";
import { handle, json } from "@/lib/api";
import { getPhotoStorageKey } from "@/lib/mutations";
import { presignDownload } from "@/lib/storage";

/**
 * GET /api/photos/:id/raw — chuyển hướng tới URL đọc tạm thời trên R2.
 * Dùng khi bucket để private (không đặt R2_PUBLIC_URL).
 */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/photos/[id]/raw">) => {
  const { id } = await ctx.params;
  const key = await getPhotoStorageKey(id);
  if (!key) return json({ error: "Photo not found" }, { status: 404 });
  return NextResponse.redirect(await presignDownload(key), {
    status: 302,
    // URL ký có hạn 1 giờ; cache ngắn hơn để không trả về link đã hết hạn
    headers: { "Cache-Control": "private, max-age=1800" },
  });
});
