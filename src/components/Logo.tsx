/** Logo "B6": tấm ảnh in nghiêng nhẹ, có dải lỗ phim phía trên. */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="relative inline-flex shrink-0 -rotate-6 flex-col overflow-hidden rounded-[10px] border-2 border-line bg-accent text-on-accent shadow-hard-sm transition-transform group-hover:rotate-0"
      style={{ width: size, height: size }}
    >
      <span className="sprockets h-[7px] shrink-0 bg-ink" />
      <span className="flex flex-1 items-center justify-center font-display font-extrabold tracking-tight" style={{ fontSize: size * 0.42 }}>
        B6
      </span>
    </span>
  );
}
