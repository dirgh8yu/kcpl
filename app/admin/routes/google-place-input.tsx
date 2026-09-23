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
    <label className="ops-field">
      <span className="ops-field-label">{label}</span>
      <span className="route-place-input">
        {icon ?? <MapPin size={14} strokeWidth={1.75} aria-hidden="true"/>}
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
          placeholder={placeholder}
          autoComplete="off"
          required={required}
        />
      </span>

      {showMenu ? (
        <span className="market-suggest">
          {loading ? <span className="market-suggest-status">Finding locations…</span> : null}
          {!loading && error ? <span className="market-suggest-status">Place suggestions are temporarily unavailable. You can still enter the location manually.</span> : null}
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
              className="market-suggest-option"
            >
              <strong>{suggestion.main_text}</strong>
              {suggestion.secondary_text ? <span>{suggestion.secondary_text}</span> : null}
            </button>
          )) : null}
          <span className="market-suggest-foot">Results by <span translate="no">Google Maps</span></span>
        </span>
      ) : null}
    </label>
  );
}
