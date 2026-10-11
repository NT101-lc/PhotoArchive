import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { IconCalendar, IconPin } from "@/components/Icons";
import { NewPlanButton } from "@/components/NewPlanButton";
import { PageHero } from "@/components/PageHero";
import { getT } from "@/i18n/server";
import type { Dict } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { formatDateRange } from "@/lib/format";
import { daysUntil, formatVnd, planDays, planTotals } from "@/lib/plan-utils";
import { getCrew, getPlans, type Crewmate, type Plan } from "@/lib/plans";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.plans.metaTitle };
}

export default async function PlansPage() {
  const [plans, crew, { t, locale }] = await Promise.all([getPlans(), getCrew(), getT()]);
  const byId = new Map(crew.map((c) => [c.id, c]));
  const upcoming = plans.filter((p) => daysUntil(p.endDate) >= 0).length;

  return (
    <main className="mx-auto max-w-[1280px] px-4 pb-20 sm:px-6">
      <PageHero
        eyebrow={t.plans.eyebrow}
        title={t.plans.title}
        description={t.plans.description}
        stats={[
          { value: upcoming, label: t.plans.comingUp },
          { value: plans.length - upcoming, label: t.plans.done },
        ]}
        actions={<NewPlanButton />}
      />

      {plans.length === 0 ? (
        <EmptyState icon={<IconCalendar size={26} />} title={t.plans.noPlans} action={<NewPlanButton />}>
          {t.plans.noPlansBody}
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {plans.map((p) => (
            <PlanRow
              key={p.id}
              plan={p}
              going={p.going.map((id) => byId.get(id)).filter((c): c is Crewmate => !!c)}
              t={t}
              locale={locale}
            />
          ))}
        </ul>
      )}
    </main>
  );
}

function countdown(plan: Plan, t: Dict) {
  const start = daysUntil(plan.startDate);
  if (start > 1) return t.plans.inDays(start);
  if (start === 1) return t.plans.tomorrow;
  if (daysUntil(plan.endDate) >= 0) return t.plans.happeningNow;
  return t.plans.finished;
}

/** Một kế hoạch trong danh sách: còn bao lâu, tên, nơi, ngày, mức độ đã lên lịch, ai đi. */
function PlanRow({ plan, going, t, locale }: { plan: Plan; going: Crewmate[]; t: Dict; locale: Locale }) {
  const days = planDays(plan.startDate, plan.endDate).length;
  const filled = Object.keys(plan.cells).length;
  const { total } = planTotals(plan.items, going.length);
  const past = daysUntil(plan.endDate) < 0;

  return (
    <li>
      <Link
        href={`/plans/${plan.slug}`}
        className={`group grid gap-3 rounded-lg border border-line bg-surface p-4 transition-colors hover:border-ink-soft sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:items-center sm:gap-5 sm:p-5 ${
          past ? "opacity-70" : ""
        }`}
      >
        <span className="font-display text-lg leading-none font-extrabold text-edge tabular-nums" style={{ fontStretch: "125%" }}>
          {countdown(plan, t)}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-display text-xl font-bold tracking-[-0.015em] group-hover:text-accent">
            {plan.title}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
            <span className="flex items-center gap-1">
              <IconPin size={14} />
              {plan.location}
            </span>
            <span>
              {formatDateRange(plan.startDate, plan.endDate, locale)}, {t.count.days(days)}
            </span>
            <span>{t.plans.slotsPlanned(filled)}</span>
            {total > 0 && <span>{formatVnd(total)}</span>}
          </span>
        </span>
        <span className="flex items-center">
          {going.map((c) => (
            <span key={c.id} className="-mr-2 rounded-full ring-2 ring-surface last:mr-0" title={c.name}>
              <Avatar name={c.name} url={c.avatarUrl} size={30} />
            </span>
          ))}
          {going.length === 0 && <span className="text-sm text-ink-soft">{t.plans.nobodyIn}</span>}
        </span>
      </Link>
    </li>
  );
}
