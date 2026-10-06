import { z } from "zod";
import { handle, json, readJson } from "@/lib/api";
import { clearSession, getCurrentMember, selectMember } from "@/lib/auth";

/** GET /api/session — người đang dùng ({ member } hoặc { member: null }). */
export const GET = handle(async () => json({ member: await getCurrentMember() }));

/** POST /api/session — user chọn tên mình { memberId }. Không dùng được cho tài khoản admin. */
export const POST = handle(async (req: Request) => {
  const { memberId } = await readJson(req, z.object({ memberId: z.uuid() }));
  await selectMember(memberId);
  return json({ ok: true });
});

/** DELETE /api/session — bỏ chọn tên / đăng xuất admin. */
export const DELETE = handle(async () => {
  await clearSession();
  return json({ ok: true });
});
