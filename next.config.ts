import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Ảnh mock lấy từ picsum.photos (redirect sang fastly.picsum.photos).
    // Khi có storage thật, thêm hostname của storage vào đây.
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
    ],
  },
};

export default nextConfig;
