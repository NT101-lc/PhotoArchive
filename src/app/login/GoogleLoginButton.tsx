"use client";

import { useRouter } from "next/navigation";
import { IconGoogle } from "@/components/Icons";

/** Chỉ là UI: chưa có OAuth, bấm vào chuyển thẳng về trang chủ. */
export function GoogleLoginButton() {
  const router = useRouter();

  return (
    <button type="button" onClick={() => router.push("/")} className="btn h-12 w-full text-base">
      <IconGoogle size={20} />
      Sign in with Google
    </button>
  );
}
