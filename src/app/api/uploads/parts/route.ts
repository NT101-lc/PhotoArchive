import { handle, json, readJson } from "@/lib/api";
import { requireMember } from "@/lib/auth";
import { presignParts, presignPartsInput } from "@/lib/mutations";

/**
 * POST /api/uploads/parts — URL đã ký cho các phần của một upload multipart (video).
 * Body: { key, uploadId, partNumbers: number[] } → { parts: [{ partNumber, url }] }
 */
export const POST = handle(async (req: Request) => {
  const actor = await requireMember();
  const input = await readJson(req, presignPartsInput);
  return json({ parts: await presignParts(actor, input) });
});
