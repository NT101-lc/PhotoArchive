"use client";

import Link from "next/link";
import { useState } from "react";
import { formatBytes, plural } from "@/lib/format";
import { IconCheck, IconChevronDown, IconClose, IconImage, IconPlay, IconReset } from "./Icons";
import { useUploads, type UploadFileState, type UploadJob } from "./UploadManager";

/** Panel tiến độ upload ở góc màn hình (như Google Drive). Ẩn khi không có gì. */
export function UploadDock() {
  const { jobs, cancel, retryFailed, dismiss, dismissFinished } = useUploads();
  const [open, setOpen] = useState(true);
  if (jobs.length === 0) return null;

  const files = jobs.flatMap((j) => j.files);
  const total = files.reduce((s, f) => s + f.size, 0);
  const loaded = files.reduce((s, f) => s + Math.min(f.loaded, f.size), 0);
  const done = files.filter((f) => f.status === "done").length;
  const failed = files.filter((f) => f.status === "failed").length;
  const active = jobs.some((j) => j.status === "queued" || j.status === "uploading");
  const pct = total ? Math.round((loaded / total) * 100) : 0;

  const title = active
    ? `Uploading ${plural(files.length - done - failed, "file")}`
    : failed
      ? `${plural(failed, "file")} didn’t upload`
      : `Uploaded ${plural(done, "file")}`;

  return (
    <section
      aria-label="Uploads"
      className="animate-rise fixed inset-x-3 bottom-3 z-[1500] overflow-hidden rounded-xl border border-line bg-surface shadow-hard-lg sm:inset-x-auto sm:bottom-6 sm:left-6 sm:w-[380px]"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            active ? "bg-surface-2" : failed ? "bg-danger/15 text-danger" : "bg-accent/15 text-accent"
          }`}
          aria-hidden="true"
        >
          {active ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" />
          ) : failed ? (
            <IconReset size={16} />
          ) : (
            <IconCheck size={18} />
          )}
        </span>
        <button type="button" onClick={() => setOpen((v) => !v)} className="min-w-0 flex-1 text-left" aria-expanded={open}>
          <span className="block truncate font-semibold" aria-live="polite">
            {title}
          </span>
          <span className="block text-xs text-ink-soft tabular-nums">
            {active
              ? `${pct}%, ${formatBytes(loaded)} of ${formatBytes(total)}. You can keep browsing.`
              : failed
                ? "Retry them from the list below."
                : "Everything is in the album."}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md p-1 text-ink-soft hover:bg-surface-2 hover:text-ink"
          aria-label={open ? "Collapse uploads" : "Expand uploads"}
        >
          <IconChevronDown size={18} className={`transition-transform ${open ? "" : "rotate-180"}`} />
        </button>
        {!active && (
          <button
            type="button"
            onClick={dismissFinished}
            className="rounded-md p-1 text-ink-soft hover:bg-surface-2 hover:text-ink"
            aria-label="Close uploads panel"
          >
            <IconClose size={18} />
          </button>
        )}
      </div>

      {active && (
        <div className="h-1 bg-surface-2" aria-hidden="true">
          <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
      )}

      {open && (
        <ul className="max-h-[min(50vh,360px)] overflow-y-auto border-t border-line">
          {jobs.map((job) => (
            <JobRow
              key={job.id}
              job={job}
              onCancel={() => cancel(job.id)}
              onRetry={() => retryFailed(job.id)}
              onDismiss={() => dismiss(job.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function JobRow({ job, onCancel, onRetry, onDismiss }: { job: UploadJob; onCancel: () => void; onRetry: () => void; onDismiss: () => void }) {
  const done = job.files.filter((f) => f.status === "done").length;
  const failed = job.files.filter((f) => f.status === "failed").length;
  const active = job.status === "queued" || job.status === "uploading";
  const videos = job.files.filter((f) => f.video && f.status === "done").length;

  return (
    <li className="border-b border-line last:border-b-0">
      <div className="flex items-center gap-2 px-4 pt-3 pb-1.5">
        <Link href={`/albums/${job.albumSlug}`} className="min-w-0 flex-1 truncate text-sm font-semibold hover:text-accent">
          {job.albumTitle}
        </Link>
        <span className="shrink-0 text-xs text-ink-soft tabular-nums">
          {job.status === "queued" ? "Waiting" : `${done}/${job.files.length}`}
        </span>
        {active ? (
          <button type="button" onClick={onCancel} className="text-xs font-semibold text-ink-soft underline hover:text-danger">
            Cancel
          </button>
        ) : (
          <>
            {failed > 0 && job.status !== "cancelled" && (
              <button type="button" onClick={onRetry} className="text-xs font-semibold text-accent underline">
                Retry {failed}
              </button>
            )}
            <button type="button" onClick={onDismiss} className="rounded p-0.5 text-ink-soft hover:text-ink" aria-label={`Remove ${job.albumTitle} from list`}>
              <IconClose size={14} />
            </button>
          </>
        )}
      </div>
      {job.error && <p className="px-4 pb-1.5 text-xs text-danger">{job.error}</p>}
      {!active && videos > 0 && (
        <p className="px-4 pb-1.5 text-xs text-ink-soft">
          {plural(videos, "video")} {videos === 1 ? "is" : "are"} being processed. {videos === 1 ? "It" : "They"}’ll be playable in a few minutes.
        </p>
      )}
      <ul className="pb-2">
        {job.files.map((f, i) => (
          <FileRow key={i} file={f} />
        ))}
      </ul>
    </li>
  );
}

function FileRow({ file }: { file: UploadFileState }) {
  const pct = file.size ? Math.min(100, Math.round((file.loaded / file.size) * 100)) : 0;
  return (
    <li className="flex items-center gap-2.5 px-4 py-1 text-sm" title={file.error}>
      <span className="shrink-0 text-ink-soft" aria-hidden="true">
        {file.video ? <IconPlay size={15} /> : <IconImage size={15} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate">{file.name}</span>
        {file.status === "uploading" && (
          <span className="mt-0.5 block h-0.5 overflow-hidden rounded-full bg-surface-2">
            <span className="block h-full bg-accent" style={{ width: `${pct}%` }} />
          </span>
        )}
      </span>
      <span className={`shrink-0 text-xs tabular-nums ${file.status === "failed" ? "text-danger" : "text-ink-soft"}`}>
        {file.status === "done" ? (
          <IconCheck size={15} className="text-accent" />
        ) : file.status === "failed" ? (
          file.error === "Cancelled" ? "Cancelled" : "Failed"
        ) : file.status === "uploading" ? (
          `${pct}%`
        ) : (
          formatBytes(file.size)
        )}
      </span>
    </li>
  );
}
