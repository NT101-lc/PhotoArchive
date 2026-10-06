"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

/**
 * next/image (lazy load mặc định) + skeleton shimmer cho tới khi ảnh tải xong.
 * Component cha phải có `position: relative` và kích thước (hoặc aspect-ratio) khi dùng `fill`.
 */
export function SmartImage({ alt, className = "", onLoad, ...props }: ImageProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      {!loaded && <span aria-hidden="true" className="skeleton absolute inset-0" />}
      <Image
        {...props}
        alt={alt}
        className={`${className} transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoad={(e) => {
          setLoaded(true);
          onLoad?.(e);
        }}
      />
    </>
  );
}
