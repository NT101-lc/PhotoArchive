import Image from "next/image";

const BG = ["bg-accent", "bg-teal", "bg-lilac", "bg-butter", "bg-sky"];

/** Màu nền cố định theo tên (cùng tên → cùng màu ở mọi chỗ). */
function colorFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return BG[h % BG.length];
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Ảnh đại diện tròn; chưa có ảnh thì hiện chữ cái đầu. */
export function Avatar({ name, url, size = 32 }: { name: string; url?: string | null; size?: number }) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-line font-display font-bold text-on-accent ${
        url ? "bg-surface-2" : colorFor(name)
      }`}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }}
      aria-hidden="true"
    >
      {url ? <Image src={url} alt="" fill sizes={`${size * 2}px`} className="object-cover" /> : initials(name)}
    </span>
  );
}
