import type { CommercialSegment } from "@/lib/commercial/segments";
import { detectGeoZone, resolveSearchCities } from "@/lib/commercial/geo-zones";

/**
 * Requêtes pour trouver des MARQUES / acteurs du secteur (B2C + B2B).
 * Régions déclinées en plusieurs villes pour couvrir toute la zone.
 */
export function buildCommercialSearchQueries(
  segment: CommercialSegment,
  niche: string,
  city: string
): string[] {
  const n = niche.trim();
  const locations = resolveSearchCities(city);
  const queries = new Set<string>();

  if (!n) {
    return [`marque ${city.trim()}`];
  }

  for (const loc of locations) {
    switch (segment) {
      case "B2B_BRAND":
        queries.add(`marque de ${n} ${loc}`);
        queries.add(`marque ${n} ${loc}`);
        queries.add(`${n} ${loc}`);
        queries.add(`fabricant ${n} ${loc}`);
        queries.add(`équipement ${n} ${loc}`);
        queries.add(`industrie ${n} ${loc}`);
        queries.add(`shaper ${n} ${loc}`);
        queries.add(`surf shop ${loc}`);
        if (n.toLowerCase().includes("surf")) {
          queries.add(`shaper planches ${loc}`);
          queries.add(`planche de surf ${loc}`);
          queries.add(`atelier planche ${loc}`);
          queries.add(`équipement glisse ${loc}`);
          queries.add(`marque planche ${loc}`);
          queries.add(`fabricant planches ${loc}`);
        }
        break;

      case "WHOLESALER":
        queries.add(`grossiste ${n} ${loc}`);
        queries.add(`distributeur ${n} ${loc}`);
        queries.add(`importateur ${n} ${loc}`);
        break;

      case "MANUFACTURER":
        queries.add(`fabricant ${n} ${loc}`);
        queries.add(`fabricant ${n} industriel ${loc}`);
        queries.add(`équipementier ${n} ${loc}`);
        queries.add(`usine ${n} ${loc}`);
        break;
    }
  }

  return [...queries];
}

export function buildCommercialSearchQuery(
  segment: CommercialSegment,
  niche: string,
  city: string
): string {
  return buildCommercialSearchQueries(segment, niche, city)[0] ?? `${niche} ${city}`;
}

export function describeSearchZone(city: string): string {
  const zone = detectGeoZone(city);
  if (zone) {
    return `${zone.label} — ${zone.searchCities.length} villes (${zone.searchCities.slice(0, 5).join(", ")}…)`;
  }
  return city.trim();
}
