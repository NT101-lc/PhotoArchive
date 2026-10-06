import { AlbumCardSkeleton, HeroSkeleton } from "@/components/Skeletons";

export default function HomeLoading() {
  return (
    <main className="mx-auto max-w-[1280px] px-4 pb-20 sm:px-6" aria-busy="true">
      <HeroSkeleton />
      <div className="mb-8 flex flex-col gap-4">
        <div className="skeleton h-12 rounded-full border-2 border-line" />
        <div className="flex gap-1.5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="skeleton h-8 w-16 rounded-full border-2 border-line" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <AlbumCardSkeleton key={i} />
        ))}
      </div>
    </main>
  );
}
