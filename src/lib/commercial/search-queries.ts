import type { CommercialSegment } from "@/lib/commercial/segments";

/**
 * Requêtes orientées entreprises B2B (marque, grossiste, fabricant),
 * pas magasins retail ni commerciaux freelance.
 */
export function buildCommercialSearchQueries(
  segment: CommercialSegment,
  niche: string,
  city: string
): string[] {
  const c = city.trim();
  const n = niche.trim();
  const queries = new Set<string>();

  switch (segment) {
    case "B2B_BRAND":
      if (n) {
        queries.add(`marque ${n} grossiste ${c}`);
        queries.add(`fabricant ${n} B2B ${c}`);
        queries.add(`marque ${n} vente revendeurs ${c}`);
        queries.add(`distributeur ${n} professionnel ${c}`);
      }
      queries.add(`marque grossiste ${c}`);
      queries.add(`fabricant B2B ${c}`);
      queries.add(`vente aux professionnels ${c}`);
      break;

    case "WHOLESALER":
      if (n) {
        queries.add(`grossiste ${n} ${c}`);
        queries.add(`distributeur ${n} B2B ${c}`);
        queries.add(`importateur ${n} ${c}`);
        queries.add(`fournisseur ${n} professionnel ${c}`);
      }
      queries.add(`grossiste alimentaire ${c}`);
      queries.add(`distributeur B2B ${c}`);
      queries.add(`grossiste professionnel ${c}`);
      break;

    case "MANUFACTURER":
      if (n) {
        queries.add(`fabricant ${n} industriel ${c}`);
        queries.add(`équipementier ${n} ${c}`);
        queries.add(`industrie ${n} ${c}`);
        queries.add(`manufacture ${n} ${c}`);
      }
      queries.add(`fabricant industriel ${c}`);
      queries.add(`équipementier B2B ${c}`);
      queries.add(`usine ${c}`);
      break;
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
