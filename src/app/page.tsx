import type { CSSProperties } from "react";
import Link from "next/link";
import { DragScroll } from "@/components/DragScroll";
import { EmptyState } from "@/components/EmptyState";
import { IconArrowRight, IconImage, IconPin, IconUpload } from "@/components/Icons";
import { SmartImage } from "@/components/SmartImage";
import { BlankStrip } from "@/components/BlankRoll";
import { CoverPrint } from "@/components/CoverPrint";
import { UploadButton } from "@/components/UploadModal";
import { getAlbums, getPhotos } from "@/lib/data";
import { getT } from "@/i18n/server";
import type { Dict } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { dayKey, formatDateRange, formatWeekday, tripDays, yearOf } from "@/lib/format";
import type { Album, Photo } from "@/lib/types";
import { distinctPlaceNames } from "@/lib/places-format";

const SHEET_FRAMES = 6;

// Trang chủ: chuyến gần nhất mở ra như một tờ contact sheet, bên dưới là sổ ghi các chuyến theo năm.
export default async function HomePage() {
  const [albums, { t, locale }] = await Promise.all([getAlbums(), getT()]); // album: mới nhất trước
  const latest = albums[0];
  const latestPhotos = latest ? await getPhotos(latest.id) : [];

  const totalPhotos = albums.reduce((s, a) => s + a.photoCount, 0);
  const places = distinctPlaceNames(albums).length;
  const years = [...new Set(albums.map((a) => yearOf(a.tripDate)))];
  const albumOptions = albums.map(({ id, title, createdById }) => ({ id, title, createdById }));

  if (!latest) {
    return (
      <main className="mx-auto max-w-[1280px] px-4 pb-16 sm:px-6">
        <EmptyState
          icon={<IconImage size={26} />}
          title={t.home.noTrips}
          action={
            <UploadButton albums={albumOptions}>
              <IconUpload size={18} />
              {t.home.uploadFirst}
            </UploadButton>
          }
        >
          {t.home.noTripsBody}
        </EmptyState>
      </main>
    );
  }

  const people = new Set(latestPhotos.map((p) => p.uploadedBy)).size;
  const days = new Set(latestPhotos.map((p) => dayKey(p.takenAt))).size;

  return (
    <>
      {/* Góc các tấm ảnh in xoay lệch (và xoè ra khi rê chuột) thò quá mép màn hình → cắt theo chiều ngang.
          clip chứ không phải hidden: không tạo vùng cuộn mới nên AppBar sticky vẫn chạy. */}
      <main className="overflow-x-clip">
        {/* ---------- Chuyến gần nhất ---------- */}
        <section className="relative isolate mx-auto grid max-w-[1280px] gap-10 px-4 pt-10 pb-10 sm:px-6 sm:pt-14 md:grid-cols-[minmax(0,1fr)_minmax(0,40%)] md:items-center lg:gap-16">
          <div className="glow" aria-hidden="true" />
          <div className="grain" aria-hidden="true" />
          <div className="min-w-0">
            <p className="eyebrow">{t.home.latestTrip(formatDateRange(latest.tripDate, latest.endDate, locale))}</p>
            {/* Chữ gradient từ mực sang xanh nhấn; chỉ pha 35% accent để vẫn đủ tương phản ở cả hai theme */}
            <h1
              className="mt-2 max-w-[16ch] bg-clip-text pb-[0.08em] font-display text-[clamp(2.6rem,6.6vw,5.75rem)] leading-[0.9] font-extrabold tracking-[-0.04em] text-balance text-transparent"
              style={{
                fontStretch: "125%",
                backgroundImage: "linear-gradient(120deg, var(--ink) 35%, color-mix(in oklab, var(--ink) 65%, var(--accent)))",
              }}
            >
              {latest.title}
            </h1>
            {latest.description && (
              <p className="mt-5 line-clamp-4 max-w-[60ch] text-lg leading-relaxed whitespace-pre-line text-ink">
                {latest.description}
              </p>
            )}
            <div className="mt-6 flex flex-col gap-6">
              {latestPhotos.length > 0 ? (
                <div className="flex flex-col gap-3.5">
                  <span className="inline-flex items-center gap-1 self-start text-lg font-semibold text-ink">
                    <IconPin size={18} className="text-accent" />
                    {latest.location}
                  </span>
                  {/* Tem số liệu: nhãn lấy phần chữ của t.dash.stat / t.count (bỏ số đứng đầu) để không thêm chữ mới */}
                  <dl className="grid max-w-md grid-cols-3 gap-2.5">
                    {[
                      { n: latestPhotos.length, label: t.dash.stat.photos(latestPhotos.length), tile: "var(--accent)" },
                      { n: people, label: t.dash.stat.people(people), tile: "var(--teal)" },
                      { n: days, label: t.count.days(days).replace(/^\d+\s*/, ""), tile: "var(--edge)" },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="stat-tile min-w-0 px-3 py-2.5 sm:px-4"
                        style={{ "--tile": s.tile } as CSSProperties}
                      >
                        <dd className="font-display text-2xl leading-none font-extrabold tabular-nums sm:text-3xl">{s.n}</dd>
                        <dt className="mt-1 text-xs text-ink-soft sm:text-sm">{s.label}</dt>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : (
                <p className="max-w-[46ch] text-lg leading-relaxed text-ink-soft">
                  <span className="mr-2 inline-flex items-center gap-1 align-[-2px] font-semibold text-ink">
                    <IconPin size={18} className="text-accent" />
                    {latest.location}
                  </span>
                  {t.home.summary(latestPhotos.length, people, days)}
                </p>
              )}
              <div className="flex flex-wrap gap-2.5">
                <Link href={`/albums/${latest.id}`} className="btn btn-primary h-11 px-5">
                  {t.home.openAlbum}
                </Link>
                <UploadButton albums={albumOptions} className="btn h-11 px-5">
                  <IconUpload size={18} />
                  {t.home.uploadPhotos}
                </UploadButton>
              </div>
            </div>
          </div>

          <PrintStack album={latest} photos={latestPhotos} t={t} />
        </section>

        <ContactSheet album={latest} photos={latestPhotos} t={t} />

        {/* ---------- Sổ chuyến đi ---------- */}
        <section id="timeline" className="mx-auto max-w-[1280px] scroll-mt-24 px-4 pt-16 pb-16 sm:px-6 sm:pt-20">
          <div className="mb-10 flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">{t.home.everyTrip}</h2>
              <span className="mt-2 block h-1 w-10 rounded-full bg-edge" aria-hidden="true" />
              <p className="mt-1.5 text-ink-soft">
                {t.home.totals(albums.length, totalPhotos, places, years[years.length - 1])}
              </p>
            </div>
            <Link href="/albums" className="btn self-start sm:self-auto">
              {t.home.searchFilter}
              <IconArrowRight size={16} />
            </Link>
          </div>

          <Timeline albums={albums} years={years} heroId={latest.id} t={t} locale={locale} />
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-2 px-4 py-6 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>
            <b className="font-display text-ink">thesix</b> {t.home.footerNote}
          </span>
          <span className="flex gap-5">
            <Link href="/albums" className="hover:text-ink">
              {t.nav.albums}
            </Link>
            <Link href="/login" className="hover:text-ink">
              {t.home.switchPerson}
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
function ContactSheet({ album, photos, t }: { album: Album; photos: Photo[]; t: Dict }) {
  const frames = photos.slice(0, SHEET_FRAMES);
  const more = photos.length - frames.length;
  // Chuyến mới nhất chưa có ảnh → dải phim trống, khung đầu là nút upload
  if (frames.length === 0) return <BlankStrip album={album} wide />;

  return (
    <div className="bg-film text-white">
      <div className="sprockets h-4" aria-hidden="true" />
      <ol
        className="scrollbar-none mx-auto flex max-w-[1440px] snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto px-4 sm:scroll-px-6 sm:gap-3 sm:px-6 md:grid md:overflow-visible"
        style={{ gridTemplateColumns: `repeat(${SHEET_FRAMES}, minmax(0, 1fr))` }}
        aria-label={t.home.firstPhotosOf(album.title)}
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
                className="animate-develop group relative block aspect-[3/2] overflow-hidden rounded-[2px] bg-white/5 ring-1 ring-white/15 transition-transform duration-200 hover:-translate-y-0.5 focus-visible:-translate-y-0.5"
                style={{ animationDelay: `${150 + i * 140}ms` }}
                aria-label={last ? t.home.openAllPhotos(photos.length) : t.home.viewPhotoBy(i + 1, p.uploadedBy)}
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
                    <span className="text-xs font-medium text-white/80">{t.home.morePhotos}</span>
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

/**
 * Xấp ảnh in của chuyến mới nhất nằm trên bàn soi: ảnh bìa ở trên, hai tấm khác lệch phía sau.
 * Rê chuột thì xấp ảnh xoè ra; bấm để mở album (ảnh bìa bay sang đầu trang album).
 */
function PrintStack({ album, photos, t }: { album: Album; photos: Photo[]; t: Dict }) {
  const behind = photos.filter((p) => p.thumbUrl && p.thumbUrl !== album.coverUrl).slice(0, 2);
  return (
    <Link
      href={`/albums/${album.id}`}
      prefetch
      className="print-stack group relative mx-auto block w-full max-w-[520px] focus-visible:outline-offset-8 md:mt-6"
      aria-label={t.home.openTitle(album.title)}
    >
      {behind.map((p, i) => (
        <span key={p.id} className="print absolute inset-0" data-layer={i + 1} aria-hidden="true">
          <span className="relative block aspect-[3/2] overflow-hidden rounded-[1px] bg-surface-2">
            <SmartImage src={p.thumbUrl} alt="" fill sizes="(max-width: 768px) 90vw, 40vw" className="object-cover" />
          </span>
        </span>
      ))}
      <CoverPrint album={album} preload sizes="(max-width: 768px) 90vw, 40vw" className="relative" />
    </Link>
  );
}

/** `Sat` cho chuyến trong ngày, `Sat–Mon · 3 days` cho chuyến nhiều ngày (vi: `Th 7–Th 2 · 3 ngày`). */
function tripLabel(a: Album, t: Dict, locale: Locale) {
  if (!a.endDate) return formatWeekday(a.tripDate, locale);
  return `${formatWeekday(a.tripDate, locale)}–${formatWeekday(a.endDate, locale)} · ${t.count.days(tripDays(a.tripDate, a.endDate))}`;
}

/**
 * Dòng thời gian dạng trục ngang, mới nhất bên trái, cuộn ngang (snap theo từng chuyến).
 * Mỗi chuyến: [ngày + thứ] — chấm trên trục — [thẻ chuyến]. Mốc năm là nhãn màu mép phim đè lên trục.
 */
function Timeline({ albums, years, heroId, t, locale }: { albums: Album[]; years: string[]; heroId: string; t: Dict; locale: Locale }) {
  return (
    <div className="relative -mx-4 sm:-mx-6">
      <DragScroll
        className="scrollbar-none flex snap-x snap-mandatory scroll-px-4 overflow-x-auto px-4 pb-2 sm:scroll-px-6 sm:px-6"
        aria-label={t.home.tripsNewestFirst}
      >
        {years.map((year) => {
          const trips = albums.filter((a) => yearOf(a.tripDate) === year);
          return (
            <li key={year} className="flex shrink-0">
              {/* Mốc năm: nhãn nằm trên trục, số chuyến ở dưới */}
              <div className="flex w-20 shrink-0 snap-start flex-col">
                <span className="h-12" />
                <span className="relative flex h-6 items-center">
                  <span aria-hidden="true" className="absolute inset-x-0 h-[2px] bg-ink/25" />
                  <span
                    className="relative rounded-[3px] bg-edge px-2 py-0.5 font-display text-sm leading-none font-extrabold text-film tabular-nums"
                    style={{ fontStretch: "125%" }}
                  >
                    {year}
                  </span>
                </span>
                <span className="mt-3 text-sm text-ink-soft">{t.count.trips(trips.length)}</span>
              </div>

              <ol className="flex">
                {trips.map((a) => (
                  <li key={a.id} className="flex w-60 shrink-0 snap-start flex-col pr-4 sm:w-64 sm:pr-5">
                    <time dateTime={a.tripDate} className="flex h-12 flex-col justify-end pb-1.5">
                      <span className="block truncate font-semibold tabular-nums">{formatDateRange(a.tripDate, a.endDate, locale)}</span>
                      <span className="block truncate text-sm text-ink-soft">{tripLabel(a, t, locale)}</span>
                    </time>
                    <span className="relative flex h-6 items-center" aria-hidden="true">
                      <span className="absolute -right-4 left-0 h-[2px] bg-ink/25 sm:-right-5" />
                      <span className="relative h-4 w-4 rounded-full bg-accent ring-4 ring-bg" />
                    </span>
                    <TripCard album={a} morph={a.id !== heroId} t={t} />
                  </li>
                ))}
              </ol>
            </li>
          );
        })}
      </DragScroll>
    </div>
  );
}

function TripCard({ album, morph, t }: { album: Album; morph: boolean; t: Dict }) {
  return (
    <Link href={`/albums/${album.id}`} prefetch className="group mt-3 block">
      <CoverPrint
        album={album}
        sizes="256px"
        morph={morph}
        className="p-1.5 transition-[transform,box-shadow] duration-200 group-hover:-translate-y-1 group-hover:rotate-[0.6deg] group-hover:shadow-hard-lg"
      />
      <span className="mt-2.5 block truncate font-display text-lg font-bold tracking-[-0.01em] group-hover:text-accent">
        {album.title}
      </span>
      <span className="flex items-center gap-1 text-sm text-ink-soft">
        <IconPin size={14} className="shrink-0" />
        <span className="truncate">
          {album.location}, {t.count.photos(album.photoCount)}
        </span>
      </span>
      {album.description && <span className="mt-0.5 line-clamp-2 text-sm text-ink-soft">{album.description}</span>}
    </Link>
  );
}
