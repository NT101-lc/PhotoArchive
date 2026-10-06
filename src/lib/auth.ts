import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { db, members, ROLE_ADMIN } from "@/db";
import { serverEnv } from "./env";
import { verifyPassword } from "./password";
import { resolveObjectUrl } from "./storage";
import type { Me } from "./types";

// Danh tính không cần đăng nhập: user chỉ chọn tên; admin phải nhập mật khẩu.
// Cookie lưu `memberId.hếtHạn.chữKý` (HMAC-SHA256) → không sửa tay để thành người khác / admin được.
// Vai trò luôn đọc lại từ DB, không tin vào cookie.

const COOKIE = "b6_session";
const USER_TTL_S = 365 * 24 * 60 * 60;
const ADMIN_TTL_S = 7 * 24 * 60 * 60;

export class UnauthorizedError extends Error {}
export class ForbiddenError extends Error {}

function secret() {
  const s = serverEnv().SESSION_SECRET;
  if (!s) throw new Error("Missing SESSION_SECRET (≥ 32 chars) — see .env.example.");
  return s;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encode(memberId: string, ttlS: number) {
  const payload = `${memberId}.${Math.floor(Date.now() / 1000) + ttlS}`;
  return `${payload}.${sign(payload)}`;
}

function decode(value: string | undefined): string | null {
  if (!value) return null;
  const [id, exp, sig] = value.split(".");
  if (!id || !exp || !sig) return null;
  const expected = Buffer.from(sign(`${id}.${exp}`));
  const actual = Buffer.from(sig);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  if (Number(exp) * 1000 < Date.now()) return null;
  return id;
}

async function setSession(memberId: string, ttlS: number) {
  (await cookies()).set(COOKIE, encode(memberId, ttlS), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ttlS,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

/** Người đang dùng (theo cookie), `null` nếu chưa chọn tên. */
export const getCurrentMember = cache(async (): Promise<Me | null> => {
  let id: string | null;
  try {
    id = decode((await cookies()).get(COOKIE)?.value);
  } catch {
    return null; // thiếu SESSION_SECRET → coi như chưa chọn danh tính
  }
  if (!id) return null;
  const [m] = await db
    .select({ id: members.id, name: members.name, role: members.role, avatarKey: members.avatarKey })
    .from(members)
    .where(eq(members.id, id))
    .limit(1);
  if (!m) return null;
  const { avatarKey, ...rest } = m;
  return { ...rest, avatarUrl: await resolveObjectUrl(avatarKey) };
});

export async function requireMember() {
  const m = await getCurrentMember();
  if (!m) throw new UnauthorizedError("Choose who you are first.");
  return m;
}

export async function requireAdmin() {
  const m = await requireMember();
  if (m.role !== ROLE_ADMIN) throw new ForbiddenError("Admin only.");
  return m;
}

/** User chọn tên mình. Không cho chọn tài khoản admin theo cách này. */
export async function selectMember(memberId: string) {
  const [m] = await db
    .select({ id: members.id, role: members.role })
    .from(members)
    .where(eq(members.id, memberId))
    .limit(1);
  if (!m) throw new UnauthorizedError("Member not found.");
  if (m.role === ROLE_ADMIN) throw new ForbiddenError("The admin account needs a password.");
  await setSession(m.id, USER_TTL_S);
}

/** Đăng nhập admin bằng tên + mật khẩu. */
export async function loginAdmin(name: string, password: string) {
  const [m] = await db
    .select({ id: members.id, role: members.role, passwordHash: members.passwordHash })
    .from(members)
    .where(eq(members.name, name))
    .limit(1);
  const ok = !!m && m.role === ROLE_ADMIN && (await verifyPassword(password, m.passwordHash));
  if (!ok) {
    await new Promise((r) => setTimeout(r, 600)); // làm chậm dò mật khẩu
    throw new UnauthorizedError("Wrong admin name or password.");
  }
  await setSession(m.id, ADMIN_TTL_S);
}
