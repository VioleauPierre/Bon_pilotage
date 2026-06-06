import { NextResponse } from "next/server";

export const runtime = "nodejs";

type GeoApiCommune = {
  nom?: string;
  codesPostaux?: string[];
};

type CitySuggestion = {
  label: string;
  city: string;
  postalCode: string;
};

function normalizeQuery(value: string) {
  return value.trim().slice(0, 80);
}

function buildGeoApiUrl(query: string) {
  const params = new URLSearchParams({
    fields: "nom,codesPostaux",
    format: "json",
    limit: "10",
  });

  if (/^\d{2,5}$/.test(query)) {
    params.set("codePostal", query);
  } else {
    params.set("nom", query);
    params.set("boost", "population");
  }

  return `https://geo.api.gouv.fr/communes?${params.toString()}`;
}

function toSuggestions(communes: GeoApiCommune[]) {
  const suggestions: CitySuggestion[] = [];
  const seen = new Set<string>();

  for (const commune of communes) {
    const city = commune.nom?.trim();

    if (!city) {
      continue;
    }

    const postalCodes = commune.codesPostaux?.length ? commune.codesPostaux : [""];

    for (const postalCode of postalCodes) {
      const label = postalCode ? `${city} (${postalCode})` : city;
      const key = label.toLocaleLowerCase("fr-FR");

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      suggestions.push({ label, city, postalCode });
    }
  }

  return suggestions.slice(0, 10);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = normalizeQuery(searchParams.get("q") || "");

  if (query.length < 2) {
    return NextResponse.json({ ok: true, suggestions: [] });
  }

  try {
    const response = await fetch(buildGeoApiUrl(query), {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 * 60 * 24 },
    });

    if (!response.ok) {
      throw new Error(`Geo API error: ${response.status}`);
    }

    const communes = (await response.json()) as GeoApiCommune[];

    return NextResponse.json({
      ok: true,
      suggestions: toSuggestions(communes),
    });
  } catch (error) {
    console.error("Unable to load city suggestions", error);

    return NextResponse.json({
      ok: true,
      suggestions: [],
      warning: "Suggestions de villes indisponibles temporairement.",
    });
  }
}
