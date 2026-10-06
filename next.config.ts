import type { NextConfig } from "next";

type RemotePattern = NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]>[number];

// Domain public của bucket R2 (custom domain hoặc *.r2.dev), nếu có
function r2PublicPattern(): RemotePattern[] {
  const url = process.env.R2_PUBLIC_URL?.trim();
  if (!url) return [];
  try {
    const { protocol, hostname } = new URL(url);
    return [{ protocol: protocol.replace(":", "") as "http" | "https", hostname }];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Ảnh seed
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
      // R2 private: URL GET đã ký trên domain này
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "*.r2.dev" },
      ...r2PublicPattern(),
    ],
  },
};

export default nextConfig;
