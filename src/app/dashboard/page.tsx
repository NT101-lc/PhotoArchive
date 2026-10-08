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
import { formatDate, plural, timeAgo } from "@/lib/format";
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

export const metadata: Metadata = { title: "Dashboard" };

const R2_PRICE_PER_GB_MONTH = 0.015;

export default async function DashboardPage() {
  const me = await getCurrentMember();
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
        eyebrow="The archive in numbers"
        title="Dashboard"
        description={
          totals.years > 0
            ? `Everything the crew has saved across ${plural(totals.years, "year")}.`
            : "Upload the first trip and its numbers show up here."
        }
        stats={[
          { value: totals.trips, label: totals.trips === 1 ? "trip" : "trips" },
          { value: totals.photos, label: totals.photos === 1 ? "photo" : "photos" },
          { value: totals.videos, label: totals.videos === 1 ? "video" : "videos" },
          { value: totals.places, label: totals.places === 1 ? "place" : "places" },
        ]}
      />

      <TheRoll trips={roll.trips} />

      <div className="mb-16 grid gap-14 lg:grid-cols-2 lg:gap-16">
        <Section title="Trips per year" note="Tap or hover a year to see how many photos came back.">
          <TripsByYear data={crew.byYear} />
        </Section>
        <Section title="Places" note="Where the crew has been, most visited first.">
          <Places rows={places} />
        </Section>
        <Section title="Who uploads the most" note="Photos and videos each person has added.">
          <TopUploaders data={crew.uploaders} />
          <QuietMembers members={quiet} />
        </Section>
        <Section title="Recent activity" note="New uploads and comments, newest first.">
          <RecentActivity uploads={uploads} comments={comments} />
        </Section>
      </div>

      <Section
        title={onThisDay.length > 0 ? "On this day" : "From the archive"}
        note={
          onThisDay.length > 0
            ? `Shot within a few days of ${formatDate(new Date().toISOString())} in earlier years.`
            : "Nothing was shot around this date in earlier years, so here are a few frames picked at random. They change every day."
        }
        className="mb-16"
      >
        <OnThisDay items={memories} />
      </Section>

      {admin && <AdminSection />}
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
function TheRoll({ trips }: Roll) {
  if (trips.length === 0) return null;
  return (
    <section aria-labelledby="roll-heading" className="mb-16">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
        <h2 id="roll-heading" className="font-display text-2xl font-extrabold tracking-[-0.02em]">
          The roll so far
        </h2>
        <p className="text-sm text-ink-soft">The first frames of the latest trips. Amber edge marks a video.</p>
      </div>
      <div className="overflow-hidden rounded-[3px] bg-film text-white">
        <div className="sprockets h-3" aria-hidden="true" />
        <ol className="flex flex-col gap-4 px-3 py-3 sm:px-4">
          {trips.map((t, i) => {
            const more = t.total - t.frames.length;
            return (
              <li
                key={t.slug}
                className="animate-develop grid gap-2 md:grid-cols-[12rem_1fr] md:items-center md:gap-5"
                style={{ animationDelay: `${120 + i * 120}ms` }}
              >
                <Link href={`/albums/${t.slug}`} className="group min-w-0">
                  <span className="frame-no block truncate text-xs group-hover:underline">{t.title}</span>
                  <span className="block text-xs text-white/55 tabular-nums">
                    {formatDate(t.tripDate)}, {plural(t.total, "frame")}
                  </span>
                </Link>
                <ul className="grid grid-cols-6 gap-1 sm:gap-1.5">
                  {t.frames.map((f, j) => {
                    const last = j === t.frames.length - 1 && more > 0;
                    return (
                      <li key={f.id}>
                        <Link
                          href={last ? `/albums/${t.slug}` : `/albums/${t.slug}?photo=${f.id}`}
                          aria-label={
                            last ? `Open all ${t.total} frames of ${t.title}` : `${f.kind === "video" ? "Video" : "Photo"} from ${t.title}`
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

function Places({ rows }: { rows: Awaited<ReturnType<typeof getPlaces>> }) {
  if (rows.length === 0) return <p className="text-sm text-ink-soft">No places yet.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs text-ink-soft">
          <th className="py-2 font-medium">Place</th>
          <th className="py-2 text-right font-medium">Trips</th>
          <th className="py-2 text-right font-medium">Photos</th>
          <th className="py-2 pl-4 text-right font-medium">Last trip</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr key={p.location} className="border-b border-line">
            <td className="py-2.5 font-semibold">{p.location}</td>
            <td className="py-2.5 text-right tabular-nums">{p.trips}</td>
            <td className="py-2.5 text-right tabular-nums">{p.photos}</td>
            <td className="py-2.5 pl-4 text-right text-ink-soft tabular-nums">{formatDate(p.lastTrip)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Ai chưa upload gì — chỗ trống thành lời mời. */
function QuietMembers({ members }: { members: Awaited<ReturnType<typeof getQuietMembers>> }) {
  if (members.length === 0) return null;
  const names = members.map((m) => m.name);
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
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
        <span className="text-ink">{list}</span> {names.length === 1 ? "hasn’t" : "haven’t"} added anything yet.{" "}
        <Link href="/albums" className="font-semibold text-ink underline hover:text-accent">
          Open an album to upload
        </Link>
      </p>
    </div>
  );
}


type Upload = Awaited<ReturnType<typeof getRecentUploads>>[number];
type Comment = Awaited<ReturnType<typeof getRecentComments>>[number];

/** Upload và bình luận gần đây trộn theo thời gian. Bình luận dẫn thẳng tới ảnh (mở lightbox). */
function RecentActivity({ uploads, comments }: { uploads: Upload[]; comments: Comment[] }) {
  const items = [
    ...uploads.map((u) => ({ kind: "upload" as const, at: u.at, u })),
    ...comments.map((c) => ({ kind: "comment" as const, at: c.at, c })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8);
  if (items.length === 0) return <p className="text-sm text-ink-soft">Nothing yet.</p>;

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
                <b className="font-semibold">{it.u.name ?? "Someone"}</b> added{" "}
                {[it.u.photos && plural(it.u.photos, "photo"), it.u.videos && plural(it.u.videos, "video")].filter(Boolean).join(" and ")} to{" "}
                <Link href={`/albums/${it.u.albumSlug}`} className="font-semibold hover:text-accent">
                  {it.u.albumTitle}
                </Link>
                <span className="block text-xs text-ink-soft">{timeAgo(it.at)}</span>
              </p>
            </>
          ) : (
            <>
              <Avatar name={it.c.name} url={it.c.avatarUrl} size={30} />
              <p className="min-w-0 flex-1 text-sm leading-snug">
                <b className="font-semibold">{it.c.name}</b> commented on{" "}
                <Link href={`/albums/${it.c.albumSlug}?photo=${it.c.photoId}`} className="font-semibold hover:text-accent">
                  a photo in {it.c.albumTitle}
                </Link>
                <span className="mt-1 line-clamp-2 border-l-2 border-line pl-2 text-ink-soft">{it.c.body}</span>
                <span className="mt-1 block text-xs text-ink-soft">{timeAgo(it.at)}</span>
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
function OnThisDay({ items }: { items: Memory[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-ink-soft/50 px-5 py-8 text-center text-sm text-ink-soft">
        Nothing from this week in earlier years yet. Come back on another day, or after the next trip.
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
              aria-label={`${m.kind === "video" ? "Video" : "Photo"} from ${m.albumTitle}, ${m.year}`}
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

async function AdminSection() {
  const [storage, queue] = await Promise.all([getStorageStats().catch((err: Error) => err), getVideoQueue()]);

  return (
    <section aria-labelledby="admin-heading" className="border-t border-line pt-10">
      <p className="eyebrow">Only the admin sees this part</p>
      <h2 id="admin-heading" className="mb-8 font-display text-3xl font-extrabold tracking-[-0.02em]">
        Storage and videos
      </h2>
      <div className="grid gap-14 lg:grid-cols-[5fr_6fr] lg:gap-16">
        <Section title="Storage on R2" note="Measured from the bucket itself, so it includes every copy and poster.">
          {storage instanceof Error ? (
            <p role="alert" className="text-sm text-danger">
              Couldn’t read the bucket: {storage.message}
            </p>
          ) : (
            <StorageBlock stats={storage} />
          )}
        </Section>
        <Section title="Video processing" note="Videos that aren’t playable yet. This list refreshes by itself.">
          <VideoQueue items={queue.items} stuck={queue.stuck} />
        </Section>
      </div>
    </section>
  );
}

const gb = (bytes: number) => bytes / 1000 ** 3;
const fmtGB = (bytes: number) => `${gb(bytes) < 10 ? gb(bytes).toFixed(2) : gb(bytes).toFixed(1)} GB`;
const fmtSize = (bytes: number) => (bytes >= 1000 ** 3 ? fmtGB(bytes) : `${Math.round(bytes / 1000 ** 2)} MB`);

function StorageBlock({ stats }: { stats: Awaited<ReturnType<typeof getStorageStats>> }) {
  const share = stats.total / R2_FREE_BYTES;
  const pct = Math.min(100, share * 100);
  // Mức độ: dưới 70% bình thường, 70–90% cảnh báo, trên 90% nguy hiểm
  const fill = share >= 0.9 ? "var(--danger)" : share >= 0.7 ? "var(--edge)" : "var(--chart)";
  const { forecast } = stats;

  return (
    <div>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-display text-5xl font-extrabold tracking-[-0.03em]">{fmtGB(stats.total)}</span>
        <span className="text-ink-soft">of the free 10 GB</span>
      </p>
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label="Share of the free storage used"
        className="mt-4 h-2.5 overflow-hidden rounded-full"
        style={{ background: `color-mix(in oklab, ${fill} 18%, transparent)` }}
      >
        <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 0.8)}%`, background: fill }} />
      </div>
      <p className="mt-3 text-sm text-ink-soft">
        {forecast.over
          ? `Over the free tier: the extra ${fmtGB(stats.total - R2_FREE_BYTES)} costs about $${(gb(stats.total - R2_FREE_BYTES) * R2_PRICE_PER_GB_MONTH).toFixed(2)} a month.`
          : forecast.daysLeft === null
            ? `No uploads in the last ${stats.windowDays} days, so there’s nothing to forecast.`
            : `At the pace of the last ${stats.windowDays} days (about ${fmtSize(forecast.bytesPerDay)} a day), the free tier lasts until ${formatDate(forecast.date!.toISOString())}.`}
      </p>

      <table className="mt-6 w-full text-sm">
        <caption className="sr-only">Storage by type</caption>
        <thead>
          <tr className="border-b border-line text-left text-xs text-ink-soft">
            <th className="py-2 font-medium">Type</th>
            <th className="py-2 text-right font-medium">Size</th>
            <th className="py-2 text-right font-medium">Share</th>
          </tr>
        </thead>
        <tbody>
          {(Object.keys(STORAGE_CATEGORIES) as StorageCategory[]).map((k) => (
            <tr key={k} className="border-b border-line">
              <td className="py-2">{STORAGE_CATEGORIES[k]}</td>
              <td className="py-2 text-right tabular-nums">{fmtSize(stats.bytes[k])}</td>
              <td className="py-2 text-right text-ink-soft tabular-nums">
                {stats.total ? `${Math.round((stats.bytes[k] / stats.total) * 100)}%` : "0%"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-ink-soft">{plural(stats.objectCount, "file")} in the bucket.</p>
    </div>
  );
}
