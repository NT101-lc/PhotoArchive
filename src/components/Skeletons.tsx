// Skeleton cho loading.tsx của từng route — giữ đúng bố cục để không bị nhảy layout.

export function HeroSkeleton() {
  return (
    <div className="mb-10 flex flex-col gap-3 border-b border-line pt-10 pb-7">
      <div className="skeleton h-4 w-28 rounded-full" />
      <div className="skeleton h-12 w-72 rounded-md sm:w-[28rem]" />
      <div className="skeleton h-4 w-60 rounded-full" />
      <div className="skeleton mt-2 h-7 w-56 rounded-md" />
    </div>
  );
}

export function AlbumCardSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="print">
        <div className="skeleton aspect-[3/2] rounded-[1px]" />
      </div>
      <div className="flex flex-col gap-2 px-0.5">
        <div className="skeleton h-6 w-3/4 rounded-md" />
        <div className="skeleton h-4 w-1/2 rounded-full" />
      </div>
    </div>
  );
}

// Tỉ lệ cố định để skeleton masonry trông tự nhiên (không random để tránh lệch hydrate)
const RATIOS = [1.5, 0.67, 1.33, 0.75, 1.78, 0.67, 1.5, 0.75, 1.33, 1.78, 0.67, 1.5];

export function PhotoGridSkeleton() {
  return (
    <div className="justified">
      {RATIOS.map((r, i) => (
        <div
          key={i}
          className="skeleton rounded-[3px]"
          style={{ aspectRatio: r, flexGrow: r, flexBasis: `calc(var(--row-h) * ${r})` }}
        />
      ))}
    </div>
  );
}
