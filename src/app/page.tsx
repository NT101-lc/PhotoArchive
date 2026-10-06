import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { IconArrowRight, IconImage, IconPin, IconUpload } from "@/components/Icons";
import { SmartImage } from "@/components/SmartImage";
import { UploadButton } from "@/components/UploadModal";
import { getAlbums, getPhotos } from "@/lib/data";
import { dayKey, formatDate, plural, yearOf } from "@/lib/format";
import type { Album, Photo } from "@/lib/types";

const SHEET_FRAMES = 6;

// Trang chủ: chuyến gần nhất mở ra như một tờ contact sheet, bên dưới là sổ ghi các chuyến theo năm.
export default async function HomePage() {
  const albums = await getAlbums(); // mới nhất trước
  const latest = albums[0];
  const latestPhotos = latest ? await getPhotos(latest.id) : [];

  const totalPhotos = albums.reduce((s, a) => s + a.photoCount, 0);
  const places = new Set(albums.map((a) => a.location)).size;
  const years = [...new Set(albums.map((a) => yearOf(a.tripDate)))];
  const albumOptions = albums.map(({ id, title, createdById }) => ({ id, title, createdById }));

  if (!latest) {
    return (
      <main className="mx-auto max-w-[1280px] px-4 pb-16 sm:px-6">
        <EmptyState
          icon={<IconImage size={26} />}
          title="No trips yet"
          action={
            <UploadButton albums={albumOptions}>
              <IconUpload size={18} />
              Upload the first trip
            </UploadButton>
          }
        >
          Upload a folder from your last trip and it becomes the first album here.
        </EmptyState>
      </main>
    );
  }

  const people = new Set(latestPhotos.map((p) => p.uploadedBy)).size;
  const days = new Set(latestPhotos.map((p) => dayKey(p.takenAt))).size;

  return (
    <>
      <main>
        {/* ---------- Chuyến gần nhất ---------- */}
        <section className="mx-auto max-w-[1280px] px-4 pt-10 pb-8 sm:px-6 sm:pt-14">
          <p className="eyebrow">Latest trip, {formatDate(latest.tripDate)}</p>
          <h1
            className="mt-2 max-w-[16ch] font-display text-[clamp(2.6rem,8vw,6.25rem)] leading-[0.9] font-extrabold tracking-[-0.04em] text-balance"
            style={{ fontStretch: "125%" }}
          >
            {latest.title}
          </h1>
          <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <p className="max-w-[46ch] text-lg leading-relaxed text-ink-soft">
              <span className="mr-2 inline-flex items-center gap-1 align-[-2px] font-semibold text-ink">
                <IconPin size={18} className="text-accent" />
                {latest.location}
              </span>
              {plural(latestPhotos.length, "photo")} from {people} {people === 1 ? "person" : "people"}
              {days > 1 ? ` across ${days} days` : ""}.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <Link href={`/albums/${latest.id}`} className="btn btn-primary h-11 px-5">
                Open album
              </Link>
              <UploadButton albums={albumOptions} className="btn h-11 px-5">
                <IconUpload size={18} />
                Upload photos
              </UploadButton>
            </div>
          </div>
        </section>

        <ContactSheet album={latest} photos={latestPhotos} />

        {/* ---------- Sổ chuyến đi ---------- */}
        <section id="timeline" className="mx-auto max-w-[1280px] scroll-mt-24 px-4 pt-16 pb-16 sm:px-6 sm:pt-20">
          <div className="mb-10 flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">Every trip</h2>
              <p className="mt-1.5 text-ink-soft">
                {plural(albums.length, "trip")}, {plural(totalPhotos, "photo")}, {plural(places, "place")} since{" "}
                {years[years.length - 1]}.
              </p>
            </div>
            <Link href="/albums" className="btn self-start sm:self-auto">
              Search and filter
              <IconArrowRight size={16} />
            </Link>
          </div>

          <div className="flex flex-col gap-12">
            {years.map((year) => (
              <YearGroup key={year} year={year} trips={albums.filter((a) => yearOf(a.tripDate) === year)} />
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-2 px-4 py-6 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>
            <b className="font-display text-ink">thesix</b> is a private archive for the crew.
          </span>
          <span className="flex gap-5">
            <Link href="/albums" className="hover:text-ink">
              Albums
            </Link>
            <Link href="/login" className="hover:text-ink">
              Switch person
            </Link>
          </span>
        </div>
      </footer>
    </>
  );
}

/**
 * Dải phim chạy hết chiều ngang: mỗi khung là một ảnh thật của chuyến gần nhất,
 * số khung in màu hổ phách ở mép phim. Ảnh "hiện hình" lần lượt khi tải trang.
 */
function ContactSheet({ album, photos }: { album: Album; photos: Photo[] }) {
  const frames = photos.slice(0, SHEET_FRAMES);
  const more = photos.length - frames.length;
  if (frames.length === 0) return null;

  return (
    <div className="bg-film text-white">
      <div className="sprockets h-4" aria-hidden="true" />
      <ol
        className="scrollbar-none mx-auto flex max-w-[1440px] snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto px-4 sm:scroll-px-6 sm:gap-3 sm:px-6 md:grid md:overflow-visible"
        style={{ gridTemplateColumns: `repeat(${SHEET_FRAMES}, minmax(0, 1fr))` }}
        aria-label={`First photos from ${album.title}`}
      >
        {frames.map((p, i) => {
          const last = i === frames.length - 1 && more > 0;
          return (
            <li key={p.id} className="w-[64vw] shrink-0 snap-start sm:w-[38vw] md:w-auto">
              <span className="frame-no flex justify-between px-0.5 pb-1 text-[0.7rem]" aria-hidden="true">
                <span>{i + 1}</span>
                <span>&#9656; {i + 1}A</span>
              </span>
              <Link
                href={last ? `/albums/${album.id}` : `/albums/${album.id}?photo=${p.id}`}
                className="animate-develop group relative block aspect-[3/2] overflow-hidden rounded-[2px] bg-white/5"
                style={{ animationDelay: `${150 + i * 140}ms` }}
                aria-label={last ? `Open all ${photos.length} photos` : `View photo ${i + 1} by ${p.uploadedBy}`}
              >
                <SmartImage
                  src={p.thumbUrl}
                  alt=""
                  fill
                  preload={i < 3}
                  sizes="(max-width: 768px) 64vw, 17vw"
                  className="object-cover transition-[filter] duration-200 group-hover:brightness-110"
                />
                {last && (
                  <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/60 font-display">
                    <span className="text-2xl font-extrabold">+{more}</span>
                    <span className="text-xs font-medium text-white/80">more photos</span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ol>
      <div className="sprockets mt-3 h-4" aria-hidden="true" />
    </div>
  );
}

const weekdayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "Asia/Ho_Chi_Minh" });
function weekday(isoDate: string) {
  return weekdayFmt.format(new Date(`${isoDate}T12:00:00+07:00`));
}

/** Một năm trong sổ: năm lớn bên trái (dính khi cuộn trên desktop), các chuyến xếp thành hàng bên phải. */
function YearGroup({ year, trips }: { year: string; trips: Album[] }) {
  return (
    <section className="grid gap-4 md:grid-cols-[11rem_1fr] md:gap-8">
      <div className="md:sticky md:top-24 md:self-start">
        <h3 className="font-display text-5xl leading-none font-extrabold tracking-[-0.04em] tabular-nums" style={{ fontStretch: "125%" }}>
          {year}
        </h3>
        <p className="mt-1 text-sm text-ink-soft">{plural(trips.length, "trip")}</p>
      </div>
      <ol className="border-t border-line">
        {trips.map((a) => (
          <li key={a.id} className="border-b border-line">
            <TripRow album={a} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function TripRow({ album }: { album: Album }) {
  return (
    <Link
      href={`/albums/${album.id}`}
      className="group -mx-2 flex items-center gap-4 rounded-lg px-2 py-3 transition-colors hover:bg-surface/70 sm:gap-5"
    >
      <span className="print shrink-0 p-1">
        <span className="relative block h-14 w-20 overflow-hidden rounded-[1px] bg-surface-2 sm:h-[4.5rem] sm:w-24">
          <SmartImage src={album.coverUrl} alt="" fill sizes="96px" className="object-cover" />
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-lg font-bold tracking-[-0.01em] group-hover:text-accent">
          {album.title}
        </span>
        <span className="flex items-center gap-1 truncate text-sm text-ink-soft">
          <IconPin size={14} className="shrink-0" />
          {album.location}
        </span>
      </span>
      <time dateTime={album.tripDate} className="hidden shrink-0 text-right text-sm sm:block">
        <span className="block font-semibold tabular-nums">{formatDate(album.tripDate)}</span>
        <span className="text-ink-soft">{weekday(album.tripDate)}</span>
      </time>
      <span className="w-20 shrink-0 text-right text-sm text-ink-soft tabular-nums">{plural(album.photoCount, "photo")}</span>
    </Link>
  );
}
