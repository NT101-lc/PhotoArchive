"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { searchPlaces } from "@/lib/api-client";
import { addPlace, MAX_PLACE_LENGTH, MAX_PLACES, sameName, tripPlace, withDraft, type Place, type TripPlace } from "@/lib/places-format";
import { IconClose, IconPin } from "./Icons";

type Props = {
  /** Các nơi đã chọn, theo thứ tự đi */
  places: TripPlace[];
  /** Chữ đang gõ dở trong ô (form giữ để bấm lưu ngay cũng tính — xem `withDraft`) */
  draft: string;
  onChange: (places: TripPlace[], draft: string) => void;
  /** Gợi ý sẵn (vd nơi chụp đọc từ GPS của ảnh), hiện thành nút bấm bên dưới ô */
  suggestions?: Place[];
  suggestionsLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
};

const DEBOUNCE_MS = 300;
/** Danh sách gợi ý: rộng tối thiểu (px, từ sm trở lên) và cao tối đa */
const LIST_MIN_WIDTH = 352;
const LIST_MAX_HEIGHT = 288;

/**
 * Ô chọn các nơi của chuyến: mỗi nơi là một thẻ (× để bỏ), gõ thì hiện gợi ý (Photon / OpenStreetMap qua
 * /api/places). Không thấy nơi cần tìm thì cứ gõ rồi Enter (hoặc bấm ra ngoài). Combobox theo ARIA:
 * ↑ ↓ để chọn gợi ý, Enter để lấy, Esc để đóng, Backspace khi ô trống để bỏ thẻ cuối.
 */
export function PlacesInput({
  places,
  draft,
  onChange,
  suggestions = [],
  suggestionsLabel = "Suggested",
  placeholder = "Add a place",
  disabled,
  className = "",
  "aria-label": ariaLabel,
}: Props) {
  const listId = useId();
  // Chữ người dùng vừa gõ để tìm (null = chưa gõ gì → không tìm)
  const [query, setQuery] = useState<string | null>(null);
  // Kết quả của lần tìm gần nhất, kèm chữ đã tìm để biết nó còn khớp với chữ đang gõ không
  const [found, setFound] = useState<{ q: string; places: Place[]; error: boolean }>({ q: "", places: [], error: false });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const full = places.length >= MAX_PLACES;
  const q = query?.trim() ?? "";
  const searching = q.length >= 2 && !full;
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

  function reset() {
    setQuery(null);
    setOpen(false);
  }

  function pick(p: Place) {
    onChange(addPlace(places, tripPlace(p)), "");
    reset();
    inputRef.current?.focus();
  }

  /** Chữ đang gõ thành một nơi gõ tay (không toạ độ) */
  function commitDraft() {
    if (!draft.trim()) return;
    onChange(withDraft(places, draft), "");
    reset();
  }

  function remove(i: number) {
    onChange(
      places.filter((_, j) => j !== i),
      draft,
    );
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const listOpen = open && results.length > 0;
    if (e.key === "ArrowDown" && results.length > 0) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp" && listOpen) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter" && (listOpen && active >= 0 ? true : !!draft.trim())) {
      // Enter khi có gợi ý đang chọn → lấy gợi ý; không thì lấy chữ đã gõ. Không gửi form.
      e.preventDefault();
      if (listOpen && active >= 0) pick(results[active]);
      else commitDraft();
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "Backspace" && !draft && places.length > 0) {
      remove(places.length - 1);
    }
  }

  const showList = open && status !== "idle";
  const chips = suggestions.filter((s) => !places.some((p) => sameName(p.name, s.name)));

  // Danh sách đặt `fixed` theo vị trí thật của ô: không bị khung cuộn của Modal cắt mất.
  // Từ sm trở lên rộng hơn ô (ô hay nằm ở cột hẹp bên phải), neo mép phải; dưới không đủ chỗ thì lật lên trên.
  // Sửa thẳng style (không qua state) vì phải chạy lại theo mỗi lần cuộn.
  useLayoutEffect(() => {
    if (!showList) return;
    const place = () => {
      const list = listRef.current;
      const box = boxRef.current;
      if (!list || !box) return;
      const r = box.getBoundingClientRect();
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
  }, [showList, results.length, places.length]);

  return (
    <div ref={wrapRef} className={`flex flex-col gap-1.5 ${className}`}>
      {/* Trông như .field nhưng cao theo số thẻ; bấm vào chỗ trống thì focus ô gõ */}
      <div
        ref={boxRef}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) {
            e.preventDefault();
            inputRef.current?.focus();
          }
        }}
        className={`relative flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border border-line py-1.5 pr-2 pl-9 font-medium focus-within:border-accent focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_22%,transparent)] ${disabled ? "bg-surface-2 text-ink-soft" : "bg-surface text-ink"}`}
      >
        <IconPin
          size={18}
          aria-hidden="true"
          className={`pointer-events-none absolute top-[11px] left-3 ${places.some((p) => p.lat !== null) ? "text-accent" : "text-ink-soft"}`}
        />
        <ul aria-label="Chosen places" className="contents">
          {places.map((p, i) => (
            <li
              key={`${p.name}|${i}`}
              className="inline-flex h-7 max-w-full items-center gap-1 rounded-full border border-line bg-surface-2 pr-1 pl-2.5 text-sm"
              title={p.lat === null ? "Typed by hand" : undefined}
            >
              <span className="min-w-0 truncate">{p.name}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label={`Remove ${p.name}`}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-line hover:text-ink"
                >
                  <IconClose size={13} />
                </button>
              )}
            </li>
          ))}
        </ul>
        {!disabled && (
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
            aria-label={ariaLabel}
            value={draft}
            onChange={(e) => {
              onChange(places, e.target.value);
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => results.length > 0 && setOpen(true)}
            onBlur={commitDraft}
            onKeyDown={onKeyDown}
            placeholder={full ? `Up to ${MAX_PLACES} places` : places.length ? "Add another" : placeholder}
            disabled={full}
            maxLength={MAX_PLACE_LENGTH}
            autoComplete="off"
            spellCheck={false}
            className="h-7 min-w-[9ch] flex-1 bg-transparent outline-none placeholder:text-ink-soft disabled:cursor-not-allowed"
          />
        )}
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
            <li className="px-3 py-2 text-sm text-ink-soft">Place search isn’t available right now. Type the name and press Enter.</li>
          )}
          {status === "done" && results.length === 0 && (
            <li className="px-3 py-2 text-sm text-ink-soft">No match. Press Enter to keep what you typed.</li>
          )}
          {results.map((p, i) => (
            <li
              key={`${p.name}|${p.detail}|${p.lat}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // pointerdown thay vì click: chọn trước khi ô nhập mất focus (không thì blur đã biến chữ gõ thành thẻ)
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

      {chips.length > 0 && !disabled && !full && (
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
