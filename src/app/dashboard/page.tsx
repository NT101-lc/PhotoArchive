import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Avatar } from "@/components/Avatar";
import { TopUploaders, TripsByYear } from "@/components/DashboardCharts";
import { IconPlay } from "@/components/Icons";
import { PageHero } from "@/components/PageHero";
import { SmartImage } from "@/components/SmartImage";
import { VideoQueue } from "@/components/VideoQueue";
import { ROLE_ADMIN } from "@/db";
import { getCurrentMember } from "@/lib/auth";
import { formatDate, timeAgo } from "@/lib/format";
import { getT } from "@/i18n/server";
import type { Dict } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { getRecentComments } from "@/lib/social";
import {
  getCrewStats,
  getOnThisDay,
  getPlaces,
  getQuietMembers,
  getRandomFrames,
  getRecentUploads,
  getRoll,
  getStorageStats,
  getVideoQueue,
} from "@/lib/stats";
import { R2_FREE_BYTES, STORAGE_CATEGORIES, type StorageCategory } from "@/lib/storage-stats";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.dash.metaTitle };
}

const R2_PRICE_PER_GB_MONTH = 0.015;

export default async function DashboardPage() {
  const [me, { t, locale }] = await Promise.all([getCurrentMember(), getT()]);
  if (!me) redirect("/login?next=/dashboard");
  const admin = me.role === ROLE_ADMIN;

  const [crew, onThisDay, roll, places, uploads, comments, quiet] = await Promise.all([
    getCrewStats(),
    getOnThisDay(),
    getRoll(),
    getPlaces(),
    getRecentUploads(8),
    getRecentComments(8),
    getQuietMembers(),
  ]);
  // Không có ảnh nào quanh ngày này năm xưa → vài khung ngẫu nhiên (đổi mỗi ngày) để mục này không trống
  const memories = onThisDay.length > 0 ? onThisDay : await getRandomFrames();
  const { totals } = crew;

  return (
    <main className="mx-auto max-w-[1280px] px-4 pb-20 sm:px-6">
      <PageHero
        eyebrow={t.dash.eyebrow}
        title={t.dash.title}
        description={t.dash.description(totals.years)}
        stats={[
          { value: totals.trips, label: t.dash.stat.trips(totals.trips) },
          { value: totals.photos, label: t.dash.stat.photos(totals.photos) },
          { value: totals.videos, label: t.dash.stat.videos(totals.videos) },
          { value: totals.places, label: t.dash.stat.places(totals.places) },
        ]}
      />

      <TheRoll trips={roll.trips} t={t} locale={locale} />

      <div className="mb-16 grid gap-14 lg:grid-cols-2 lg:gap-16">
        <Section title={t.dash.tripsPerYear} note={t.dash.tripsPerYearNote}>
          <TripsByYear data={crew.byYear} />
        </Section>
        <Section title={t.dash.places} note={t.dash.placesNote}>
          <Places rows={places} t={t} locale={locale} />
        </Section>
        <Section title={t.dash.topUploaders} note={t.dash.topUploadersNote}>
          <TopUploaders data={crew.uploaders} />
          <QuietMembers members={quiet} t={t} />
        </Section>
        <Section title={t.dash.recent} note={t.dash.recentNote}>
          <RecentActivity uploads={uploads} comments={comments} t={t} locale={locale} />
        </Section>
      </div>

      <Section
        title={onThisDay.length > 0 ? t.dash.onThisDay : t.dash.fromArchive}
        note={onThisDay.length > 0 ? t.dash.onThisDayNote(formatDate(new Date().toISOString(), locale)) : t.dash.randomNote}
        className="mb-16"
      >
        <OnThisDay items={memories} t={t} />
      </Section>

      {admin && <AdminSection t={t} locale={locale} />}
    </main>
  );
}

function Section({ title, note, children, className = "" }: { title: string; note: string; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em]">{title}</h2>
      <p className="mt-1 mb-6 text-sm text-ink-soft">{note}</p>
      {children}
    </section>
  );
}

type Roll = Awaited<ReturnType<typeof getRoll>>;

/**
 * Điểm nhấn của trang: các chuyến gần đây như những dải contact sheet. Mỗi chuyến vài khung đầu
 * (bấm để mở), khung cuối là "+N" dẫn vào album. Tên chuyến in màu hổ phách như chữ trên phim.
 */
function TheRoll({ trips, t, locale }: Roll & { t: Dict; locale: Locale }) {
  if (trips.length === 0) return null;
  return (
    <section aria-labelledby="roll-heading" className="mb-16">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
        <h2 id="roll-heading" className="font-display text-2xl font-extrabold tracking-[-0.02em]">
          {t.dash.roll}
        </h2>
        <p className="text-sm text-ink-soft">{t.dash.rollNote}</p>
      </div>
      <div className="overflow-hidden rounded-[3px] bg-film text-white">
        <div className="sprockets h-3" aria-hidden="true" />
        <ol className="flex flex-col gap-4 px-3 py-3 sm:px-4">
          {trips.map((trip, i) => {
            const more = trip.total - trip.frames.length;
            return (
              <li
                key={trip.slug}
                className="animate-develop grid gap-2 md:grid-cols-[12rem_1fr] md:items-center md:gap-5"
                style={{ animationDelay: `${120 + i * 120}ms` }}
              >
                <Link href={`/albums/${trip.slug}`} className="group min-w-0">
                  <span className="frame-no block truncate text-xs group-hover:underline">{trip.title}</span>
                  <span className="block text-xs text-white/55 tabular-nums">
                    {formatDate(trip.tripDate, locale)}, {t.count.frames(trip.total)}
                  </span>
                </Link>
                <ul className="grid grid-cols-6 gap-1 sm:gap-1.5">
                  {trip.frames.map((f, j) => {
                    const last = j === trip.frames.length - 1 && more > 0;
                    return (
                      <li key={f.id}>
                        <Link
                          href={last ? `/albums/${trip.slug}` : `/albums/${trip.slug}?photo=${f.id}`}
                          aria-label={
                            last ? t.dash.openAllFrames(trip.total, trip.title) : t.dash.mediaFrom(f.kind === "video", trip.title)
                          }
                          className="relative block aspect-[3/2] overflow-hidden rounded-[1px] bg-white/10 transition-[filter] hover:brightness-125"
                        >
                          <SmartImage src={f.thumbUrl} alt="" fill sizes="(max-width: 768px) 16vw, 160px" className="object-cover" />
                          {f.kind === "video" && <span className="absolute inset-x-0 bottom-0 h-[3px] bg-edge" aria-hidden="true" />}
                          {last && (
                            <span className="absolute inset-0 flex items-center justify-center bg-black/60 font-display text-sm font-extrabold sm:text-base">
                              +{more + 1}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ol>
        <div className="sprockets h-3" aria-hidden="true" />
      </div>
    </section>
  );
}

function Places({ rows, t, locale }: { rows: Awaited<ReturnType<typeof getPlaces>>; t: Dict; locale: Locale }) {
  if (rows.length === 0) return <p className="text-sm text-ink-soft">{t.dash.noPlaces}</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs text-ink-soft">
          <th className="py-2 font-medium">{t.dash.place}</th>
          <th className="py-2 text-right font-medium">{t.dash.trips}</th>
          <th className="py-2 text-right font-medium">{t.dash.photos}</th>
          <th className="py-2 pl-4 text-right font-medium">{t.dash.lastTrip}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr key={p.location} className="border-b border-line">
            <td className="py-2.5 font-semibold">{p.location}</td>
            <td className="py-2.5 text-right tabular-nums">{p.trips}</td>
            <td className="py-2.5 text-right tabular-nums">{p.photos}</td>
            <td className="py-2.5 pl-4 text-right text-ink-soft tabular-nums">{formatDate(p.lastTrip, locale)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Ai chưa upload gì — chỗ trống thành lời mời. */
function QuietMembers({ members, t }: { members: Awaited<ReturnType<typeof getQuietMembers>>; t: Dict }) {
  if (members.length === 0) return null;
  const names = members.map((m) => m.name);
  return (
    <div className="mt-6 flex items-center gap-3 border-t border-line pt-4">
      <span className="flex shrink-0 -space-x-2">
        {members.slice(0, 5).map((m) => (
          <span key={m.id} className="rounded-full ring-2 ring-bg">
            <Avatar name={m.name} url={m.avatarUrl} size={26} />
          </span>
        ))}
      </span>
      <p className="text-sm text-ink-soft">
        {t.dash.quiet(names)}{" "}
        <Link href="/albums" className="font-semibold text-ink underline hover:text-accent">
          {t.dash.openToUpload}
        </Link>
      </p>
    </div>
  );
}


type Upload = Awaited<ReturnType<typeof getRecentUploads>>[number];
type Comment = Awaited<ReturnType<typeof getRecentComments>>[number];

/** Upload và bình luận gần đây trộn theo thời gian. Bình luận dẫn thẳng tới ảnh (mở lightbox). */
function RecentActivity({ uploads, comments, t, locale }: { uploads: Upload[]; comments: Comment[]; t: Dict; locale: Locale }) {
  const items = [
    ...uploads.map((u) => ({ kind: "upload" as const, at: u.at, u })),
    ...comments.map((c) => ({ kind: "comment" as const, at: c.at, c })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8);
  if (items.length === 0) return <p className="text-sm text-ink-soft">{t.dash.nothingYet}</p>;

  return (
    <ol className="flex flex-col">
      {items.map((it) => (
        <li
          key={it.kind === "comment" ? it.c.id : `${it.u.albumSlug}-${it.u.at}-${it.u.name}`}
          className="flex items-start gap-3 border-b border-line py-3 first:pt-0 last:border-b-0"
        >
          {it.kind === "upload" ? (
            <>
              <Avatar name={it.u.name ?? "?"} url={it.u.avatarUrl} size={30} />
              <p className="min-w-0 flex-1 text-sm leading-snug">
                <b className="font-semibold">{it.u.name ?? t.common.someone}</b> {t.dash.added}{" "}
                {[it.u.photos && t.count.photos(it.u.photos), it.u.videos && t.count.videos(it.u.videos)].filter(Boolean).join(t.upload.joinAnd)}{" "}
                {t.dash.to}{" "}
                <Link href={`/albums/${it.u.albumSlug}`} className="font-semibold hover:text-accent">
                  {it.u.albumTitle}
                </Link>
                <span className="block text-xs text-ink-soft">{timeAgo(it.at, undefined, locale)}</span>
              </p>
            </>
          ) : (
            <>
              <Avatar name={it.c.name} url={it.c.avatarUrl} size={30} />
              <p className="min-w-0 flex-1 text-sm leading-snug">
                <b className="font-semibold">{it.c.name}</b> {t.dash.commentedOn}{" "}
                <Link href={`/albums/${it.c.albumSlug}?photo=${it.c.photoId}`} className="font-semibold hover:text-accent">
                  {t.dash.photoIn(it.c.albumTitle)}
                </Link>
                <span className="mt-1 line-clamp-2 border-l-2 border-line pl-2 text-ink-soft">{it.c.body}</span>
                <span className="mt-1 block text-xs text-ink-soft">{timeAgo(it.at, undefined, locale)}</span>
              </p>
            </>
          )}
        </li>
      ))}
    </ol>
  );
}

type Memory = Awaited<ReturnType<typeof getOnThisDay>>[number];

/** Dải phim các ảnh chụp quanh ngày này những năm trước; số trên mép là năm. */
function OnThisDay({ items, t }: { items: Memory[]; t: Dict }) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-ink-soft/50 px-5 py-8 text-center text-sm text-ink-soft">
        {t.dash.nothingThisWeek}
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-[3px] bg-film text-white">
      <div className="sprockets h-3" aria-hidden="true" />
      <ol className="scrollbar-none flex snap-x gap-2 overflow-x-auto px-3 py-1">
        {items.map((m) => (
          <li key={m.id} className="w-44 shrink-0 snap-start sm:w-52">
            <span className="frame-no flex justify-between px-0.5 pb-1 text-[0.68rem]">
              <span>{m.year}</span>
              <span className="truncate pl-2 text-white/60">{m.albumTitle}</span>
            </span>
            <Link
              href={`/albums/${m.albumSlug}?photo=${m.id}`}
              className="group relative block aspect-[3/2] overflow-hidden rounded-[2px] bg-white/5"
              aria-label={t.dash.mediaFromYear(m.kind === "video", m.albumTitle, m.year)}
            >
              <SmartImage src={m.thumbUrl} alt="" fill sizes="208px" className="object-cover group-hover:brightness-110" />
              {m.kind === "video" && (
                <span className="absolute bottom-1.5 left-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60" aria-hidden="true">
                  <IconPlay size={14} />
                </span>
              )}
            </Link>
          </li>
        ))}
      </ol>
      <div className="sprockets h-3" aria-hidden="true" />
    </div>
  );
}

async function AdminSection({ t, locale }: { t: Dict; locale: Locale }) {
  const [storage, queue] = await Promise.all([getStorageStats().catch((err: Error) => err), getVideoQueue()]);

  return (
    <section aria-labelledby="admin-heading" className="border-t border-line pt-10">
      <p className="eyebrow">{t.dash.adminOnly}</p>
      <h2 id="admin-heading" className="mb-8 font-display text-3xl font-extrabold tracking-[-0.02em]">
        {t.dash.storageAndVideos}
      </h2>
      <div className="grid gap-14 lg:grid-cols-[5fr_6fr] lg:gap-16">
        <Section title={t.dash.storage} note={t.dash.storageNote}>
          {storage instanceof Error ? (
            <p role="alert" className="text-sm text-danger">
              {t.dash.couldntReadBucket(storage.message)}
            </p>
          ) : (
            <StorageBlock stats={storage} t={t} locale={locale} />
          )}
        </Section>
        <Section title={t.dash.videoProcessing} note={t.dash.videoProcessingNote}>
          <VideoQueue items={queue.items} stuck={queue.stuck} />
        </Section>
      </div>
    </section>
  );
}

const gb = (bytes: number) => bytes / 1000 ** 3;
const fmtGB = (bytes: number) => `${gb(bytes) < 10 ? gb(bytes).toFixed(2) : gb(bytes).toFixed(1)} GB`;
const fmtSize = (bytes: number) => (bytes >= 1000 ** 3 ? fmtGB(bytes) : `${Math.round(bytes / 1000 ** 2)} MB`);

function StorageBlock({ stats, t, locale }: { stats: Awaited<ReturnType<typeof getStorageStats>>; t: Dict; locale: Locale }) {
  const share = stats.total / R2_FREE_BYTES;
  const pct = Math.min(100, share * 100);
  // Mức độ: dưới 70% bình thường, 70–90% cảnh báo, trên 90% nguy hiểm
  const fill = share >= 0.9 ? "var(--danger)" : share >= 0.7 ? "var(--edge)" : "var(--chart)";
  const { forecast } = stats;

  return (
    <div>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-display text-5xl font-extrabold tracking-[-0.03em]">{fmtGB(stats.total)}</span>
        <span className="text-ink-soft">{t.dash.ofFree}</span>
      </p>
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label={t.dash.freeShare}
        className="mt-4 h-2.5 overflow-hidden rounded-full"
        style={{ background: `color-mix(in oklab, ${fill} 18%, transparent)` }}
      >
        <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 0.8)}%`, background: fill }} />
      </div>
      <p className="mt-3 text-sm text-ink-soft">
        {forecast.over
          ? t.dash.over(fmtGB(stats.total - R2_FREE_BYTES), (gb(stats.total - R2_FREE_BYTES) * R2_PRICE_PER_GB_MONTH).toFixed(2))
          : forecast.daysLeft === null
            ? t.dash.noForecast(stats.windowDays)
            : t.dash.forecast(stats.windowDays, fmtSize(forecast.bytesPerDay), formatDate(forecast.date!.toISOString(), locale))}
      </p>

      <table className="mt-6 w-full text-sm">
        <caption className="sr-only">{t.dash.storageByType}</caption>
        <thead>
          <tr className="border-b border-line text-left text-xs text-ink-soft">
            <th className="py-2 font-medium">{t.dash.type}</th>
            <th className="py-2 text-right font-medium">{t.dash.size}</th>
            <th className="py-2 text-right font-medium">{t.dash.share}</th>
          </tr>
        </thead>
        <tbody>
          {(Object.keys(STORAGE_CATEGORIES) as StorageCategory[]).map((k) => (
            <tr key={k} className="border-b border-line">
              <td className="py-2">{t.dash.categories[k]}</td>
              <td className="py-2 text-right tabular-nums">{fmtSize(stats.bytes[k])}</td>
              <td className="py-2 text-right text-ink-soft tabular-nums">
                {stats.total ? `${Math.round((stats.bytes[k] / stats.total) * 100)}%` : "0%"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-ink-soft">{t.dash.filesInBucket(stats.objectCount)}</p>
    </div>
  );
}
