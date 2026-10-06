"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";
import type { Actor } from "@/lib/permissions";
import { IconLock, IconUser } from "./Icons";

// Người đang dùng — server đọc từ cookie đã ký (lib/auth.ts) rồi truyền xuống đây.
// Chỉ dùng để ẩn/hiện nút; quyền thật luôn được kiểm tra lại ở API.

const IdentityContext = createContext<Actor | null>(null);

export function IdentityProvider({ member, children }: { member: Actor | null; children: ReactNode }) {
  return <IdentityContext.Provider value={member}>{children}</IdentityContext.Provider>;
}

export function useIdentity() {
  return useContext(IdentityContext);
}

/** Nút trên thanh trên cùng: tên người đang dùng, bấm để đổi. */
export function IdentityChip() {
  const me = useIdentity();
  const pathname = usePathname();
  const href = pathname === "/login" ? "/login" : `/login?next=${encodeURIComponent(pathname)}`;

  if (!me) {
    return (
      <Link href={href} className="btn h-[42px] px-3" title="Choose who you are">
        <IconUser size={17} />
        <span className="max-sm:hidden">Who are you?</span>
      </Link>
    );
  }
  const admin = me.role === 0;
  return (
    <Link
      href={href}
      className={`btn h-[42px] px-3 ${admin ? "btn-primary" : ""}`}
      title={admin ? "Signed in as admin — click to switch" : "Click to switch person"}
    >
      {admin ? <IconLock size={16} /> : <IconUser size={17} />}
      <span className="max-w-[9ch] truncate">{me.name}</span>
    </Link>
  );
}
