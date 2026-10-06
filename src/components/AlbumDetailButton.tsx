"use client";

import { useState } from "react";
import { formatDate, formatDateTime, plural } from "@/lib/format";
import type { Album, Photo } from "@/lib/types";
import { IconInfo } from "./Icons";
import { Modal } from "./Modal";

const AVATAR_BG = ["bg-butter", "bg-teal", "bg-lilac", "bg-sky", "bg-accent"];

/** Nút "Chi tiết" + modal thông tin chuyến đi. */
export function AlbumDetailButton({ album, photos }: { album: Album; photos: Photo[] }) {
  const [open, setOpen] = useState(false);

  const contributors = Object.entries(
    photos.reduce<Record<string, number>>((acc, p) => {
      acc[p.uploadedBy] = (acc[p.uploadedBy] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const max = contributors[0]?.[1] ?? 1;

  const first = photos[0]?.takenAt;
  const last = photos.at(-1)?.takenAt;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn" title="Trip details">
        <IconInfo size={16} />
        Details
      </button>

      <Modal open={open} onClose={() => setOpen(false)} eyebrow="Trip details" title={album.title}>
        <div className="flex flex-col gap-6 p-5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-surface-2/70 p-4">
            <Meta k="Place" v={album.location} />
            <Meta k="Trip date" v={formatDate(album.tripDate)} />
            {first && <Meta k="First photo" v={formatDateTime(first)} />}
            {last && <Meta k="Last photo" v={formatDateTime(last)} />}
            <Meta k="Photos" v={String(album.photoCount)} />
            <Meta k="Album ID" v={album.id} mono />
          </dl>

          <section>
            <h3 className="eyebrow mb-3">Top contributors</h3>
            {contributors.length === 0 ? (
              <p className="text-sm text-ink-soft italic">Nobody has uploaded photos yet.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {contributors.map(([name, count], i) => (
                  <li key={name} className="flex items-center gap-3">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-xs font-bold text-on-accent ${
                        AVATAR_BG[i % AVATAR_BG.length]
                      }`}
                    >
                      {initials(name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-semibold">{name}</span>
                        <span className="font-mono text-xs text-ink-soft">{plural(count, "photo")}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-ink" style={{ width: `${(count / max) * 100}%` }} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </Modal>
    </>
  );
}

function Meta({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-soft">{k}</dt>
      <dd className={`truncate font-semibold ${mono ? "font-mono text-sm" : ""}`}>{v}</dd>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
