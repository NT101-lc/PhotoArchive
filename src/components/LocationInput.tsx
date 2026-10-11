"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { searchPlaces } from "@/lib/api-client";
import type { Coords, Place } from "@/lib/places-format";
import { MAX_PLACE_LENGTH } from "@/lib/places-format";
import { IconPin } from "./Icons";

type Props = {
  value: string;
  /** Toạ độ của nơi đã chọn từ gợi ý; null = đang là chữ gõ tay */
  coords: Coords | null;
  onChange: (value: string, coords: Coords | null) => void;
  /** Gợi ý sẵn (vd nơi chụp đọc từ GPS của ảnh), hiện thành nút bấm bên dưới ô */
  suggestions?: Place[];
  suggestionsLabel?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
};

const DEBOUNCE_MS = 300;
/** Danh sách gợi ý: rộng tối thiểu (px, từ sm trở lên) và cao tối đa */
const LIST_MIN_WIDTH = 352;
const LIST_MAX_HEIGHT = 288;

/**
 * Ô nhập nơi đến: gõ thì hiện gợi ý (Photon / OpenStreetMap qua /api/places), chọn một dòng là xong;
 * không thấy nơi cần tìm thì cứ gõ tay. Combobox theo ARIA: ↑ ↓ để chọn, Enter để lấy, Esc để đóng.
 */
export function LocationInput({
  value,
  coords,
  onChange,
  suggestions = [],
  suggestionsLabel = "Suggested",
  placeholder,
  required,
  disabled,
  className = "",
  "aria-label": ariaLabel,
}: Props) {
  const listId = useId();
  // Chữ người dùng vừa gõ (null = chưa gõ gì → không tìm, kể cả khi ô đã có sẵn giá trị)
  const [query, setQuery] = useState<string | null>(null);
  // Kết quả của lần tìm gần nhất, kèm chữ đã tìm để biết nó còn khớp với chữ đang gõ không
  const [found, setFound] = useState<{ q: string; places: Place[]; error: boolean }>({ q: "", places: [], error: false });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const q = query?.trim() ?? "";
  const searching = q.length >= 2;
  // Trong lúc chờ kết quả mới vẫn hiện kết quả cũ cho đỡ nháy
  const results = searching ? found.places : [];
  const status = !searching ? "idle" : found.q !== q ? "loading" : found.error ? "error" : "done";

  useEffect(() => {
    if (!searching) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      searchPlaces(q, ctrl.signal)
        .then((r) => {
          setFound({ q, places: r.places, error: false });
          setActive(-1);
        })
        .catch(() => !ctrl.signal.aborted && setFound({ q, places: [], error: true }));
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, searching]);

  // Bấm ra ngoài → đóng danh sách
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  function pick(p: Place) {
    onChange(p.name, { lat: p.lat, lng: p.lng });
    setQuery(null);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) {
      if (e.key === "ArrowDown" && results.length > 0) setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      // Enter khi đang chọn một gợi ý → lấy gợi ý đó, không gửi form
      e.preventDefault();
      pick(results[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  const showList = open && status !== "idle";
  const chips = suggestions.filter((s) => s.name !== value || !coords);

  // Danh sách đặt `fixed` theo vị trí thật của ô nhập: không bị khung cuộn của Modal cắt mất.
  // Từ sm trở lên rộng hơn ô (ô hay nằm ở cột hẹp bên phải), neo mép phải; dưới không đủ chỗ thì lật lên trên.
  // Sửa thẳng style (không qua state) vì phải chạy lại theo mỗi lần cuộn.
  useLayoutEffect(() => {
    if (!showList) return;
    const place = () => {
      const list = listRef.current;
      const input = inputRef.current;
      if (!list || !input) return;
      const r = input.getBoundingClientRect();
      const wide = window.innerWidth >= 640;
      const width = wide ? Math.min(Math.max(r.width, LIST_MIN_WIDTH), window.innerWidth - 16) : r.width;
      const below = window.innerHeight - r.bottom - 8;
      const above = r.top - 8;
      const up = below < 200 && above > below;
      Object.assign(list.style, {
        left: `${wide ? Math.max(8, r.right - width) : r.left}px`,
        width: `${width}px`,
        maxHeight: `${Math.min(LIST_MAX_HEIGHT, (up ? above : below) - 4)}px`,
        top: up ? "" : `${r.bottom + 4}px`,
        bottom: up ? `${window.innerHeight - r.top + 4}px` : "",
      });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [showList, results.length]);

  return (
    <div ref={wrapRef} className={`relative flex flex-col gap-1.5 ${className}`}>
      <div className="relative">
        <IconPin
          size={18}
          aria-hidden="true"
          className={`pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 ${coords ? "text-accent" : "text-ink-soft"}`}
        />
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          aria-label={ariaLabel}
          value={value}
          onChange={(e) => {
            onChange(e.target.value, null);
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          maxLength={MAX_PLACE_LENGTH}
          autoComplete="off"
          spellCheck={false}
          className="field pl-9 disabled:bg-surface-2 disabled:text-ink-soft"
        />
      </div>

      {showList && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Places"
          // Vị trí, kích thước: xem useLayoutEffect ở trên. z trên Modal (z-[1200])
          className="fixed z-[1300] overflow-y-auto rounded-lg border border-line bg-surface py-1 shadow-[var(--shadow-hard)]"
        >
          {status === "loading" && results.length === 0 && <li className="px-3 py-2 text-sm text-ink-soft">Searching…</li>}
          {status === "error" && (
            <li className="px-3 py-2 text-sm text-ink-soft">Place search isn’t available right now. Just type the name.</li>
          )}
          {status === "done" && results.length === 0 && (
            <li className="px-3 py-2 text-sm text-ink-soft">No match. Keep what you typed, that works too.</li>
          )}
          {results.map((p, i) => (
            <li
              key={`${p.name}|${p.detail}|${p.lat}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // pointerdown thay vì click: chọn trước khi ô nhập mất focus
              onPointerDown={(e) => {
                e.preventDefault();
                pick(p);
              }}
              onPointerEnter={() => setActive(i)}
              // Màn hình hẹp: dòng phụ xuống dưới tên (tên dài không đè mất dòng phụ)
              className={`flex cursor-pointer flex-col px-3 py-2 text-sm sm:flex-row sm:items-baseline sm:gap-2 ${i === active ? "bg-accent/12" : ""}`}
            >
              <span className="font-semibold text-ink">{p.name}</span>
              {p.detail && <span className="min-w-0 truncate text-xs text-ink-soft sm:text-sm">{p.detail}</span>}
            </li>
          ))}
        </ul>
      )}

      {chips.length > 0 && !disabled && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-ink-soft">{suggestionsLabel}:</span>
          {chips.map((p) => (
            <button key={`${p.name}|${p.lat}`} type="button" className="chip h-7 px-2.5 text-xs" onClick={() => pick(p)} title={p.detail}>
              <IconPin size={13} aria-hidden="true" />
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
