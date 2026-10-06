"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeText, plural, yearOf } from "@/lib/format";
import type { Album } from "@/lib/types";
import { AlbumCard } from "./AlbumCard";
import { EmptyState } from "./EmptyState";
import { IconClose, IconReset, IconSearch } from "./Icons";

const ALL = "all";

export const SORTS = {
  newest: "Newest",
  oldest: "Oldest",
  most: "Most photos",
} as const;
export type SortKey = keyof typeof SORTS;

export type AlbumFilters = { q: string; year: string; place: string; sort: SortKey };

type Props = { albums: Album[]; initial: AlbumFilters };

export function AlbumBrowser({ albums, initial }: Props) {
  const [query, setQuery] = useState(initial.q);
  const [year, setYear] = useState(initial.year);
  const [place, setPlace] = useState(initial.place);
  const [sort, setSort] = useState<SortKey>(initial.sort);
  const searchRef = useRef<HTMLInputElement>(null);

  const years = useMemo(
    () => [...new Set(albums.map((a) => yearOf(a.tripDate)))].sort((a, b) => b.localeCompare(a)),
    [albums],
  );
  const places = useMemo(
    () => [...new Set(albums.map((a) => a.location))].sort((a, b) => a.localeCompare(b, "vi")),
    [albums],
  );

  const filtered = useMemo(() => {
    const q = normalizeText(query);
    const list = albums.filter(
      (a) =>
        (year === ALL || yearOf(a.tripDate) === year) &&
        (place === ALL || a.location === place) &&
        (!q || normalizeText(`${a.title} ${a.location}`).includes(q)),
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
    if (year !== ALL) params.set("year", year);
    if (place !== ALL) params.set("place", place);
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

  const isFiltering = query.trim() !== "" || year !== ALL || place !== ALL;

  function resetFilters() {
    setQuery("");
    setYear(ALL);
    setPlace(ALL);
  }

  return (
    <>
      <section className="mb-8 flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex h-12 flex-1 items-center gap-2.5 rounded-full border-2 border-line bg-surface px-4 shadow-hard-sm focus-within:border-accent">
            <IconSearch className="shrink-0 text-ink-soft" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search trips, places…"
              aria-label="Search albums"
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent font-medium outline-none placeholder:text-ink-soft/70 [&::-webkit-search-cancel-button]:hidden"
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} className="rounded-full p-1 hover:bg-surface-2" aria-label="Clear search">
                <IconClose size={16} />
              </button>
            ) : (
              <kbd className="hidden rounded-md border border-line px-1.5 font-mono text-xs text-ink-soft sm:inline">/</kbd>
            )}
          </label>
          <label className="flex items-center gap-2">
            <span className="eyebrow shrink-0">Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="field h-12 rounded-full pr-9 sm:w-[170px]"
            >
              {Object.entries(SORTS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:gap-6">
          <ChipRow label="Year" value={year} onChange={setYear} options={years} />
          <ChipRow label="Place" value={place} onChange={setPlace} options={places} />
          <div className="flex items-center gap-3 lg:ml-auto">
            <span className="font-mono text-xs text-ink-soft">
              {filtered.length}/{plural(albums.length, "album")}
            </span>
            {isFiltering && (
              <button type="button" onClick={resetFilters} className="chip border-accent text-accent">
                <IconReset size={13} />
                Clear
              </button>
            )}
          </div>
        </div>
      </section>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((album, i) => (
            <div key={album.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 30}ms`, animationFillMode: "both" }}>
              <AlbumCard album={album} index={albums.indexOf(album)} preload={i < 3} />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<IconSearch size={26} />}
          title="No trips match"
          action={
            <button type="button" onClick={resetFilters} className="btn btn-primary">
              <IconReset size={16} />
              Clear filters
            </button>
          }
        >
          {query.trim()
            ? `Nothing found for “${query.trim()}”. Try a shorter keyword (accents optional) or clear the year / place filters.`
            : "No albums match this year and place combination. Try another one."}
        </EmptyState>
      )}
    </>
  );
}

function ChipRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="eyebrow w-11 shrink-0">{label}</span>
      {/* Mobile: cuộn ngang thay vì xuống nhiều dòng */}
      <div className="scrollbar-none -my-1 flex min-w-0 gap-1.5 overflow-x-auto py-1 pr-1 lg:flex-wrap lg:overflow-visible">
        {[ALL, ...options].map((opt) => (
          <button key={opt} type="button" className="chip" aria-pressed={value === opt} onClick={() => onChange(opt)}>
            {opt === ALL ? "All" : opt}
          </button>
        ))}
      </div>
    </div>
  );
}
