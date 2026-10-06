// Skeleton trang chủ landing
export default function HomeLoading() {
  return (
    <main aria-busy="true">
      <div className="skeleton h-[46px] border-b-2 border-line" />
      <div className="mx-auto grid max-w-[1280px] items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-16">
        <div className="flex flex-col gap-4">
          <div className="skeleton h-6 w-48 rounded-md" />
          <div className="skeleton h-28 w-full max-w-md rounded-xl sm:h-36" />
          <div className="skeleton h-5 w-full max-w-lg rounded-full" />
          <div className="flex gap-3">
            <div className="skeleton h-12 w-44 rounded-xl border-2 border-line" />
            <div className="skeleton h-12 w-36 rounded-xl border-2 border-line" />
          </div>
        </div>
        <div className="skeleton mx-auto aspect-[5/4] w-full max-w-[560px] rounded-xl" />
      </div>
    </main>
  );
}
