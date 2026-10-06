import { handle, json, readJson } from "@/lib/api";
import { getCurrentMember, requireMember } from "@/lib/auth";
import { updateProfile, updateProfileInput } from "@/lib/mutations";

/** GET /api/me — người đang dùng (kèm avatarUrl) hoặc null. */
export const GET = handle(async () => json({ member: await getCurrentMember() }));

/** PATCH /api/me — đổi tên / ảnh đại diện của mình { name?, avatarKey? (null = gỡ) } → { ok }. */
export const PATCH = handle(async (req: Request) => {
  const actor = await requireMember();
  const input = await readJson(req, updateProfileInput);
  return json(await updateProfile(actor, input));
});
