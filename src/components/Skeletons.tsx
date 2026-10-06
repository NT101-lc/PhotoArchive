// Skeleton cho loading.tsx của từng route — giữ đúng bố cục để không bị nhảy layout.

export function HeroSkeleton({ stats = 3 }: { stats?: number }) {
  return (
    <div className="mb-8 flex flex-col gap-6 pt-8 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex flex-col gap-3">
        <div className="skeleton h-3 w-32 rounded-full" />
        <div className="skeleton h-12 w-72 rounded-xl sm:w-[28rem]" />
        <div className="skeleton h-4 w-60 rounded-full" />
      </div>
      <div className="flex gap-2.5">
        {Array.from({ length: stats }, (_, i) => (
          <div key={i} className="skeleton h-[72px] flex-1 rounded-xl border-2 border-line sm:w-24 sm:flex-none" />
        ))}
      </div>
    </div>
  );
}

export function AlbumCardSkeleton() {
  return (
    <div className="card p-2.5">
      <div className="skeleton aspect-[4/3] rounded-[9px] border-2 border-line" />
      <div className="flex flex-col gap-2 px-1.5 pt-3 pb-1.5">
        <div className="skeleton h-6 w-3/4 rounded-lg" />
        <div className="skeleton h-4 w-1/2 rounded-full" />
      </div>
    </div>
  );
}

// Tỉ lệ cố định để skeleton masonry trông tự nhiên (không random để tránh lệch hydrate)
const RATIOS = ["3/2", "2/3", "4/3", "3/4", "16/9", "2/3", "3/2", "3/4", "4/3", "16/9", "2/3", "3/2"];

export function PhotoGridSkeleton() {
  return (
    <div className="columns-2 gap-3 sm:gap-4 md:columns-3 xl:columns-4">
      {RATIOS.map((r, i) => (
        <div
          key={i}
          className="skeleton mb-3 break-inside-avoid rounded-xl border-2 border-line sm:mb-4"
          style={{ aspectRatio: r }}
        />
      ))}
    </div>
  );
}
