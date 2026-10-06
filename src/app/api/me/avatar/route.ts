import { handle, json, readJson } from "@/lib/api";
import { requireMember } from "@/lib/auth";
import { avatarUploadInput, presignAvatarUpload } from "@/lib/mutations";

/** POST /api/me/avatar — URL ký để upload ảnh đại diện { type, size } → { key, contentType, uploadUrl }. */
export const POST = handle(async (req: Request) => {
  const actor = await requireMember();
  const input = await readJson(req, avatarUploadInput);
  return json(await presignAvatarUpload(actor, input));
});
