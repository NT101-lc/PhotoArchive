import { handle, json, readJson } from "@/lib/api";
import { requireMember } from "@/lib/auth";
import { abortMultipart, abortMultipartInput } from "@/lib/mutations";

/** POST /api/uploads/abort — huỷ upload multipart dở dang, R2 xoá các phần đã lên. Body: { key, uploadId } */
export const POST = handle(async (req: Request) => {
  const actor = await requireMember();
  const input = await readJson(req, abortMultipartInput);
  return json(await abortMultipart(actor, input));
});
