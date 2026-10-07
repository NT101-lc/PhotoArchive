import type { Album } from "@/lib/types";
import { IconUpload } from "./Icons";
import { UploadButton } from "./UploadModal";

const FRAMES = 6;

/**
 * Album rỗng = cuộn phim vừa lắp, chưa chụp kiểu nào: một dải khung trống có số khung ở mép.
 * Khung 1 sáng đèn buồng tối và là nút upload.
 */
export function BlankRoll({ album }: { album: Pick<Album, "id" | "title" | "location" | "createdById"> }) {
  return (
    <section className="my-6 flex flex-col gap-8" aria-labelledby="blank-roll-title">
      <BlankStrip album={album} />

      <div className="max-w-[52ch]">
        <h2 id="blank-roll-title" className="font-display text-3xl font-extrabold tracking-[-0.02em] [font-stretch:115%]">
          Nothing developed yet
        </h2>
        <p className="mt-2 text-[1.02rem] leading-relaxed text-ink-soft">
          The roll for {album.location} is loaded and waiting. Add photos or videos from the trip and they fill in here, frame
          by frame, for the whole crew.
        </p>
      </div>
    </section>
  );
}

/** Dải phim trống. `wide`: tràn hết chiều ngang như contact sheet ở trang chủ. */
export function BlankStrip({ album, wide = false }: { album: Pick<Album, "id" | "title" | "createdById">; wide?: boolean }) {
  const options = [{ id: album.id, title: album.title, createdById: album.createdById }];

  return (
    <div className={wide ? "bg-film text-white" : "overflow-hidden rounded-[3px] bg-film text-white"}>
      <div className={`sprockets ${wide ? "h-4" : "h-3"}`} aria-hidden="true" />
      <ol
        className={`scrollbar-none flex gap-2 overflow-x-auto py-1 md:grid md:grid-cols-6 md:overflow-visible ${
          wide ? "mx-auto max-w-[1440px] px-4 sm:gap-3 sm:px-6" : "px-3"
        }`}
      >
        {Array.from({ length: FRAMES }, (_, i) => (
          <li key={i} className="w-[44vw] shrink-0 sm:w-[30vw] md:w-auto">
            <span className="frame-no flex justify-between px-0.5 pb-1 text-[0.7rem]" aria-hidden="true">
              <span>{i + 1}</span>
              <span>&#9656; {i + 1}A</span>
            </span>
            {i === 0 ? (
              <UploadButton
                albums={options}
                defaultAlbumId={album.id}
                className="unexposed safelight group flex aspect-[3/2] w-full flex-col items-center justify-center gap-1.5 rounded-[2px] text-sm font-semibold text-white focus-visible:outline-offset-2"
              >
                <IconUpload size={22} className="transition-transform duration-200 group-hover:-translate-y-0.5" />
                Add the first shots
              </UploadButton>
            ) : (
              // Các khung sau mờ dần về cuối cuộn
              <span className="unexposed block aspect-[3/2] rounded-[2px]" style={{ opacity: 1 - i * 0.12 }} aria-hidden="true" />
            )}
          </li>
        ))}
      </ol>
      <div className={`sprockets ${wide ? "h-4" : "h-3"}`} aria-hidden="true" />
    </div>
  );
}

/** Bìa của album chưa có ảnh: tấm in chưa tráng, mép hở sáng màu hổ phách. */
export function UnexposedCover() {
  return (
    <span className="unexposed absolute inset-0 flex items-end justify-between p-3" aria-hidden="true">
      <span className="frame-no text-[0.7rem]">&#9656; 1</span>
      <span className="text-xs font-medium text-white/55">Not developed yet</span>
    </span>
  );
}
