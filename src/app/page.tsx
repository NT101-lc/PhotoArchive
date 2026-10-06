import Link from "next/link";
import type { ReactNode } from "react";
import { FilmTicker } from "@/components/FilmTicker";
import {
  IconArrowRight,
  IconCalendar,
  IconFolder,
  IconGrid,
  IconImage,
  IconPin,
  IconTimeline,
  IconUpload,
} from "@/components/Icons";
import { SmartImage } from "@/components/SmartImage";
import { UploadButton } from "@/components/UploadModal";
import { getAlbums, getPhotos } from "@/lib/data";
import { dayKey, formatDate, pad2, plural, yearOf } from "@/lib/format";
import type { Album } from "@/lib/types";

// Trang chủ dạng landing: dải phim → hero → lối tắt → chuyến gần nhất → dòng thời gian → footer
export default async function HomePage() {
  const albums = await getAlbums(); // mới nhất trước
  const latest = albums[0];
  const latestPhotos = latest ? await getPhotos(latest.id) : [];

  const totalPhotos = albums.reduce((s, a) => s + a.photoCount, 0);
  const places = new Set(albums.map((a) => a.location)).size;
  const years = [...new Set(albums.map((a) => yearOf(a.tripDate)))];
  const albumOptions = albums.map(({ id, title }) => ({ id, title }));

  return (
    <>
      <FilmTicker albums={albums} />

      <main className="mx-auto max-w-[1280px] px-4 pb-16 sm:px-6">
        {/* ---------- Hero ---------- */}
        <section className="grid items-center gap-10 py-10 lg:grid-cols-[1.1fr_1fr] lg:py-16">
          <div>
            <span className="inline-block rounded-md border-2 border-line bg-butter px-2.5 py-1 font-mono text-[0.68rem] font-bold tracking-[0.14em] text-on-accent uppercase shadow-hard-sm">
              The B6 crew’s private archive
            </span>
            <h1 className="mt-5 font-display text-[3.2rem] leading-[0.9] font-extrabold tracking-[-0.04em] sm:text-[4.6rem]">
              Keep every
              <br />
              trip<span className="text-accent">.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-ink-soft">
              Wherever we go, whatever we shoot, it all lands in one place. Each trip is an album — everyone drops their photos in, and we can relive it any time.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/albums" className="btn btn-primary h-12 px-6 text-base">
                Browse all albums
                <IconArrowRight size={18} />
              </Link>
              <UploadButton albums={albumOptions} className="btn h-12 px-6 text-base">
                <IconUpload size={18} />
                Upload photos
              </UploadButton>
            </div>

            <dl className="mt-10 grid max-w-lg grid-cols-4 gap-2 border-t-2 border-dashed border-line pt-5">
              <HeroStat value={albums.length} label="Albums" />
              <HeroStat value={totalPhotos} label="Photos" accent />
              <HeroStat value={places} label="Places" />
              <HeroStat value={years.length} label="Years" />
            </dl>
          </div>

          <PrintStack albums={albums.slice(0, 3)} />
        </section>

        {/* ---------- Lối tắt ---------- */}
        <SectionHeading eyebrow="Where to start" title="Shortcuts" />
        <div className="mb-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <ShortcutCard
            n={1}
            href="/albums"
            color="bg-accent"
            icon={<IconGrid size={26} />}
            tag="Library"
            title="All albums"
            desc="Search by name, filter by year or place, sort by photo count."
            cta="Open library"
          />
          {latest && (
            <ShortcutCard
              n={2}
              href={`/albums/${latest.id}`}
              color="bg-teal"
              icon={<IconImage size={26} />}
              tag="Latest"
              title={latest.title}
              desc={`${latest.location} · ${formatDate(latest.tripDate)} · ${plural(latest.photoCount, "photo")}.`}
              cta="See this trip"
            />
          )}
          <UploadButton albums={albumOptions} className="group card flex flex-col p-5 text-left transition-[transform,box-shadow] duration-150 hover:-translate-y-1 hover:shadow-hard-lg">
            <ShortcutBody
              n={3}
              color="bg-butter"
              icon={<IconFolder size={26} />}
              tag="Contribute"
              title="Upload photos / folders"
              desc="Drop in a whole folder from your last trip — we'll suggest a new album named after it."
              cta="Open uploader"
            />
          </UploadButton>
          <ShortcutCard
            n={4}
            href="#timeline"
            color="bg-lilac"
            icon={<IconTimeline size={26} />}
            tag="Memories"
            title="Timeline"
            desc={`${plural(years.length, "year")}, ${plural(albums.length, "trip")} — relive them year by year.`}
            cta="Scroll down"
          />
        </div>

        {/* ---------- Chuyến gần nhất ---------- */}
        {latest && (
          <section className="mb-16">
            <SectionHeading eyebrow="Just got back" title="Latest trip" />
            <div className="card overflow-hidden p-0">
              <div className="grid lg:grid-cols-[1.2fr_1fr]">
                <Link href={`/albums/${latest.id}`} className="group relative block aspect-[16/10] border-b-2 border-line lg:aspect-auto lg:min-h-[340px] lg:border-r-2 lg:border-b-0">
                  <SmartImage
                    src={latest.coverUrl}
                    alt={`Cover of ${latest.title}`}
                    fill
                    sizes="(max-width: 1024px) 100vw, 55vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                </Link>
                <div className="flex flex-col gap-5 p-6 sm:p-8">
                  <div>
                    <span className="eyebrow">Album №01</span>
                    <h2 className="mt-1 font-display text-4xl leading-none font-extrabold tracking-[-0.03em]">
                      {latest.title}
                      <span className="text-accent">.</span>
                    </h2>
                    <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-soft">
                      <span className="flex items-center gap-1.5">
                        <IconPin size={15} />
                        <b className="font-semibold text-ink">{latest.location}</b>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <IconCalendar size={15} />
                        {formatDate(latest.tripDate)}
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Pill label="Photos" value={latestPhotos.length} />
                    <Pill label="People" value={new Set(latestPhotos.map((p) => p.uploadedBy)).size} />
                    <Pill label="Days" value={new Set(latestPhotos.map((p) => dayKey(p.takenAt))).size} highlight />
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {latestPhotos.slice(0, 4).map((p, i) => (
                      <Link
                        key={p.id}
                        href={`/albums/${latest.id}?photo=${p.id}`}
                        className="relative aspect-square overflow-hidden rounded-lg border-2 border-line bg-surface-2 transition-transform hover:-translate-y-0.5"
                        aria-label={`View photo ${i + 1}`}
                      >
                        <SmartImage src={p.thumbUrl} alt="" fill sizes="120px" className="object-cover" />
                        {i === 3 && latestPhotos.length > 4 && (
                          <span className="absolute inset-0 flex items-center justify-center bg-black/55 font-display text-lg font-bold text-white">
                            +{latestPhotos.length - 4}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>

                  <Link href={`/albums/${latest.id}`} className="btn btn-primary mt-auto self-start">
                    Open album
                    <IconArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ---------- Dòng thời gian ---------- */}
        <section id="timeline" className="mb-8 scroll-mt-24">
          <SectionHeading eyebrow="Year by year" title="Timeline" />
          <ol className="flex flex-col gap-8">
            {years.map((year) => (
              <li key={year} className="grid gap-4 md:grid-cols-[140px_1fr]">
                <div className="flex items-baseline gap-3 md:block">
                  <span className="font-display text-5xl leading-none font-extrabold tracking-[-0.04em]">{year}</span>
                  <span className="font-mono text-xs text-ink-soft md:mt-2 md:block">
                    {plural(albums.filter((a) => yearOf(a.tripDate) === year).length, "trip")}
                  </span>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {albums
                    .filter((a) => yearOf(a.tripDate) === year)
                    .map((a) => (
                      <TimelineRow key={a.id} album={a} />
                    ))}
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t-2 border-line">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-2 px-4 py-6 font-mono text-xs text-ink-soft sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>
            © 2026 <b className="text-ink">B6 PhotoArchive</b> · Private archive, members only.
          </span>
          <span className="flex gap-4">
            <Link href="/albums" className="hover:text-ink">
              Album
            </Link>
            <Link href="/login" className="hover:text-ink">
              Sign in
            </Link>
          </span>
        </div>
      </footer>
    </>
  );
}

function HeroStat({ value, label, accent = false }: { value: number; label: string; accent?: boolean }) {
  return (
    <div>
      <dd className={`font-display text-3xl font-extrabold tabular-nums ${accent ? "text-accent" : ""}`}>{value}</dd>
      <dt className="font-mono text-[0.62rem] font-bold tracking-[0.12em] text-ink-soft uppercase">{label}</dt>
    </div>
  );
}

/** 3 ảnh bìa gần nhất xếp chồng như ảnh in để trên bàn. */
function PrintStack({ albums }: { albums: Album[] }) {
  const placements = [
    "left-[2%] top-[12%] w-[58%] -rotate-[7deg] z-10",
    "right-[2%] top-[2%] w-[52%] rotate-[5deg] z-20",
    "left-[22%] bottom-[2%] w-[56%] -rotate-[1deg] z-30",
  ];
  return (
    <div className="relative mx-auto aspect-[5/4] w-full max-w-[560px]" aria-hidden="true">
      {albums.map((a, i) => (
        <Link
          key={a.id}
          href={`/albums/${a.id}`}
          tabIndex={-1}
          className={`absolute rounded-md border-2 border-line bg-surface p-2 pb-8 shadow-hard-lg transition-transform duration-200 hover:z-40 hover:rotate-0 hover:scale-[1.03] ${placements[i]}`}
        >
          <div className="relative aspect-[4/3] overflow-hidden rounded-sm bg-surface-2">
            <SmartImage src={a.coverUrl} alt="" fill preload={i === 2} sizes="320px" className="object-cover" />
          </div>
          <span className="absolute bottom-2 left-3 font-mono text-[0.65rem] font-bold text-ink-soft">
            {a.location.toUpperCase()} · {yearOf(a.tripDate)}
          </span>
        </Link>
      ))}
      {/* Mẩu băng dính */}
      <span className="absolute top-[4%] left-[38%] z-40 h-6 w-20 -rotate-12 bg-butter/80 shadow-sm" />
    </div>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4 border-b-2 border-dashed border-line pb-3">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="font-display text-3xl font-extrabold tracking-[-0.03em]">{title}</h2>
      </div>
    </div>
  );
}

type ShortcutContent = {
  n: number;
  color: string;
  icon: ReactNode;
  tag: string;
  title: string;
  desc: string;
  cta: string;
};

function ShortcutBody({ n, color, icon, tag, title, desc, cta }: ShortcutContent) {
  return (
    <>
      <span className="mb-5 flex items-center justify-between">
        <span className="font-mono text-sm font-bold text-ink-soft">{pad2(n)}</span>
        <span className="tag">{tag}</span>
      </span>
      <span
        className={`mb-5 flex h-14 w-14 rotate-[-6deg] items-center justify-center rounded-xl border-2 border-line text-on-accent shadow-hard-sm transition-transform group-hover:rotate-0 ${color}`}
      >
        {icon}
      </span>
      <span className="block font-display text-xl leading-tight font-bold tracking-tight">{title}</span>
      <span className="mt-2 mb-5 block flex-1 text-sm text-ink-soft">{desc}</span>
      <span className="flex items-center justify-between border-t-2 border-dashed border-line pt-3 text-sm font-bold">
        {cta}
        <IconArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
      </span>
    </>
  );
}

function ShortcutCard({ href, ...content }: ShortcutContent & { href: string }) {
  return (
    <Link
      href={href}
      className="group card flex flex-col p-5 transition-[transform,box-shadow] duration-150 hover:-translate-y-1 hover:shadow-hard-lg"
    >
      <ShortcutBody {...content} />
    </Link>
  );
}

function Pill({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border-2 border-line px-3 py-1 text-sm ${
        highlight ? "bg-accent text-on-accent" : "bg-surface-2"
      }`}
    >
      <span className={highlight ? "" : "text-ink-soft"}>{label}</span>
      <b className="font-display">{value}</b>
    </span>
  );
}

function TimelineRow({ album }: { album: Album }) {
  return (
    <Link
      href={`/albums/${album.id}`}
      className="group flex items-center gap-3 rounded-xl border-2 border-line bg-surface p-2 pr-4 transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-hard-sm"
    >
      <span className="relative h-16 w-20 shrink-0 overflow-hidden rounded-lg border-2 border-line bg-surface-2">
        <SmartImage src={album.coverUrl} alt="" fill sizes="96px" className="object-cover" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display font-bold">{album.title}</span>
        <span className="block truncate text-sm text-ink-soft">
          {album.location} · {formatDate(album.tripDate)}
        </span>
      </span>
      <span className="tag shrink-0">{plural(album.photoCount, "photo")}</span>
    </Link>
  );
}
