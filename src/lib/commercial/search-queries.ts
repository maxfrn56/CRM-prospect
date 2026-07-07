import type { CommercialSegment } from "@/lib/commercial/segments";
import { detectGeoZone, resolveSearchCities } from "@/lib/commercial/geo-zones";

/**
 * Requêtes strictement liées à la niche + zone géographique concrète.
 * Les régions (ex. Nouvelle-Aquitaine) sont déclinées en villes hubs.
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
    return [`${segment} B2B ${city.trim()}`];
  }

  for (const loc of locations) {
    switch (segment) {
      case "B2B_BRAND":
        queries.add(`marque ${n} ${loc}`);
        queries.add(`marque ${n} grossiste ${loc}`);
        queries.add(`fabricant ${n} ${loc}`);
        queries.add(`distributeur ${n} professionnel ${loc}`);
        queries.add(`${n} vente revendeurs ${loc}`);
        queries.add(`équipement ${n} B2B ${loc}`);
        break;

      case "WHOLESALER":
        queries.add(`grossiste ${n} ${loc}`);
        queries.add(`distributeur ${n} ${loc}`);
        queries.add(`importateur ${n} ${loc}`);
        queries.add(`fournisseur ${n} professionnel ${loc}`);
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
    return `${zone.label} (${zone.searchCities.slice(0, 4).join(", ")}…)`;
  }
  return city.trim();
}
