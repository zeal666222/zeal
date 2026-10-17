"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// LocationAutocomplete — industry-grade glass combobox for birth places
// ─────────────────────────────────────────────────────────────────────────────
// • Debounced (300ms) server-backed suggestions via /api/geo/suggest
// • Full WAI-ARIA combobox pattern (↑/↓/Enter/Esc, aria-activedescendant)
// • Recent places from localStorage — one-tap refill, no typing
// • Selected state shows locked coordinates + IANA timezone (trust signal)
// • All motion respects prefers-reduced-motion; no SSR/client divergence
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { Check, Loader2, MapPin, Sparkles, X } from "lucide-react";
import { cn } from "./utils";

export interface PlaceSuggestionData {
  label: string;
  lat: number;
  lng: number;
  timezone: string;
  country: string;
  source?: "gazetteer" | "nominatim";
}

interface LocationAutocompleteProps {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  onSelect: (place: PlaceSuggestionData) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  /** Override the fetcher (tests / other backends). Defaults to /api/geo/suggest. */
  fetchSuggestions?: (q: string, signal: AbortSignal) => Promise<PlaceSuggestionData[]>;
  /** localStorage key for per-form recent places. */
  recentStorageKey?: string;
}

const RECENTS_LIMIT = 6;

function defaultFetcher(q: string, signal: AbortSignal): Promise<PlaceSuggestionData[]> {
  return fetch(`/api/geo/suggest?q=${encodeURIComponent(q)}`, { signal })
    .then((r) => (r.ok ? r.json() : { suggestions: [] }))
    .then((d: { suggestions?: PlaceSuggestionData[] }) => d.suggestions ?? [])
    .catch(() => []);
}

function readRecents(key: string): PlaceSuggestionData[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PlaceSuggestionData[]) : [];
  } catch {
    return [];
  }
}

function writeRecents(key: string, place: PlaceSuggestionData): void {
  try {
    const next = [place, ...readRecents(key).filter((p) => p.label !== place.label)].slice(0, RECENTS_LIMIT);
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* storage unavailable — recents are a nicety, never critical */
  }
}

const POP = { type: "spring", stiffness: 420, damping: 28, mass: 0.7 } as const;

export function LocationAutocomplete({
  id,
  value,
  onChange,
  onSelect,
  placeholder = "Enter a city… (e.g. Pune, Maharashtra)",
  required,
  className,
  fetchSuggestions = defaultFetcher,
  recentStorageKey = "zeal:recent-places",
}: LocationAutocompleteProps) {
  const reduced = useReducedMotion() === true;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PlaceSuggestionData[]>([]);
  const [recents, setRecents] = useState<PlaceSuggestionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [picked, setPicked] = useState<PlaceSuggestionData | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reqSeq = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setRecents(readRecents(recentStorageKey));
  }, [recentStorageKey]);

  useEffect(() => {
    const onDocDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDocDown);
    return () => document.removeEventListener("pointerdown", onDocDown);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const runSearch = useCallback(
    (q: string) => {
      const query = q.trim();
      if (query.length < 2) {
        setItems([]);
        setLoading(false);
        return;
      }
      const seq = ++reqSeq.current;
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      void fetchSuggestions(query, ctrl.signal)
        .then((res) => {
          if (seq !== reqSeq.current) return; // a newer request already landed
          setItems(res);
          setActiveIdx(res.length ? 0 : -1);
        })
        .finally(() => {
          if (seq === reqSeq.current) setLoading(false);
        });
    },
    [fetchSuggestions],
  );

  const handleInput = useCallback(
    (v: string) => {
      onChange(v);
      setPicked(null);
      setOpen(true);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => runSearch(v), 300);
    },
    [onChange, runSearch],
  );

  const choose = useCallback(
    (place: PlaceSuggestionData) => {
      setPicked(place);
      setOpen(false);
      onChange(place.label);
      writeRecents(recentStorageKey, place);
      setRecents(readRecents(recentStorageKey));
      onSelect(place);
    },
    [onChange, onSelect, recentStorageKey],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        setOpen(true);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => (items.length ? (i + 1) % items.length : -1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => (items.length ? (i - 1 + items.length) % items.length : -1));
      } else if (e.key === "Enter" && open && activeIdx >= 0 && items[activeIdx]) {
        e.preventDefault();
        choose(items[activeIdx]);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    },
    [activeIdx, choose, items, open],
  );

  const listId = useMemo(() => `${id ?? "loc"}-place-list`, [id]);
  const showRecents = items.length === 0 && recents.length > 0;
  const rows = items.length ? items : showRecents ? recents : [];

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 z-10 w-4 h-4 text-[var(--color-primary)]" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open && rows.length > 0}
          aria-controls={listId}
          aria-activedescendant={activeIdx >= 0 ? `${listId}-opt-${activeIdx}` : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          required={required}
          value={value}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => value.trim().length >= 2 && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="w-full pl-11 pr-16 py-3.5 bg-background/80 border border-border/60 rounded-2xl focus:border-[var(--color-primary)]/50 outline-none text-foreground text-sm transition-colors placeholder:text-muted-foreground/60"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {loading && <Loader2 size={15} className="animate-spin text-muted-foreground" />}
          {!loading && value && (
            <button
              type="button"
              aria-label="Clear location"
              onClick={() => {
                onChange("");
                setPicked(null);
                setItems([]);
                inputRef.current?.focus();
              }}
              className="grid place-items-center w-6 h-6 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {picked && (
        <m.p
          initial={reduced ? false : { opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1.5 flex items-center gap-1.5 text-[10px] font-medium text-emerald-400"
        >
          <Check size={11} />
          Coordinates locked — {picked.lat.toFixed(3)}, {picked.lng.toFixed(3)} · {picked.timezone}
        </m.p>
      )}

      <AnimatePresence>
        {open && rows.length > 0 && (
          <m.ul
            id={listId}
            role="listbox"
            aria-label={showRecents ? "Recent cities" : "Place suggestions"}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="absolute z-30 mt-2 w-full max-h-72 overflow-y-auto rounded-2xl border border-[var(--color-luxury-glass-border)] bg-[var(--color-surface)]/95 backdrop-blur-2xl shadow-[0_16px_48px_-12px_rgba(0,0,0,0.55)] p-1.5"
          >
            {showRecents && (
              <li className="px-3 pt-1.5 pb-1 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                <Sparkles size={10} className="text-[var(--color-luxury-gold)]" />
                {navigator.onLine === false ? "Offline — remembered cities" : "Remembered cities"}
              </li>
            )}
            {rows.map((p, i) => (
              <li
                key={`${p.label}-${p.lat}`}
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected={i === activeIdx}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => choose(p)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer select-none transition-colors",
                  i === activeIdx ? "bg-[var(--color-primary)]/12 text-foreground" : "text-muted-foreground hover:bg-muted/40",
                )}
              >
                <MapPin size={13} className={cn("shrink-0", i === activeIdx ? "text-[var(--color-primary)]" : "opacity-60")} />
                <span className="flex-1 min-w-0 text-sm truncate">{p.label}</span>
                <span className="shrink-0 text-[10px] tabular-nums opacity-50">{p.timezone.split("/").pop()}</span>
                {p.label === value && <Check size={13} className="shrink-0 text-emerald-400" />}
              </li>
            ))}
          </m.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
