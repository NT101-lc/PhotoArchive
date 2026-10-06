import Link from "next/link";
import type { ReactNode } from "react";
import { IconArrowLeft } from "./Icons";

export type Stat = { value: number | string; label: string };

type Props = {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  backHref?: string;
  stats?: Stat[];
  actions?: ReactNode;
};

/** Phần đầu trang: dòng phụ, tiêu đề lớn bản rộng, số liệu dạng chữ thường, nút hành động. */
export function PageHero({ eyebrow, title, description, backHref, stats = [], actions }: Props) {
  return (
    <header className="mb-10 flex flex-col gap-6 border-b border-line pt-10 pb-7 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <div className="mb-2 flex items-center gap-2">
          {backHref && (
            <Link
              href={backHref}
              className="-ml-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-sm font-medium text-ink-soft hover:text-ink"
            >
              <IconArrowLeft size={16} />
              {eyebrow}
            </Link>
          )}
          {!backHref && <span className="eyebrow">{eyebrow}</span>}
        </div>
        <h1
          className="font-display text-[clamp(2.2rem,5.5vw,3.75rem)] leading-[0.95] font-extrabold tracking-[-0.035em] break-words text-balance"
          style={{ fontStretch: "125%" }}
        >
          {title}
        </h1>
        {description && <div className="mt-3 max-w-xl text-ink-soft">{description}</div>}
        {stats.length > 0 && (
          <dl className="mt-5 flex flex-wrap gap-x-7 gap-y-2">
            {stats.map((s) => (
              <div key={s.label} className="flex items-baseline gap-1.5">
                <dd className="font-display text-2xl font-extrabold tabular-nums">{s.value}</dd>
                <dt className="text-sm text-ink-soft">{s.label}</dt>
              </div>
            ))}
          </dl>
        )}
      </div>

      {actions && <div className="flex flex-wrap gap-2 lg:shrink-0 lg:justify-end max-sm:[&>*]:flex-1">{actions}</div>}
    </header>
  );
}
