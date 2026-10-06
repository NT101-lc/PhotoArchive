"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Avatar } from "@/components/Avatar";
import { IconImage, IconTrash } from "@/components/Icons";
import { useToast } from "@/components/Toast";
import { api, updateProfile, uploadAvatar } from "@/lib/api-client";
import { canRenameSelf } from "@/lib/permissions";
import type { Me } from "@/lib/types";

export function ProfileForm({ me, storageReady }: { me: Me; storageReady: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(me.name);
  const [busy, setBusy] = useState<null | "avatar" | "name" | "out">(null);
  const canRename = canRenameSelf(me);

  async function run(kind: "avatar" | "name", fn: () => Promise<unknown>, success: string) {
    setBusy(kind);
    try {
      await fn();
      toast.show({ tone: "success", title: success });
      router.refresh(); // layout đọc lại danh tính → avatar / tên trên thanh trên cùng cập nhật theo
    } catch (err) {
      toast.show({ tone: "warn", title: "Couldn’t save", message: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  function onPickAvatar(file: File | undefined) {
    if (!file) return;
    run("avatar", async () => updateProfile({ avatarKey: await uploadAvatar(file) }), "Profile picture updated");
  }

  function onSaveName(e: FormEvent) {
    e.preventDefault();
    run("name", () => updateProfile({ name: name.trim() }), "Name updated");
  }

  async function signOut() {
    setBusy("out");
    await api("/api/session", { method: "DELETE" }).catch(() => {});
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-7">
      {/* Ảnh đại diện */}
      <section className="flex items-center gap-5">
        <div className="relative">
          <Avatar name={me.name} url={me.avatarUrl} size={88} />
          {busy === "avatar" && (
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
              <span className="h-6 w-6 animate-spin rounded-full border-[3px] border-white/30 border-t-white" />
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              onPickAvatar(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className="btn"
            disabled={!!busy || !storageReady}
            onClick={() => fileRef.current?.click()}
            title={storageReady ? undefined : "Storage isn’t configured yet"}
          >
            <IconImage size={16} />
            {me.avatarUrl ? "Change photo" : "Upload photo"}
          </button>
          {me.avatarUrl && (
            <button
              type="button"
              className="text-left text-sm font-semibold text-ink-soft underline hover:text-accent disabled:opacity-50"
              disabled={!!busy}
              onClick={() => run("avatar", () => updateProfile({ avatarKey: null }), "Profile picture removed")}
            >
              <IconTrash size={13} className="mr-1 inline" />
              Remove photo
            </button>
          )}
          <p className="text-xs text-ink-soft">Square-cropped to 512 px. JPG, PNG or WEBP.</p>
        </div>
      </section>

      {/* Tên */}
      <form onSubmit={onSaveName} className="flex flex-col gap-2">
        <label htmlFor="profile-name" className="eyebrow">
          Display name
        </label>
        <div className="flex gap-2">
          <input
            id="profile-name"
            className="field flex-1 disabled:bg-surface-2 disabled:text-ink-soft"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            required
            disabled={!canRename}
          />
          {canRename && (
            <button type="submit" className="btn btn-primary" disabled={!!busy || !name.trim() || name.trim() === me.name}>
              {busy === "name" ? "Saving…" : "Save"}
            </button>
          )}
        </div>
        <p className="text-xs text-ink-soft">
          {canRename
            ? "Shown on your uploads and in the people filter."
            : "The admin account name is fixed — it’s used to sign in."}
        </p>
      </form>

      <div className="flex items-center justify-between border-t border-dashed border-line pt-4 text-sm font-semibold">
        <Link href="/login?next=/profile" className="text-ink-soft underline hover:text-accent">
          Switch person
        </Link>
        <button type="button" onClick={signOut} disabled={!!busy} className="text-ink-soft underline hover:text-accent">
          Sign out
        </button>
      </div>
    </div>
  );
}
