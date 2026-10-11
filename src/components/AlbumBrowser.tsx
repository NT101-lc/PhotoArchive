"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { normalizeText, yearOf } from "@/lib/format";
import type { Album } from "@/lib/types";
import { AlbumCard } from "./AlbumCard";
import { EmptyState } from "./EmptyState";
import { IconClose, IconReset, IconSearch } from "./Icons";
import { distinctPlaceNames, sameName } from "@/lib/places-format";

/** Cách xếp (nhãn trong từ điển: albums.sorts) */
export const SORTS = { newest: true, oldest: true, most: true } as const;
export type SortKey = keyof typeof SORTS;

/** `year` / `place` rỗng = tất cả. Chọn nhiều: cùng hàng là "hoặc", khác hàng là "và". */
export type AlbumFilters = { q: string; year: string[]; place: string[]; sort: SortKey };

type Props = { albums: Album[]; initial: AlbumFilters };

export function AlbumBrowser({ albums, initial }: Props) {
  const [query, setQuery] = useState(initial.q);
  const [year, setYear] = useState<string[]>(initial.year);
  const [place, setPlace] = useState<string[]>(initial.place);
  const [sort, setSort] = useState<SortKey>(initial.sort);
  const searchRef = useRef<HTMLInputElement>(null);
  const { t } = useI18n();

  const years = useMemo(
    () => [...new Set(albums.map((a) => yearOf(a.tripDate)))].sort((a, b) => b.localeCompare(a)),
    [albums],
  );
  // Mỗi nơi của từng chuyến là một lựa chọn lọc ("Đà Lạt, Nha Trang" hiện ở cả Đà Lạt lẫn Nha Trang)
  const places = useMemo(() => distinctPlaceNames(albums).sort((a, b) => a.localeCompare(b, "vi")), [albums]);

  const filtered = useMemo(() => {
    const q = normalizeText(query);
    const list = albums.filter(
      (a) =>
        (year.length === 0 || year.includes(yearOf(a.tripDate))) &&
        (place.length === 0 || a.places.some((p) => place.some((name) => sameName(name, p.name)))) &&
        (!q || normalizeText(`${a.title} ${a.location} ${a.description ?? ""}`).includes(q)),
    );
    return list.sort((a, b) =>
      sort === "oldest"
        ? a.tripDate.localeCompare(b.tripDate)
        : sort === "most"
          ? b.photoCount - a.photoCount
          : b.tripDate.localeCompare(a.tripDate),
    );
  }, [albums, query, year, place, sort]);

  // Lưu bộ lọc lên URL để copy link là người khác thấy đúng kết quả
  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    year.forEach((y) => params.append("year", y));
    place.forEach((p) => params.append("place", p));
    if (sort !== "newest") params.set("sort", sort);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [query, year, place, sort]);

  // Phím "/" để nhảy vào ô tìm kiếm
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key !== "/" || el.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isFiltering = query.trim() !== "" || year.length > 0 || place.length > 0 || sort !== "newest";

  function resetFilters() {
    setQuery("");
    setYear([]);
    setPlace([]);
    setSort("newest");
  }

  return (
    <>
      <section className="mb-8 flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex h-11 flex-1 items-center gap-2.5 rounded-lg border border-line bg-surface px-3.5 focus-within:border-accent">
            <IconSearch className="shrink-0 text-ink-soft" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.albums.searchPlaceholder}
              aria-label={t.albums.searchLabel}
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent font-medium outline-none placeholder:text-ink-soft/70 [&::-webkit-search-cancel-button]:hidden"
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} className="rounded-full p-1 hover:bg-surface-2" aria-label={t.albums.clearSearch}>
                <IconClose size={16} />
              </button>
            ) : (
              <kbd className="hidden rounded-md border border-line px-1.5 font-mono text-xs text-ink-soft sm:inline">/</kbd>
            )}
          </label>
          {/* Cách xếp: 3 lựa chọn ngắn nên dùng nút chọn một thay vì dropdown */}
          <div
            role="group"
            aria-label={t.albums.sort}
            className="flex h-11 shrink-0 items-center gap-1 rounded-lg border border-line bg-surface p-1"
          >
            {(Object.keys(SORTS) as SortKey[]).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={sort === k}
                onClick={() => setSort(k)}
                className="h-full flex-1 whitespace-nowrap rounded-md px-3 text-sm font-semibold text-ink-soft transition-colors hover:text-ink aria-pressed:bg-ink aria-pressed:text-bg sm:flex-none"
              >
                {t.albums.sorts[k]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface/50 p-3.5 sm:p-4">
          <ChipRow label={t.albums.year} value={year} onChange={setYear} options={years} />
          <ChipRow label={t.albums.place} value={place} onChange={setPlace} options={places} />
          <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
            <span className="text-sm text-ink-soft tabular-nums">{t.albums.shown(filtered.length, albums.length)}</span>
            {isFiltering && (
              <button type="button" onClick={resetFilters} className="chip border-accent text-accent">
                <IconReset size={13} />
                {t.albums.clearAll}
              </button>
            )}
          </div>
        </div>
      </section>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((album, i) => (
            <div key={album.id}>
              <AlbumCard album={album} index={albums.indexOf(album)} preload={i < 3} />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<IconSearch size={26} />}
          title={t.albums.noMatch}
          action={
            <button type="button" onClick={resetFilters} className="btn btn-primary">
              <IconReset size={16} />
              {t.albums.clearFilters}
            </button>
          }
        >
          {query.trim() ? t.albums.nothingFor(query.trim()) : t.albums.noCombo}
        </EmptyState>
      )}
    </>
  );
}

/** Hàng chip chọn nhiều. "All" = bỏ chọn hết; nút ↺ bên cạnh reset riêng hàng này. */
function ChipRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string[];
  options: string[];
  onChange: (v: string[]) => void;
}) {
  const { t } = useI18n();
  const toggle = (opt: string) =>
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);

  return (
    <div className="grid min-w-0 grid-cols-[auto_1fr_auto] items-start gap-x-3 gap-y-1.5 sm:grid-cols-[4rem_1fr_auto]">
      <span className="eyebrow col-span-2 pt-1.5 sm:col-span-1">{label}</span>
      {/* Mobile: cuộn ngang thay vì xuống nhiều dòng */}
      <div
        role="group"
        aria-label={t.albums.filterBy(label)}
        className="scrollbar-none order-last col-span-3 -my-1 flex min-w-0 gap-1.5 overflow-x-auto py-1 sm:order-none sm:col-span-1 sm:flex-wrap sm:overflow-visible"
      >
        <button type="button" className="chip" aria-pressed={value.length === 0} onClick={() => onChange([])}>
          {t.albums.all}
        </button>
        {options.map((opt) => (
          <button key={opt} type="button" className="chip" aria-pressed={value.includes(opt)} onClick={() => toggle(opt)}>
            {opt}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([])}
        disabled={value.length === 0}
        title={t.albums.resetFilter(label)}
        aria-label={t.albums.resetFilter(label)}
        className="flex h-8 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-semibold text-ink-soft transition-colors hover:text-ink disabled:invisible"
      >
        <IconReset size={13} />
        {value.length > 0 && <span className="tabular-nums">{value.length}</span>}
      </button>
    </div>
  );
}
