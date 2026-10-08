import { handle, json, readJson } from "@/lib/api";
import { requireMember } from "@/lib/auth";
import { setReaction, setReactionInput } from "@/lib/social";

/** PUT /api/photos/:id/reaction — { emoji | null }: thả / đổi / bỏ cảm xúc của mình. */
export const PUT = handle(async (req: Request, { params }: RouteContext<"/api/photos/[id]/reaction">) => {
  const actor = await requireMember();
  const input = await readJson(req, setReactionInput);
  return json(await setReaction(actor, (await params).id, input));
});
