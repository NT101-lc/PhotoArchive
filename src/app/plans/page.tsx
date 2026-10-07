import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { IconCalendar, IconPin } from "@/components/Icons";
import { NewPlanButton } from "@/components/NewPlanButton";
import { PageHero } from "@/components/PageHero";
import { formatDateRange, plural } from "@/lib/format";
import { daysUntil, formatVnd, planDays, planTotals } from "@/lib/plan-utils";
import { getCrew, getPlans, type Crewmate, type Plan } from "@/lib/plans";

export const metadata: Metadata = { title: "Plans" };

export default async function PlansPage() {
  const [plans, crew] = await Promise.all([getPlans(), getCrew()]);
  const byId = new Map(crew.map((c) => [c.id, c]));
  const upcoming = plans.filter((p) => daysUntil(p.endDate) >= 0).length;

  return (
    <main className="mx-auto max-w-[1280px] px-4 pb-20 sm:px-6">
      <PageHero
        eyebrow="Planner"
        title="Trips we’re planning"
        description="One sheet per trip: who’s in, what happens each day, what to book and what it costs."
        stats={[
          { value: upcoming, label: "coming up" },
          { value: plans.length - upcoming, label: "done" },
        ]}
        actions={<NewPlanButton />}
      />

      {plans.length === 0 ? (
        <EmptyState icon={<IconCalendar size={26} />} title="No plans yet" action={<NewPlanButton />}>
          Start a plan for the next trip. You get a sheet with one column per day that the whole crew can fill in.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {plans.map((p) => (
            <PlanRow key={p.id} plan={p} going={p.going.map((id) => byId.get(id)).filter((c): c is Crewmate => !!c)} />
          ))}
        </ul>
      )}
    </main>
  );
}

function countdown(plan: Plan) {
  const start = daysUntil(plan.startDate);
  if (start > 1) return `in ${start} days`;
  if (start === 1) return "tomorrow";
  if (daysUntil(plan.endDate) >= 0) return "happening now";
  return "done";
}

/** Một kế hoạch trong danh sách: còn bao lâu, tên, nơi, ngày, mức độ đã lên lịch, ai đi. */
function PlanRow({ plan, going }: { plan: Plan; going: Crewmate[] }) {
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
          {countdown(plan)}
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
              {formatDateRange(plan.startDate, plan.endDate)}, {plural(days, "day")}
            </span>
            <span>{plural(filled, "slot")} planned</span>
            {total > 0 && <span>{formatVnd(total)}</span>}
          </span>
        </span>
        <span className="flex items-center">
          {going.map((c) => (
            <span key={c.id} className="-mr-2 rounded-full ring-2 ring-surface last:mr-0" title={c.name}>
              <Avatar name={c.name} url={c.avatarUrl} size={30} />
            </span>
          ))}
          {going.length === 0 && <span className="text-sm text-ink-soft">Nobody in yet</span>}
        </span>
      </Link>
    </li>
  );
}
