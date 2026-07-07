import type { BusinessResult } from "@/lib/google-places/client";
import type { CommercialSegment } from "@/lib/commercial/segments";
import {
  matchesTargetArea,
  mentionsNiche,
  expandNicheTerms,
} from "@/lib/commercial/geo-zones";

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
  "moving_company",
]);

const B2B_GOOGLE_TYPES = new Set([
  "factory",
  "corporate_office",
  "storage",
  "warehouse",
  "wholesaler",
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
  /\bdéménagement\b/i,
  /\bdemenagement\b/i,
];

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
  /\bshowroom\b/i,
];

const B2B_SIGNAL_PATTERNS: RegExp[] = [
  /\bmarque\b/i,
  /\bbrand\b/i,
  /\bfabricant\b/i,
  /\bmanufacturer\b/i,
  /\bfabrication\b/i,
  /\bindustriel\b/i,
  /\béquipementier\b/i,
  /\bequipementier\b/i,
  /\bgrossiste\b/i,
  /\bwholesale\b/i,
  /\bdistributeur\b/i,
  /\bdistribution\b/i,
  /\bimportateur\b/i,
  /\bfournisseur\b/i,
  /\bB2B\b/i,
  /\bprofessionnels\b/i,
  /\brevendeur/i,
  /\brevendeurs\b/i,
  /\bexport\b/i,
  /\busine\b/i,
  /\batelier\b/i,
];

/** Secteurs hors niche — rejetés si la niche ne correspond pas */
const CROSS_SECTOR_PATTERNS: RegExp[] = [
  /\balimentaire\b/i,
  /\bboisson\b/i,
  /\bpetfood\b/i,
  /\bhygiène\b/i,
  /\bhygiene\b/i,
  /\btransgourmet\b/i,
  /\bmetro\b/i,
  /\bbricolage\b/i,
  /\bpharmacie\b/i,
  /\bautomobile\b/i,
  /\bimmobilier\b/i,
  /\bassurance\b/i,
];

const SEGMENT_PATTERNS: Record<CommercialSegment, RegExp[]> = {
  B2B_BRAND: [
    /\bmarque\b/i,
    /\bbrand\b/i,
    /\bfabricant\b/i,
    /\bcréateur\b/i,
    /\brevendeur/i,
    /\bgrossiste\b/i,
    /\bdistributeur\b/i,
  ],
  WHOLESALER: [
    /\bgrossiste\b/i,
    /\bdistributeur\b/i,
    /\bimportateur\b/i,
    /\bfournisseur\b/i,
  ],
  MANUFACTURER: [
    /\bfabricant\b/i,
    /\bfabrication\b/i,
    /\bindustriel\b/i,
    /\béquipementier\b/i,
    /\busine\b/i,
  ],
};

function combinedText(biz: BusinessResult): string {
  return [biz.name, biz.activity, biz.address, ...(biz.types ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function hasExcludedGoogleType(types?: string[]): boolean {
  if (!types?.length) return false;
  return types.some((t) => EXCLUDED_GOOGLE_TYPES.has(t));
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

function isCrossSectorMismatch(text: string, niche: string): boolean {
  if (!matchesAny(text, CROSS_SECTOR_PATTERNS)) return false;
  return !mentionsNiche(text, niche);
}

export interface CommercialFilterResult {
  accepted: boolean;
  reason: string;
}

export interface CommercialFilterOptions {
  niche?: string | null;
  targetLocation?: string | null;
}

export function filterCommercialProspect(
  biz: BusinessResult,
  segment: CommercialSegment,
  options: CommercialFilterOptions = {}
): CommercialFilterResult {
  const { niche, targetLocation } = options;
  const text = combinedText(biz);
  const nicheNorm = niche?.trim() ?? "";

  if (targetLocation?.trim() && !matchesTargetArea(biz, targetLocation)) {
    return {
      accepted: false,
      reason: `hors zone « ${targetLocation} » (${biz.city ?? "ville inconnue"})`,
    };
  }

  if (hasExcludedGoogleType(biz.types)) {
    return {
      accepted: false,
      reason: `type Google exclu (${biz.types?.slice(0, 2).join(", ")})`,
    };
  }

  if (matchesAny(text, EXCLUDED_TEXT_PATTERNS)) {
    return { accepted: false, reason: "activité hors cible" };
  }

  const hasB2bSignal = matchesAny(text, B2B_SIGNAL_PATTERNS);
  const isRetailOnly =
    matchesAny(text, RETAIL_ONLY_PATTERNS) && !hasB2bSignal;

  if (isRetailOnly) {
    return {
      accepted: false,
      reason: "magasin / boutique retail — pas une marque B2B vendeuse",
    };
  }

  if (nicheNorm) {
    if (!mentionsNiche(text, nicheNorm)) {
      return {
        accepted: false,
        reason: `secteur « ${nicheNorm} » absent (${biz.name})`,
      };
    }

    if (isCrossSectorMismatch(text, nicheNorm)) {
      return {
        accepted: false,
        reason: `activité d'un autre secteur (pas ${nicheNorm})`,
      };
    }
  }

  const segmentMatch = matchesAny(text, SEGMENT_PATTERNS[segment]);

  if (!segmentMatch && !hasB2bSignal) {
    return {
      accepted: false,
      reason: "pas de profil marque / grossiste / fabricant B2B",
    };
  }

  return { accepted: true, reason: "marque ou distributeur B2B dans la niche" };
}

export function isCommercialVerticalNiche(_niche: string): boolean {
  return false;
}

export { expandNicheTerms, matchesTargetArea, mentionsNiche };
