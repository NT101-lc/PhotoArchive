import type { Metadata } from "next";
import { IconLock } from "@/components/Icons";
import { Logo } from "@/components/Logo";
import { GoogleLoginButton } from "./GoogleLoginButton";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-10">
      <div className="card relative w-full max-w-[420px] overflow-hidden">
        <div className="sprockets h-3 bg-ink" aria-hidden="true" />
        <div className="flex flex-col gap-6 p-6 sm:p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <Logo size={64} />
            <div>
              <p className="eyebrow mb-1">B6 crew · private</p>
              <h1 className="font-display text-[2rem] leading-none font-extrabold tracking-[-0.03em]">B6 PhotoArchive</h1>
            </div>
            <p className="text-[0.95rem] text-ink-soft">
              The crew’s trip photo archive. Only Google accounts added to the group can see the photos.
            </p>
          </div>

          <GoogleLoginButton />

          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-ink-soft">
            <IconLock size={13} />
            No access yet? Ask a group admin to add you.
          </p>
        </div>
      </div>
    </main>
  );
}
