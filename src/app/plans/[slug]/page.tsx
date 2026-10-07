import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IconCalendar, IconPin } from "@/components/Icons";
import { PageHero } from "@/components/PageHero";
import { PlanSheet } from "@/components/PlanSheet";
import { formatDateRange } from "@/lib/format";
import { daysUntil, planDays } from "@/lib/plan-utils";
import { getCrew, getPlan, planCreatorName } from "@/lib/plans";

export async function generateMetadata({ params }: PageProps<"/plans/[slug]">): Promise<Metadata> {
  const plan = await getPlan((await params).slug);
  return { title: plan?.title ?? "Plan not found" };
}

export default async function PlanPage({ params }: PageProps<"/plans/[slug]">) {
  const { slug } = await params;
  const [plan, crew] = await Promise.all([getPlan(slug), getCrew()]);
  if (!plan) notFound();
  const creator = await planCreatorName(plan.createdById);

  const days = planDays(plan.startDate, plan.endDate).length;
  const until = daysUntil(plan.startDate);

  return (
    <main className="mx-auto max-w-[1280px] px-4 pb-24 sm:px-6">
      <PageHero
        backHref="/plans"
        eyebrow="All plans"
        title={plan.title}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1.5">
              <IconPin size={15} />
              <b className="font-semibold text-ink">{plan.location}</b>
            </span>
            <span className="flex items-center gap-1.5">
              <IconCalendar size={15} />
              {formatDateRange(plan.startDate, plan.endDate)}
            </span>
            {creator && <span>Started by {creator}</span>}
          </span>
        }
        stats={[
          ...(until > 0 ? [{ value: until, label: until === 1 ? "day to go" : "days to go" }] : []),
          { value: days, label: days === 1 ? "day" : "days" },
        ]}
      />
      <PlanSheet initial={plan} crew={crew} />
    </main>
  );
}
