import { HeroSkeleton, PhotoGridSkeleton } from "@/components/Skeletons";

export default function AlbumLoading() {
  return (
    <main className="mx-auto max-w-[1280px] px-4 pb-20 sm:px-6" aria-busy="true">
      <HeroSkeleton stats={2} />
      <div className="mb-6 flex gap-1.5 border-y-2 border-dashed border-line py-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton h-8 w-20 rounded-full border-2 border-line" />
        ))}
      </div>
      <PhotoGridSkeleton />
    </main>
  );
}
