import { randomBytes, scrypt as scryptCb, timingSafeEqual, type BinaryLike } from "node:crypto";

// Hash mật khẩu admin bằng scrypt (có sẵn trong Node, không cần thư viện). Lưu dạng `salt:hash` (hex).

const KEY_LEN = 64;

function scrypt(password: BinaryLike, salt: BinaryLike) {
  return new Promise<Buffer>((resolve, reject) =>
    scryptCb(password, salt, KEY_LEN, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined) {
  if (!stored) return false;
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
