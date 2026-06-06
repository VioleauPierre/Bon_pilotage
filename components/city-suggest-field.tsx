"use client";

import { useEffect, useMemo, useState } from "react";

type CitySuggestion = {
  label: string;
  city: string;
  postalCode: string;
};

type CitySuggestFieldProps = {
  id: string;
  label: string;
  value: string;
  localSuggestions: string[];
  onChange: (value: string) => void;
};

function normalize(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function toLocalSuggestions(values: string[], query: string): CitySuggestion[] {
  const needle = normalize(query);

  return values
    .filter((value) => !needle || normalize(value).startsWith(needle))
    .slice(0, 6)
    .map((value) => ({ label: value, city: value, postalCode: "" }));
}

function mergeSuggestions(
  apiSuggestions: CitySuggestion[],
  localSuggestions: CitySuggestion[],
) {
  const seen = new Set<string>();
  const result: CitySuggestion[] = [];

  for (const suggestion of [...apiSuggestions, ...localSuggestions]) {
    const key = normalize(suggestion.label);

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(suggestion);
  }

  return result.slice(0, 8);
}

export function CitySuggestField({
  id,
  label,
  value,
  localSuggestions,
  onChange,
}: CitySuggestFieldProps) {
  const [apiSuggestions, setApiSuggestions] = useState<CitySuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const localMatches = useMemo(
    () => toLocalSuggestions(localSuggestions, value),
    [localSuggestions, value],
  );
  const suggestions = mergeSuggestions(apiSuggestions, localMatches);

  useEffect(() => {
    const query = value.trim();

    if (query.length < 2) {
      setApiSuggestions([]);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/cities?q=${encodeURIComponent(query)}`, {
          method: "GET",
          signal: controller.signal,
        });
        const result = (await response.json()) as {
          ok?: boolean;
          suggestions?: CitySuggestion[];
        };

        if (response.ok && result.ok && result.suggestions) {
          setApiSuggestions(result.suggestions);
        }
      } catch {
        if (!controller.signal.aborted) {
          setApiSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 220);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [value]);

  return (
    <div className="field city-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={value}
        placeholder="Ville ou code postal"
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
      />
      {suggestions.length > 0 || isLoading ? (
        <div className="city-suggestion-panel">
          {isLoading ? <span className="city-suggestion-info">Recherche...</span> : null}
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.label}
              className="city-suggestion-item"
              type="button"
              onClick={() => onChange(suggestion.label)}
            >
              <span>{suggestion.city}</span>
              {suggestion.postalCode ? <strong>{suggestion.postalCode}</strong> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
