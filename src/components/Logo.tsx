/** Logo thesix: một khung phim nhỏ, hai hàng lỗ răng cưa, số 6 ở giữa khung. */
export function Logo({ size = 36 }: { size?: number }) {
  const rail = Math.max(5, Math.round(size * 0.17));
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 flex-col overflow-hidden rounded-[5px] bg-film"
      style={{ width: size, height: size }}
    >
      <span className="sprockets shrink-0" style={{ height: rail, backgroundSize: `${rail + 3}px 100%` }} />
      <span
        className="mx-[3px] flex flex-1 items-center justify-center rounded-[2px] bg-edge font-display leading-none font-extrabold text-film"
        style={{ fontSize: size * 0.42, fontStretch: "125%" }}
      >
        6
      </span>
      <span className="sprockets shrink-0" style={{ height: rail, backgroundSize: `${rail + 3}px 100%` }} />
    </span>
  );
}
