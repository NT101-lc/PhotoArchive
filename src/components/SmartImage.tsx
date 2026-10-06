"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { IconImage } from "./Icons";

/**
 * next/image (lazy load mặc định) + skeleton shimmer cho tới khi ảnh tải xong.
 * Component cha phải có `position: relative` và kích thước (hoặc aspect-ratio) khi dùng `fill`.
 */
export function SmartImage({ alt, className = "", onLoad, ...props }: ImageProps) {
  const [loaded, setLoaded] = useState(false);

  // Album chưa có ảnh nào → ô trống có biểu tượng, không render <img src="">
  if (!props.src) {
    return (
      <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-ink-soft/60">
        <IconImage size={22} />
      </span>
    );
  }

  return (
    <>
      {!loaded && <span aria-hidden="true" className="skeleton absolute inset-0" />}
      <Image
        {...props}
        alt={alt}
        // Ảnh đã tải xong trước khi hydrate (cache, preload) thì onLoad không bắn nữa → tự kiểm tra
        ref={(img) => {
          if (img?.complete && img.naturalWidth > 0) setLoaded(true);
        }}
        className={`${className} transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoad={(e) => {
          setLoaded(true);
          onLoad?.(e);
        }}
      />
    </>
  );
}
