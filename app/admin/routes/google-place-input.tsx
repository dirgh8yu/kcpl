"use client";

import { MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

type Suggestion = {
  place_id: string;
  text: string;
  main_text: string;
  secondary_text: string;
  types: string[];
};

type ApiResponse = {
  ok?: boolean;
  suggestions?: Suggestion[];
  needs_configuration?: boolean;
  error?: string;
};

export function GooglePlaceInput({
  label,
  value,
  onChange,
  placeholder,
  icon,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string, placeId?: string) => void;
  placeholder?: string;
  icon?: ReactNode;
  required?: boolean;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [focused, setFocused] = useState(false);
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const query = value.trim();
    if (!touched || query.length < 3) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/admin/places/autocomplete", {
          method: "POST",
          cache: "no-store",
          signal: controller.signal,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ input: query }),
        });
        const data = await response.json() as ApiResponse;
        if (!response.ok || !data.ok) throw new Error(data.error || "Place suggestions are unavailable.");
        setSuggestions(data.suggestions ?? []);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setSuggestions([]);
        setError(err instanceof Error ? err.message : "Place suggestions are unavailable.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [touched, value]);

  const showMenu = focused && touched && value.trim().length >= 3 && (loading || Boolean(error) || suggestions.length > 0);

  return (
    <label className="relative block">
      <span className="mb-1.5 block text-[10px] font-semibold text-[var(--ops-text-secondary)]">{label}</span>
      <div className="flex h-9 items-center gap-2 rounded-lg border border-[var(--ops-border)] bg-[var(--ops-surface-subtle)] px-2.5 focus-within:border-[#9aa6e5] focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(83,103,217,.08)]">
        <span className="text-[var(--ops-text-muted)]">{icon ?? <MapPin size={13}/>}</span>
        <input
          value={value}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 120)}
          onChange={(event) => {
            const nextValue = event.target.value;
            setTouched(true);
            setSuggestions([]);
            setError("");
            setLoading(false);
            onChange(nextValue);
          }}
          className="w-full bg-transparent text-xs outline-none"
          placeholder={placeholder}
          autoComplete="off"
          required={required}
        />
      </div>

      {showMenu ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-lg border border-[var(--ops-border)] bg-white shadow-[var(--ops-shadow-float)]">
          {loading ? <div className="px-3 py-3 text-[11px] text-[var(--ops-text-secondary)]">Finding locations…</div> : null}
          {!loading && error ? <div className="px-3 py-3 text-[11px] leading-4 text-amber-800">Place suggestions are temporarily unavailable. You can still enter the location manually.</div> : null}
          {!loading && !error ? suggestions.map((suggestion) => (
            <button
              key={suggestion.place_id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(suggestion.text, suggestion.place_id);
                setTouched(false);
                setSuggestions([]);
                setFocused(false);
              }}
              className="block w-full border-b border-[#eef0f2] px-3 py-2.5 text-left last:border-b-0 hover:bg-[#f7f8f9]"
            >
              <span className="block truncate text-xs font-semibold text-[#30363d]">{suggestion.main_text}</span>
              {suggestion.secondary_text ? <span className="mt-0.5 block truncate text-[10px] text-[#858c94]">{suggestion.secondary_text}</span> : null}
            </button>
          )) : null}
          <div className="border-t border-[#eef0f2] bg-[#fafafa] px-3 py-1.5 text-right text-[9px] text-[#91979e]">
            Results by <span translate="no" className="font-semibold text-[#606871]">Google Maps</span>
          </div>
        </div>
      ) : null}
    </label>
  );
}
