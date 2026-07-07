import type { BusinessResult } from "@/lib/google-places/client";
import type { CommercialSegment } from "@/lib/commercial/segments";
import {
  matchesTargetArea,
  mentionsNiche,
  expandNicheTerms,
} from "@/lib/commercial/geo-zones";

/** Toujours exclus */
const HARD_EXCLUDED_GOOGLE_TYPES = new Set([
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
  "supermarket",
  "grocery_store",
  "convenience_store",
  "moving_company",
]);

/** Exclus sauf pour le segment « marque » (magasins / showrooms de marque OK) */
const RETAIL_GOOGLE_TYPES = new Set([
  "sporting_goods_store",
  "clothing_store",
  "shoe_store",
  "jewelry_store",
  "department_store",
  "shopping_mall",
]);

const ALWAYS_EXCLUDED_TEXT: RegExp[] = [
  /\bécole de surf\b/i,
  /\bsurf school\b/i,
  /\bcours de surf\b/i,
  /\bclub de surf\b/i,
  /\bsurf club\b/i,
  /\bstage de surf\b/i,
  /\bcamp de surf\b/i,
  /\blocation de surf\b/i,
  /\blocation planche\b/i,
  /\bcentre de formation\b/i,
  /\buniversité\b/i,
  /\bdéménagement\b/i,
  /\bdemenagement\b/i,
  /\btransgourmet\b/i,
  /\brestaurant\b/i,
  /\bhôtel\b/i,
  /\bhotel\b/i,
];

const WRONG_SECTOR_TEXT: RegExp[] = [
  /\balimentaire\b/i,
  /\bboisson\b/i,
  /\bpetfood\b/i,
  /\bhygiène pro\b/i,
  /\bpharmacie\b/i,
  /\bimmobilier\b/i,
  /\bassurance\b/i,
  /\bautomobile\b/i,
  /\bplombier\b/i,
  /\bélectricien\b/i,
];

const B2B_SIGNAL_PATTERNS: RegExp[] = [
  /\bmarque\b/i,
  /\bbrand\b/i,
  /\bfabricant\b/i,
  /\bgrossiste\b/i,
  /\bdistributeur\b/i,
  /\bimportateur\b/i,
  /\bfournisseur\b/i,
  /\bprofessionnels\b/i,
  /\brevendeur/i,
  /\busine\b/i,
  /\batelier\b/i,
  /\bshaper\b/i,
];

function combinedText(biz: BusinessResult): string {
  return [biz.name, biz.activity, biz.address, ...(biz.types ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

function hasExcludedGoogleType(
  types: string[] | undefined,
  segment: CommercialSegment
): boolean {
  if (!types?.length) return false;
  return types.some((t) => {
    if (HARD_EXCLUDED_GOOGLE_TYPES.has(t)) return true;
    if (segment === "B2B_BRAND" && RETAIL_GOOGLE_TYPES.has(t)) return false;
    if (RETAIL_GOOGLE_TYPES.has(t)) return true;
    return false;
  });
}

export interface CommercialFilterResult {
  accepted: boolean;
  reason: string;
}

export interface CommercialFilterOptions {
  niche?: string | null;
  targetLocation?: string | null;
}

/**
 * Segment B2B_BRAND = trouver des MARQUES dans la niche (B2C, B2B ou mixte).
 * On fait confiance à la requête Google + filtre géo, sans exiger « grossiste » dans le nom.
 */
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
      reason: `hors zone (${biz.city ?? "?"})`,
    };
  }

  if (hasExcludedGoogleType(biz.types, segment)) {
    return {
      accepted: false,
      reason: `type exclu (${biz.types?.slice(0, 2).join(", ")})`,
    };
  }

  if (matchesAny(text, ALWAYS_EXCLUDED_TEXT)) {
    return { accepted: false, reason: "école / club / location / hors cible" };
  }

  if (matchesAny(text, WRONG_SECTOR_TEXT) && !mentionsNiche(text, nicheNorm)) {
    return { accepted: false, reason: "secteur sans rapport" };
  }

  if (segment === "B2B_BRAND") {
    return {
      accepted: true,
      reason: mentionsNiche(text, nicheNorm)
        ? "marque / acteur niche confirmé"
        : "résultat requête niche — retenu",
    };
  }

  if (nicheNorm && !mentionsNiche(text, nicheNorm)) {
    return {
      accepted: false,
      reason: `secteur « ${nicheNorm} » absent`,
    };
  }

  if (
    !matchesAny(text, B2B_SIGNAL_PATTERNS) &&
    !biz.types?.includes("wholesaler") &&
    !biz.types?.includes("factory")
  ) {
    return { accepted: false, reason: "pas de profil grossiste / fabricant" };
  }

  return { accepted: true, reason: "profil B2B niche" };
}

export function isCommercialVerticalNiche(_niche: string): boolean {
  return false;
}

export { expandNicheTerms, matchesTargetArea, mentionsNiche };
