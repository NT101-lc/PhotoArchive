"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { Me, Member } from "@/lib/types";
import { Avatar } from "./Avatar";
import { IconCheck, IconLock } from "./Icons";
import { useToast } from "./Toast";

async function post(url: string, body?: unknown, method = "POST") {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
}

/**
 * Chọn tên / đăng nhập admin.
 * - Trang /login: xong thì chuyển tới `next`.
 * - Nhúng trong form khác (vd modal upload): truyền `onDone` → ở nguyên chỗ, chỉ làm mới dữ liệu
 *   server nên những gì người dùng đang điền không bị mất.
 */
export function IdentityForm({
  members,
  current,
  next = "/",
  onDone,
}: {
  members: Member[];
  current: Me | null;
  next?: string;
  /** Nhận tên người vừa chọn (admin: "ADMIN") */
  onDone?: (name: string) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [adminOpen, setAdminOpen] = useState(current?.role === 0);
  const [password, setPassword] = useState("");

  function done(title: string, name: string) {
    toast.show({ tone: "success", title });
    if (onDone) {
      onDone(name);
      setBusy(null);
    } else router.push(next);
    router.refresh();
  }

  async function pick(m: Member) {
    setBusy(m.id);
    try {
      await post("/api/session", { memberId: m.id });
      done(`Hi ${m.name}!`, m.name);
    } catch (err) {
      toast.show({ tone: "warn", title: "Couldn’t switch", message: (err as Error).message });
      setBusy(null);
    }
  }

  async function adminLogin(e: FormEvent) {
    e.preventDefault();
    setBusy("admin");
    try {
      await post("/api/session/admin", { name: "ADMIN", password });
      done("Signed in as admin", "ADMIN");
    } catch (err) {
      toast.show({ tone: "warn", title: "Admin sign-in failed", message: (err as Error).message });
      setBusy(null);
    }
  }

  async function signOut() {
    setBusy("out");
    await post("/api/session", undefined, "DELETE").catch(() => {});
    toast.show({ tone: "info", title: "Signed out" });
    router.refresh();
    setBusy(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {members.map((m) => {
          const selected = current?.id === m.id;
          return (
            <li key={m.id}>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => pick(m)}
                aria-pressed={selected}
                className={`flex w-full flex-col items-center gap-2 rounded-xl border border-line px-2 py-3 transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-hard-sm disabled:opacity-60 ${
                  selected ? "bg-ink text-bg" : "bg-surface"
                }`}
              >
                <span className="relative">
                  <Avatar name={m.name} url={m.avatarUrl} size={44} />
                  {selected && (
                    <span className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full border border-line bg-accent text-on-accent">
                      <IconCheck size={11} />
                    </span>
                  )}
                </span>
                <span className="text-sm font-semibold">{busy === m.id ? "…" : m.name}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="rounded-xl border border-dashed border-line">
        <button
          type="button"
          onClick={() => setAdminOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold"
          aria-expanded={adminOpen}
        >
          <span className="flex items-center gap-2">
            <IconLock size={15} /> Admin sign-in
          </span>
          <span className="text-ink-soft">{adminOpen ? "−" : "+"}</span>
        </button>
        {adminOpen && (
          <form onSubmit={adminLogin} className="flex flex-col gap-2.5 border-t border-dashed border-line p-4">
            <input value="ADMIN" readOnly aria-label="Admin account" className="field bg-surface-2 text-ink-soft" />
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              aria-label="Admin password"
              className="field"
              required
            />
            <button type="submit" disabled={!!busy || !password} className="btn btn-primary">
              {busy === "admin" ? "Signing in…" : "Sign in as admin"}
            </button>
          </form>
        )}
      </div>

      {current && !onDone && (
        <button type="button" onClick={signOut} disabled={!!busy} className="text-sm font-semibold text-ink-soft underline hover:text-accent">
          Sign out ({current.name})
        </button>
      )}
    </div>
  );
}
