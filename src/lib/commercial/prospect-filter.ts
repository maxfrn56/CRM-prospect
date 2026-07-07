import type { BusinessResult } from "@/lib/google-places/client";
import type { CommercialSegment } from "@/lib/commercial/segments";

/** Types Google = commerce de détail / consommateur final (hors cible) */
const EXCLUDED_GOOGLE_TYPES = new Set([
  "gym",
  "sports_club",
  "fitness_center",
  "stadium",
  "swimming_pool",
  "school",
  "university",
  "coworking_space",
  "restaurant",
  "cafe",
  "bar",
  "night_club",
  "lodging",
  "hotel",
  "bakery",
  "meal_takeaway",
  "meal_delivery",
  "beauty_salon",
  "hair_care",
  "spa",
  "supermarket",
  "grocery_store",
  "convenience_store",
  "clothing_store",
  "shoe_store",
  "sporting_goods_store",
  "jewelry_store",
  "furniture_store",
  "home_goods_store",
  "department_store",
  "shopping_mall",
]);

/** Types compatibles B2B / production / distribution */
const B2B_GOOGLE_TYPES = new Set([
  "factory",
  "corporate_office",
  "storage",
  "warehouse",
  "wholesaler",
  "general_contractor",
  "moving_company",
]);

const EXCLUDED_TEXT_PATTERNS: RegExp[] = [
  /\bclub\b/i,
  /\bécole\b/i,
  /\becole\b/i,
  /\buniversité\b/i,
  /\bcoworking\b/i,
  /\bsalle de sport\b/i,
  /\bcoach\b/i,
  /\bassociation\b/i,
  /\bcentre de formation\b/i,
  /\brestaurant\b/i,
  /\bhôtel\b/i,
  /\bhotel\b/i,
];

/** Magasin / boutique retail sans signal B2B */
const RETAIL_ONLY_PATTERNS: RegExp[] = [
  /\bmagasin\b/i,
  /\bboutique\b/i,
  /\bconcept store\b/i,
  /\bshop\b/i,
  /\bstore\b/i,
  /\bau détail\b/i,
  /\bretail\b/i,
  /\bépicier\b/i,
  /\bprimeur\b/i,
];

const B2B_SIGNAL_PATTERNS: RegExp[] = [
  /\bmarque\b/i,
  /\bbrand\b/i,
  /\bfabricant\b/i,
  /\bmanufacturer\b/i,
  /\bfabrication\b/i,
  /\bindustriel\b/i,
  /\bindustrie\b/i,
  /\béquipementier\b/i,
  /\bequipementier\b/i,
  /\bgrossiste\b/i,
  /\bwholesale\b/i,
  /\bdistributeur\b/i,
  /\bdistribution\b/i,
  /\bimportateur\b/i,
  /\bfournisseur\b/i,
  /\bfournitures\b/i,
  /\bB2B\b/i,
  /\bprofessionnel/i,
  /\bprofessionnels\b/i,
  /\brevendeur/i,
  /\brevendeurs\b/i,
  /\bvente aux pro/i,
  /\bexport\b/i,
  /\busine\b/i,
  /\batelier\b/i,
  /\bmanufacture\b/i,
  /\bagroalimentaire\b/i,
];

const SEGMENT_PATTERNS: Record<CommercialSegment, RegExp[]> = {
  B2B_BRAND: [
    /\bmarque\b/i,
    /\bbrand\b/i,
    /\bfabricant\b/i,
    /\bcréateur\b/i,
    /\bcreator\b/i,
    /\brevendeur/i,
    /\bwholesale\b/i,
    /\bgrossiste\b/i,
    /\bdistributeur\b/i,
    /\bvente aux professionnels\b/i,
  ],
  WHOLESALER: [
    /\bgrossiste\b/i,
    /\bwholesale\b/i,
    /\bdistributeur\b/i,
    /\bdistribution\b/i,
    /\bimportateur\b/i,
    /\bexport\b/i,
    /\bfournisseur\b/i,
    /\bcentrale d'achat\b/i,
  ],
  MANUFACTURER: [
    /\bfabricant\b/i,
    /\bfabrication\b/i,
    /\bindustriel\b/i,
    /\bindustrie\b/i,
    /\béquipementier\b/i,
    /\bequipementier\b/i,
    /\busine\b/i,
    /\batelier\b/i,
    /\bmanufacture\b/i,
  ],
};

function combinedText(biz: BusinessResult): string {
  return [biz.name, biz.activity, ...(biz.types ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function hasExcludedGoogleType(types?: string[]): boolean {
  if (!types?.length) return false;
  return types.some((t) => EXCLUDED_GOOGLE_TYPES.has(t));
}

function hasB2bGoogleType(types?: string[]): boolean {
  if (!types?.length) return false;
  return types.some((t) => B2B_GOOGLE_TYPES.has(t));
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

export interface CommercialFilterResult {
  accepted: boolean;
  reason: string;
}

export function filterCommercialProspect(
  biz: BusinessResult,
  segment: CommercialSegment,
  niche?: string | null
): CommercialFilterResult {
  const text = combinedText(biz);

  if (hasExcludedGoogleType(biz.types)) {
    return {
      accepted: false,
      reason: `commerce de détail ou hors cible (${biz.types?.slice(0, 2).join(", ")})`,
    };
  }

  if (matchesAny(text, EXCLUDED_TEXT_PATTERNS)) {
    return { accepted: false, reason: "activité hors cible (club, école, resto…)" };
  }

  const hasB2bSignal = matchesAny(text, B2B_SIGNAL_PATTERNS);
  const isRetailOnly =
    matchesAny(text, RETAIL_ONLY_PATTERNS) && !hasB2bSignal;

  if (isRetailOnly) {
    return {
      accepted: false,
      reason: "magasin / boutique retail — pas une entreprise B2B vendeuse",
    };
  }

  const segmentMatch = matchesAny(text, SEGMENT_PATTERNS[segment]);
  const typeB2b = hasB2bGoogleType(biz.types);

  if (!segmentMatch && !hasB2bSignal && !typeB2b) {
    return {
      accepted: false,
      reason: "aucun signal B2B (marque, grossiste, fabricant, distributeur)",
    };
  }

  const nicheNorm = niche?.trim().toLowerCase() ?? "";
  if (nicheNorm) {
    const nicheWords = nicheNorm.split(/\s+/).filter((w) => w.length > 2);
    const mentionsNiche = nicheWords.some((w) => text.includes(w));
    const strongB2b = segmentMatch || typeB2b;

    if (!mentionsNiche && !strongB2b) {
      return {
        accepted: false,
        reason: `pas de lien avec le secteur « ${niche} » ni profil B2B clair`,
      };
    }
  }

  return { accepted: true, reason: "entreprise B2B vendeuse — cible pertinente" };
}

/** @deprecated Conservé pour compatibilité UI */
export function isCommercialVerticalNiche(_niche: string): boolean {
  return false;
}
