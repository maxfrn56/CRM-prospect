import type { BusinessResult } from "@/lib/google-places/client";
import type { CommercialSegment } from "@/lib/commercial/segments";
import {
  matchesTargetArea,
  mentionsNiche,
  expandNicheTerms,
} from "@/lib/commercial/geo-zones";
import {
  B2B_SIGNAL_PATTERNS,
  B2C_EXCLUSION_PATTERNS,
  hasB2BSignal,
  isB2CExcluded,
  isPureRetailGoogleType,
  hasB2BGoogleType,
  matchesAny,
} from "@/lib/commercial/b2b-profile";

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

function combinedText(biz: BusinessResult): string {
  return [biz.name, biz.activity, biz.address, ...(biz.types ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function hasExcludedGoogleType(types: string[] | undefined): boolean {
  if (!types?.length) return false;
  return types.some((t) => HARD_EXCLUDED_GOOGLE_TYPES.has(t));
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
 * Segment B2B_BRAND = marques B2B du secteur (fabricants, marques avec réseau pro).
 * Magasins B2C et écoles exclus dès le pré-filtre si détectables sans enrichissement.
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

  if (hasExcludedGoogleType(biz.types)) {
    return {
      accepted: false,
      reason: `type exclu (${biz.types?.slice(0, 2).join(", ")})`,
    };
  }

  if (isB2CExcluded(text)) {
    return { accepted: false, reason: "école / magasin B2C / location" };
  }

  if (matchesAny(text, WRONG_SECTOR_TEXT) && !mentionsNiche(text, nicheNorm)) {
    return { accepted: false, reason: "secteur sans rapport" };
  }

  if (segment === "B2B_BRAND") {
    if (
      isPureRetailGoogleType(biz.types) &&
      !hasB2BSignal(text) &&
      !hasB2BGoogleType(biz.types)
    ) {
      const nameLooksRetail =
        /\b(surf\s*shop|magasin|boutique|shop)\b/i.test(biz.name ?? "");
      if (nameLooksRetail) {
        return {
          accepted: false,
          reason: "magasin retail B2C (nom)",
        };
      }
    }
    return {
      accepted: true,
      reason: "candidat marque — qualification B2B à l'enrichissement",
    };
  }

  if (nicheNorm && !mentionsNiche(text, nicheNorm)) {
    return {
      accepted: false,
      reason: `secteur « ${nicheNorm} » absent`,
    };
  }

  if (
    !hasB2BSignal(text) &&
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

export { expandNicheTerms, matchesTargetArea, mentionsNiche, B2B_SIGNAL_PATTERNS, B2C_EXCLUSION_PATTERNS };
