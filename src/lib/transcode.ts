import "server-only";
import { after } from "next/server";
import { serverEnv } from "./env";

/**
 * Báo worker chuyển mã (workflow .github/workflows/transcode.yml) chạy ngay, sau khi response đã trả về.
 * Không cấu hình token thì bỏ qua: workflow vẫn tự chạy theo lịch và nhặt video đang chờ.
 */
export function kickTranscoder() {
  const { GITHUB_DISPATCH_TOKEN: token, GITHUB_REPOSITORY: repo } = serverEnv();
  if (!token || !repo) return;
  after(async () => {
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "thesix-photoarchive",
        },
        body: JSON.stringify({ event_type: "transcode" }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) console.error(`Transcoder dispatch failed: ${res.status} ${await res.text()}`);
    } catch (err) {
      console.error("Transcoder dispatch failed", err);
    }
  });
}
