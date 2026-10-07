import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { TopUploaders, TripsByYear } from "@/components/DashboardCharts";
import { IconPlay } from "@/components/Icons";
import { PageHero } from "@/components/PageHero";
import { SmartImage } from "@/components/SmartImage";
import { VideoQueue } from "@/components/VideoQueue";
import { ROLE_ADMIN } from "@/db";
import { getCurrentMember } from "@/lib/auth";
import { formatDate, plural } from "@/lib/format";
import { getCrewStats, getOnThisDay, getStorageStats, getVideoQueue } from "@/lib/stats";
import { R2_FREE_BYTES, STORAGE_CATEGORIES, type StorageCategory } from "@/lib/storage-stats";

export const metadata: Metadata = { title: "Dashboard" };

const R2_PRICE_PER_GB_MONTH = 0.015;

export default async function DashboardPage() {
  const me = await getCurrentMember();
  if (!me) redirect("/login?next=/dashboard");
  const admin = me.role === ROLE_ADMIN;

  const [crew, onThisDay] = await Promise.all([getCrewStats(), getOnThisDay()]);
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

      <div className="mb-16 grid gap-14 lg:grid-cols-2 lg:gap-16">
        <Section title="Trips per year" note="Tap or hover a year to see how many photos came back.">
          <TripsByYear data={crew.byYear} />
        </Section>
        <Section title="Who uploads the most" note="Photos and videos each person has added.">
          <TopUploaders data={crew.uploaders} />
        </Section>
      </div>

      <Section
        title="On this day"
        note={`Shot within a few days of ${formatDate(new Date().toISOString())} in earlier years.`}
        className="mb-16"
      >
        <OnThisDay items={onThisDay} />
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
