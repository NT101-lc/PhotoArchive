import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { getCurrentMember } from "@/lib/auth";
import { getMembers } from "@/lib/data";
import { IdentityForm } from "./IdentityForm";

export const metadata: Metadata = { title: "Who are you?" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const [members, me, sp] = await Promise.all([getMembers(), getCurrentMember(), searchParams]);
  // Chỉ nhận đường dẫn nội bộ để tránh chuyển hướng ra trang ngoài
  const next = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/";

  return (
    <main className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-10">
      <div className="card relative w-full max-w-[460px] overflow-hidden">
        <div className="sprockets h-3 bg-film" aria-hidden="true" />
        <div className="flex flex-col gap-6 p-6 sm:p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <Logo size={56} />
            <div>
              <p className="eyebrow mb-1">Private archive</p>
              <h1 className="font-display text-[2rem] leading-none font-extrabold tracking-[-0.03em]">Who are you?</h1>
            </div>
            <p className="text-[0.95rem] text-ink-soft">
              No sign-in needed — just pick your name so your uploads are credited to you.
            </p>
          </div>

          <IdentityForm members={members} current={me} next={next} />
        </div>
      </div>
    </main>
  );
}
