import { z } from "zod";
import { handle, json, readJson } from "@/lib/api";
import { loginAdmin } from "@/lib/auth";

/** POST /api/session/admin — đăng nhập admin { name, password }. */
export const POST = handle(async (req: Request) => {
  const { name, password } = await readJson(req, z.object({ name: z.string().min(1).max(60), password: z.string().min(1).max(200) }));
  await loginAdmin(name, password);
  return json({ ok: true });
});
