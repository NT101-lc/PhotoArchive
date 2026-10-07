"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { plural } from "@/lib/format";
import { isVideoFile, uploadFiles } from "@/lib/upload-client";
import { UploadDock } from "./UploadDock";
import { useToast } from "./Toast";

// Upload chạy nền, kiểu Google Drive: modal chỉ chọn file rồi giao cho manager này.
// Manager nằm trong root layout nên không bị unmount khi chuyển trang → upload chạy tiếp.
// (Tải lại / đóng tab thì dừng; có cảnh báo trước khi rời trang.)

export type UploadFileState = {
  name: string;
  size: number;
  video: boolean;
  loaded: number;
  status: "waiting" | "uploading" | "done" | "failed";
  error?: string;
};

export type UploadJob = {
  id: number;
  albumSlug: string;
  albumTitle: string;
  files: UploadFileState[];
  status: "queued" | "uploading" | "done" | "cancelled";
  /** Lỗi ở mức cả đợt (vd không ghi được vào album) */
  error?: string;
};

type Enqueue = { albumSlug: string; albumTitle: string; files: File[]; coverIndex?: number };

type UploadManagerApi = {
  jobs: UploadJob[];
  enqueue: (job: Enqueue) => void;
  cancel: (id: number) => void;
  retryFailed: (id: number) => void;
  dismiss: (id: number) => void;
  dismissFinished: () => void;
};

const UploadContext = createContext<UploadManagerApi | null>(null);

const RENDER_EVERY_MS = 250;
const REFRESH_EVERY_MS = 3000;

export function UploadManagerProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();

  // Tiến độ đổi liên tục → giữ ở ref, vẽ lại tối đa mỗi 250 ms
  const jobsRef = useRef<UploadJob[]>([]);
  const filesRef = useRef(new Map<number, { files: File[]; coverIndex?: number; abort: AbortController }>());
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const renderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const running = useRef(false);
  const nextId = useRef(1);
  const pathRef = useRef(pathname);
  const lastRefresh = useRef(0);

  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  const render = useCallback((now = false) => {
    const flush = () => {
      renderTimer.current = null;
      setJobs(jobsRef.current.map((j) => ({ ...j, files: [...j.files] })));
    };
    if (now) {
      if (renderTimer.current) clearTimeout(renderTimer.current);
      flush();
    } else if (!renderTimer.current) {
      renderTimer.current = setTimeout(flush, RENDER_EVERY_MS);
    }
  }, []);

  /** Đang xem đúng album đó → làm mới để ảnh vừa lên hiện ra (giãn cách để không refresh dồn dập). */
  const refreshIfViewing = useCallback(
    (slug: string, force = false) => {
      if (pathRef.current !== `/albums/${slug}`) return;
      const now = Date.now();
      if (!force && now - lastRefresh.current < REFRESH_EVERY_MS) return;
      lastRefresh.current = now;
      router.refresh();
    },
    [router],
  );

  const runQueue = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      for (let job = jobsRef.current.find((j) => j.status === "queued"); job; job = jobsRef.current.find((j) => j.status === "queued")) {
        const meta = filesRef.current.get(job.id)!;
        job.status = "uploading";
        render(true);
        const file = (i: number) => job!.files[i];
        try {
          await uploadFiles(
            job.albumSlug,
            meta.files,
            meta.coverIndex,
            {
              onProgress: (i, loaded) => {
                file(i).status = "uploading";
                file(i).loaded = loaded;
                render();
              },
              onDone: (i) => {
                file(i).status = "done";
                file(i).loaded = file(i).size;
                render();
              },
              onFailed: (i, error) => {
                file(i).status = "failed";
                file(i).error = error;
                render();
              },
              onRegistered: () => refreshIfViewing(job!.albumSlug),
            },
            meta.abort.signal,
          );
        } catch (err) {
          job.error = err instanceof Error ? err.message : "Upload failed";
        }
        // cancel() có thể đã đổi trạng thái trong lúc đang upload
        const cancelled = (job.status as UploadJob["status"]) === "cancelled";
        if (!cancelled) job.status = "done";
        render(true);
        refreshIfViewing(job.albumSlug, true);

        const ok = job.files.filter((f) => f.status === "done").length;
        const failed = job.files.length - ok;
        if (!cancelled) {
          toast.show({
            tone: failed || job.error ? "warn" : "success",
            title: `Uploaded ${plural(ok, "file")} to ${job.albumTitle}`,
            message: job.error ?? (failed ? `${plural(failed, "file")} failed. Open the uploads panel to retry.` : undefined),
          });
        }
        // Giữ File của các file lỗi để thử lại; file đã xong thì bỏ cho nhẹ bộ nhớ
        meta.files = meta.files.map((f, i) => (job!.files[i].status === "done" ? (null as unknown as File) : f));
      }
    } finally {
      running.current = false;
    }
  }, [render, refreshIfViewing, toast]);

  const enqueue = useCallback(
    ({ albumSlug, albumTitle, files, coverIndex }: Enqueue) => {
      const id = nextId.current++;
      filesRef.current.set(id, { files, coverIndex, abort: new AbortController() });
      jobsRef.current = [
        ...jobsRef.current,
        {
          id,
          albumSlug,
          albumTitle,
          status: "queued",
          files: files.map((f) => ({ name: f.name, size: f.size, video: isVideoFile(f), loaded: 0, status: "waiting" })),
        },
      ];
      render(true);
      void runQueue();
    },
    [render, runQueue],
  );

  const cancel = useCallback(
    (id: number) => {
      const job = jobsRef.current.find((j) => j.id === id);
      if (!job || job.status === "done" || job.status === "cancelled") return;
      job.status = "cancelled";
      for (const f of job.files) if (f.status !== "done") Object.assign(f, { status: "failed", error: "Cancelled" });
      filesRef.current.get(id)?.abort.abort();
      render(true);
    },
    [render],
  );

  const retryFailed = useCallback(
    (id: number) => {
      const job = jobsRef.current.find((j) => j.id === id);
      const meta = filesRef.current.get(id);
      if (!job || !meta) return;
      const files = meta.files.filter((f, i) => f && job.files[i].status === "failed");
      if (files.length === 0) return;
      jobsRef.current = jobsRef.current.filter((j) => j.id !== id);
      filesRef.current.delete(id);
      enqueue({ albumSlug: job.albumSlug, albumTitle: job.albumTitle, files });
    },
    [enqueue],
  );

  const dismiss = useCallback(
    (id: number) => {
      jobsRef.current = jobsRef.current.filter((j) => j.id !== id);
      filesRef.current.delete(id);
      render(true);
    },
    [render],
  );

  const dismissFinished = useCallback(() => {
    for (const j of jobsRef.current) if (j.status === "done" || j.status === "cancelled") filesRef.current.delete(j.id);
    jobsRef.current = jobsRef.current.filter((j) => j.status === "queued" || j.status === "uploading");
    render(true);
  }, [render]);

  // Còn upload dở → hỏi trước khi rời trang / đóng tab
  const busy = jobs.some((j) => j.status === "queued" || j.status === "uploading");
  useEffect(() => {
    if (!busy) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [busy]);

  return (
    <UploadContext.Provider value={{ jobs, enqueue, cancel, retryFailed, dismiss, dismissFinished }}>
      {children}
      <UploadDock />
    </UploadContext.Provider>
  );
}

export function useUploads() {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("useUploads must be used inside <UploadManagerProvider>");
  return ctx;
}
