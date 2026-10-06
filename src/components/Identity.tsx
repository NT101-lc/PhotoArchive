"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";
import type { Me } from "@/lib/types";
import { Avatar } from "./Avatar";
import { IconLock, IconUser } from "./Icons";

// Người đang dùng — server đọc từ cookie đã ký (lib/auth.ts) rồi truyền xuống đây.
// Chỉ dùng để ẩn/hiện nút; quyền thật luôn được kiểm tra lại ở API.

const IdentityContext = createContext<Me | null>(null);

export function IdentityProvider({ member, children }: { member: Me | null; children: ReactNode }) {
  return <IdentityContext.Provider value={member}>{children}</IdentityContext.Provider>;
}

export function useIdentity() {
  return useContext(IdentityContext);
}

/** Nút trên thanh trên cùng: chưa chọn tên → trang chọn tên; đã chọn → trang profile. */
export function IdentityChip() {
  const me = useIdentity();
  const pathname = usePathname();

  if (!me) {
    const href = pathname === "/login" ? "/login" : `/login?next=${encodeURIComponent(pathname)}`;
    return (
      <Link href={href} className="btn px-3" title="Choose who you are">
        <IconUser size={17} />
        <span className="max-sm:hidden">Who are you?</span>
      </Link>
    );
  }
  const admin = me.role === 0;
  return (
    <Link
      href="/profile"
      className="btn gap-2 pr-3 pl-1.5"
      title={admin ? "Admin — your profile" : "Your profile"}
    >
      <Avatar name={me.name} url={me.avatarUrl} size={28} />
      <span className="max-w-[9ch] truncate max-sm:hidden">{me.name}</span>
      {admin && <IconLock size={14} className="text-ink-soft" />}
    </Link>
  );
}
