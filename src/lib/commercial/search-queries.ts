import type { CommercialSegment } from "@/lib/commercial/segments";
import { isCommercialVerticalNiche } from "@/lib/commercial/prospect-filter";

/**
 * Requêtes Google Places orientées « métier commercial », pas « secteur d'activité ».
 * La niche sert au pitch et au filtrage ; elle n'est ajoutée à la recherche
 * que si c'est un vertical commercial classique (immo, assurance…).
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
    case "INDEPENDENT":
      queries.add(`mandataire commercial ${c}`);
      queries.add(`agent commercial indépendant ${c}`);
      queries.add(`conseiller commercial ${c}`);
      queries.add(`représentant commercial ${c}`);
      queries.add(`négociateur commercial ${c}`);
      if (n) {
        if (isCommercialVerticalNiche(n)) {
          queries.add(`mandataire ${n} ${c}`);
          queries.add(`agent commercial ${n} ${c}`);
          queries.add(`conseiller ${n} ${c}`);
        } else {
          // Niche « métier » (sport, IT…) : chercher des commerciaux qui vendent dans ce secteur
          queries.add(`représentant commercial ${n} ${c}`);
          queries.add(`commercial vente ${n} ${c}`);
          queries.add(`agent commercial vente ${n} ${c}`);
        }
      }
      break;

    case "SDR_STARTUP":
      queries.add(`startup B2B ${c}`);
      queries.add(`scale-up ${c}`);
      if (n) queries.add(`startup ${n} ${c}`);
      queries.add(`agence growth ${c}`);
      queries.add(`sales development ${c}`);
      break;

    case "SALES_CABINET":
      queries.add(`cabinet commercial externalisé ${c}`);
      queries.add(`force de vente externalisée ${c}`);
      queries.add(`agence commerciale B2B ${c}`);
      if (n) queries.add(`cabinet commercial ${n} ${c}`);
      break;
  }

  return [...queries];
}

/** @deprecated Utiliser buildCommercialSearchQueries — conservé pour l'aperçu UI */
export function buildCommercialSearchQuery(
  segment: CommercialSegment,
  niche: string,
  city: string
): string {
  return buildCommercialSearchQueries(segment, niche, city)[0] ?? `${niche} ${city}`;
}
