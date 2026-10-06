import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import { isStorageConfigured } from "@/lib/storage";
import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = { title: "Your profile" };

export default async function ProfilePage() {
  const me = await getCurrentMember();
  if (!me) redirect("/login?next=/profile");

  return (
    <main className="flex min-h-[calc(100dvh-4rem)] items-start justify-center px-4 py-10 sm:items-center">
      <div className="card w-full max-w-[460px] overflow-hidden">
        <div className="sprockets h-3 bg-ink" aria-hidden="true" />
        <div className="p-6 sm:p-8">
          <p className="eyebrow mb-1">{me.role === 0 ? "Admin account" : "Your profile"}</p>
          <h1 className="mb-6 font-display text-[2rem] leading-none font-extrabold tracking-[-0.03em]">Profile</h1>
          <ProfileForm me={me} storageReady={isStorageConfigured()} />
        </div>
      </div>
    </main>
  );
}
