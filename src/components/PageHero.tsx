import Link from "next/link";
import type { ReactNode } from "react";
import { IconArrowLeft } from "./Icons";

export type Stat = { value: number | string; label: string; color?: "accent" | "teal" | "lilac" | "butter" | "sky" };

const STAT_BG = {
  accent: "bg-accent text-on-accent",
  teal: "bg-teal text-on-accent",
  lilac: "bg-lilac text-on-accent",
  butter: "bg-butter text-on-accent",
  sky: "bg-sky text-on-accent",
} as const;

type Props = {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  backHref?: string;
  stats?: Stat[];
  actions?: ReactNode;
};

/** Phần đầu trang: nhãn nhỏ phía trên, tiêu đề lớn, thống kê dạng "khung phim", nút hành động. */
export function PageHero({ eyebrow, title, description, backHref, stats = [], actions }: Props) {
  return (
    <header className="mb-8 flex flex-col gap-6 pt-8 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <div className="mb-2 flex items-center gap-2">
          {backHref && (
            <Link
              href={backHref}
              className="-ml-1 inline-flex items-center gap-1 rounded-full px-1 text-ink-soft hover:text-ink"
              aria-label="Back"
            >
              <IconArrowLeft size={16} />
            </Link>
          )}
          <span className="eyebrow">{eyebrow}</span>
        </div>
        <h1 className="font-display text-[2.4rem] leading-[0.95] font-extrabold tracking-[-0.03em] break-words sm:text-[3.4rem]">
          {title}
        </h1>
        {description && <div className="mt-3 max-w-xl text-[0.95rem] text-ink-soft">{description}</div>}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch lg:shrink-0">
        {stats.length > 0 && (
          <dl className="flex gap-2.5">
            {stats.map((s) => (
              <div
                key={s.label}
                className={`flex min-w-[96px] flex-1 flex-col overflow-hidden rounded-xl border-2 border-line shadow-hard-sm ${
                  s.color ? STAT_BG[s.color] : "bg-surface"
                }`}
              >
                <span className="sprockets h-[7px] bg-ink" aria-hidden="true" />
                <dd className="px-3 pt-1.5 font-display text-[1.6rem] leading-none font-extrabold tabular-nums">
                  {s.value}
                </dd>
                <dt className="px-3 pt-1 pb-2 font-mono text-[0.6rem] font-bold tracking-[0.12em] uppercase opacity-80">
                  {s.label}
                </dt>
              </div>
            ))}
          </dl>
        )}
        {actions && <div className="flex gap-2 max-sm:[&>*]:flex-1 sm:flex-col sm:justify-end">{actions}</div>}
      </div>
    </header>
  );
}
