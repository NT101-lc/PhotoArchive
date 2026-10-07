import { handle, json, readJson } from "@/lib/api";
import { requireMember } from "@/lib/auth";
import { completeMultipart, completeMultipartInput } from "@/lib/mutations";

/** POST /api/uploads/complete — ghép các phần đã upload thành file. Body: { key, uploadId, partCount } */
export const POST = handle(async (req: Request) => {
  const actor = await requireMember();
  const input = await readJson(req, completeMultipartInput);
  return json(await completeMultipart(actor, input));
});
