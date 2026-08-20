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
    if (!touched || query.length < 3) {
      setSuggestions([]);
      setLoading(false);
      setError("");
      return;
    }

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
      <span className="text-[9px] font-bold uppercase tracking-[.1em] text-[#8b949c]">{label}</span>
      <div className="mt-1 flex h-10 items-center gap-2 rounded-lg border border-[#dfe3e8] bg-[#fafbfb] px-3 focus-within:border-[#aa8748] focus-within:bg-white">
        <span className="text-[#9b7a40]">{icon ?? <MapPin size={13}/>}</span>
        <input
          value={value}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 120)}
          onChange={(event) => {
            setTouched(true);
            onChange(event.target.value);
          }}
          className="w-full bg-transparent text-xs outline-none"
          placeholder={placeholder}
          autoComplete="off"
          required={required}
        />
      </div>

      {showMenu ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-lg border border-[#dfe3e8] bg-white shadow-xl">
          {loading ? <div className="px-3 py-3 text-[10px] font-semibold text-[#7e8992]">Finding locations…</div> : null}
          {!loading && error ? <div className="px-3 py-3 text-[10px] leading-4 text-amber-800">{error} You can still enter the location manually.</div> : null}
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
              className="block w-full border-b border-[#edf0f2] px-3 py-2.5 text-left last:border-b-0 hover:bg-[#f7f8f9]"
            >
              <span className="block truncate text-xs font-bold text-[#263a50]">{suggestion.main_text}</span>
              {suggestion.secondary_text ? <span className="mt-0.5 block truncate text-[10px] text-[#7d8790]">{suggestion.secondary_text}</span> : null}
            </button>
          )) : null}
          <div className="border-t border-[#edf0f2] bg-[#fafbfb] px-3 py-1.5 text-right text-[9px] font-semibold text-[#8d969e]">
            Results by <span translate="no" className="font-bold text-[#58636d]">Google Maps</span>
          </div>
        </div>
      ) : null}
    </label>
  );
}
