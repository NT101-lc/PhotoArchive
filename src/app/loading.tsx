// Skeleton trang chủ: tiêu đề chuyến gần nhất + dải contact sheet
export default function HomeLoading() {
  return (
    <main aria-busy="true">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-4 pt-10 pb-8 sm:px-6 sm:pt-14">
        <div className="skeleton h-4 w-44 rounded-full" />
        <div className="skeleton h-20 w-full max-w-2xl rounded-md sm:h-28" />
        <div className="skeleton h-5 w-full max-w-md rounded-full" />
      </div>
      <div className="bg-film py-8">
        <div className="mx-auto flex max-w-[1440px] gap-3 overflow-hidden px-4 sm:px-6">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="aspect-[3/2] w-[64vw] shrink-0 rounded-[2px] bg-white/5 sm:w-[38vw] md:w-auto md:flex-1" />
          ))}
        </div>
      </div>
    </main>
  );
}
