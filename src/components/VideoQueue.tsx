"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { retryVideo } from "@/lib/api-client";
import { formatBytes, formatDateTime } from "@/lib/format";
import { IconCheck, IconReset } from "./Icons";
import { useToast } from "./Toast";

type Item = {
  id: string;
  status: "queued" | "processing" | "ready" | "failed";
  attempts: number;
  error: string | null;
  createdAt: string;
  sizeBytes: number | null;
  albumSlug: string;
  albumTitle: string;
  uploader: string | null;
};

const STATUS = {
  queued: { label: "Waiting", tone: "text-ink-soft" },
  processing: { label: "Processing", tone: "text-accent" },
  failed: { label: "Failed", tone: "text-danger" },
  ready: { label: "Ready", tone: "text-accent" },
} as const;

/** Admin: video chưa xem được, có nút thử lại cho video lỗi. Tự làm mới khi còn video đang xử lý. */
export function VideoQueue({ items, stuck }: { items: Item[]; stuck: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const active = items.some((i) => i.status === "queued" || i.status === "processing");

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), 15_000);
    return () => clearInterval(t);
  }, [active, router]);

  async function retry(id: string) {
    setBusy(id);
    try {
      await retryVideo(id);
      toast.show({ tone: "success", title: "Video queued again" });
      router.refresh();
    } catch (err) {
      toast.show({ tone: "warn", title: "Couldn’t retry", message: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-ink-soft">
        <IconCheck size={16} className="text-accent" />
        Nothing waiting. Every uploaded video is playable.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {stuck && (
        <p role="alert" className="rounded-lg border border-danger bg-danger/10 px-4 py-3 text-sm">
          <b>Some videos have been waiting for over an hour.</b> The transcoding worker may not be set up: check the
          repository secrets for the “Transcode videos” workflow on GitHub (see README, section Video).
        </p>
      )}
      <ul className="divide-y divide-line border-y border-line">
        {items.map((v) => {
          const s = STATUS[v.status];
          return (
            <li key={v.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
              <span className={`w-24 shrink-0 font-semibold ${s.tone}`}>
                {s.label}
                {v.status !== "queued" && v.attempts > 1 && <span className="font-normal text-ink-soft"> ({v.attempts}×)</span>}
              </span>
              <span className="min-w-0 flex-1">
                <Link href={`/albums/${v.albumSlug}?photo=${v.id}`} className="font-semibold hover:text-accent">
                  {v.albumTitle}
                </Link>
                <span className="text-ink-soft">
                  {" "}
                  by {v.uploader ?? "Unknown"}, {formatDateTime(v.createdAt)}
                  {v.sizeBytes ? `, ${formatBytes(v.sizeBytes)}` : ""}
                </span>
                {v.error && <span className="mt-0.5 block truncate text-xs text-danger" title={v.error}>{v.error}</span>}
              </span>
              {v.status === "failed" && (
                <button type="button" className="btn h-8 px-3 text-xs" disabled={busy === v.id} onClick={() => retry(v.id)}>
                  <IconReset size={14} />
                  Try again
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
