import type { ReactNode } from "react";

/** Empty state: tiêu đề + gợi ý + hành động. Khung nét đứt như ô ảnh trống. */
export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto my-10 flex max-w-md flex-col items-center rounded-2xl border-2 border-dashed border-line bg-surface/60 px-6 py-12 text-center">
      <div className="mb-4 flex h-14 w-14 rotate-[-6deg] items-center justify-center rounded-xl border-2 border-line bg-butter text-on-accent shadow-hard-sm">
        {icon}
      </div>
      <h3 className="mb-2 font-display text-2xl font-extrabold tracking-tight">{title}</h3>
      <p className="mb-6 text-[0.95rem] text-ink-soft">{children}</p>
      {action}
    </div>
  );
}
