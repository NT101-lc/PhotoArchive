import type { ReactNode } from "react";

/** Empty state: khung nét đứt như ô ảnh trống trên bàn soi, kèm gợi ý và hành động. */
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
    <div className="mx-auto my-10 flex max-w-md flex-col items-center rounded-lg border border-dashed border-ink-soft/50 px-6 py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-ink-soft">{icon}</div>
      <h3 className="mb-2 font-display text-2xl font-extrabold tracking-tight">{title}</h3>
      <p className="mb-6 max-w-[40ch] text-[0.95rem] text-ink-soft">{children}</p>
      {action}
    </div>
  );
}
