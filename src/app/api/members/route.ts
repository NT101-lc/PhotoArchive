import { handle, json } from "@/lib/api";
import { getMembers } from "@/lib/data";

/** GET /api/members — thành viên nhóm. */
export const GET = handle(async () => json({ members: await getMembers() }));
