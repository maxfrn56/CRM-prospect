import type { BusinessResult } from "@/lib/google-places/client";
import type { CommercialSegment } from "@/lib/commercial/segments";

/** Niches où « mandataire / agent + niche » fonctionne bien sur Google Places */
const COMMERCIAL_VERTICAL_NICHES = new Set([
  "immobilier",
  "assurance",
  "énergie",
  "energie",
  "automobile",
  "auto",
  "crédit",
  "credit",
  "mutuelle",
  "télécom",
  "telecom",
  "finance",
  "banque",
  "prévoyance",
  "prevoyance",
]);

const EXCLUDED_GOOGLE_TYPES = new Set([
  "gym",
  "sports_club",
  "fitness_center",
  "stadium",
  "swimming_pool",
  "sports_complex",
  "school",
  "primary_school",
  "secondary_school",
  "university",
  "coworking_space",
  "restaurant",
  "cafe",
  "bar",
  "night_club",
  "lodging",
  "hotel",
  "motel",
  "campground",
  "park",
  "museum",
  "church",
  "hospital",
  "doctor",
  "dentist",
  "pharmacy",
  "beauty_salon",
  "hair_care",
  "spa",
  "store",
  "supermarket",
  "grocery_store",
  "clothing_store",
]);

const EXCLUDED_TEXT_PATTERNS: RegExp[] = [
  /\bclub\b/i,
  /\bécole\b/i,
  /\becole\b/i,
  /\buniversité\b/i,
  /\buniversite\b/i,
  /\bcoworking\b/i,
  /\bco-working\b/i,
  /\bco working\b/i,
  /\bsalle de sport\b/i,
  /\bsalle de gym\b/i,
  /\bfitness\b/i,
  /\bgym\b/i,
  /\bcoach\b/i,
  /\bcoaching\b/i,
  /\bentraîneur\b/i,
  /\bentraineur\b/i,
  /\bassociation\b/i,
  /\bfédération\b/i,
  /\bfederation\b/i,
  /\bcentre de formation\b/i,
  /\borganisme de formation\b/i,
  /\bacadémie\b/i,
  /\bacademie\b/i,
  /\bstudio\b/i,
  /\bpadel\b/i,
  /\btennis\b/i,
  /\bfootball\b/i,
  /\bbasket\b/i,
  /\brestaurant\b/i,
  /\bhôtel\b/i,
  /\bhotel\b/i,
  /\bhostel\b/i,
  /\bairbnb\b/i,
];

const POSITIVE_TEXT_PATTERNS: RegExp[] = [
  /\bcommercial\b/i,
  /\bcommerciaux\b/i,
  /\bmandataire\b/i,
  /\bagent commercial\b/i,
  /\bconseiller commercial\b/i,
  /\bconseillère commercial\b/i,
  /\breprésentant\b/i,
  /\brepresentant\b/i,
  /\bnégociateur\b/i,
  /\bnégociatrice\b/i,
  /\bcourtier\b/i,
  /\bvente[s]?\b/i,
  /\bvendeur\b/i,
  /\bvendeuse\b/i,
  /\bforce de vente\b/i,
  /\bcabinet commercial\b/i,
  /\bagence commerciale\b/i,
  /\bexternalis/i,
  /\bbusiness developer\b/i,
  /\bchargé d'affaires\b/i,
  /\bcharge d'affaires\b/i,
  /\bSDR\b/,
  /\bsales\b/i,
  /\bprospection\b/i,
  /\bdistributeur\b/i,
  /\bimportateur\b/i,
];

const SEGMENT_POSITIVE_PATTERNS: Record<CommercialSegment, RegExp[]> = {
  INDEPENDENT: [
    /\bindépendant\b/i,
    /\bindependant\b/i,
    /\bmandataire\b/i,
    /\bagent\b/i,
    /\bconseiller\b/i,
    /\bconseillère\b/i,
    /\bauto-entrepreneur\b/i,
    /\bfreelance\b/i,
    /\bcommercial\b/i,
    /\bvente[s]?\b/i,
    /\breprésentant\b/i,
    /\brepresentant\b/i,
    /\bcourtier\b/i,
  ],
  SDR_STARTUP: [
    /\bstartup\b/i,
    /\bscale-up\b/i,
    /\bscaleup\b/i,
    /\bSaaS\b/i,
    /\btech\b/i,
    /\bSDR\b/,
    /\bsales\b/i,
    /\bgrowth\b/i,
    /\boutbound\b/i,
    /\bB2B\b/i,
  ],
  SALES_CABINET: [
    /\bcabinet\b/i,
    /\bforce de vente\b/i,
    /\bagence commerciale\b/i,
    /\bexternalis/i,
    /\bcommercial\b/i,
    /\bcommerciaux\b/i,
    /\béquipe commerciale\b/i,
    /\bequipe commerciale\b/i,
  ],
};

const VERTICAL_GOOGLE_TYPES: Record<string, string[]> = {
  immobilier: ["real_estate_agency"],
  assurance: ["insurance_agency"],
  automobile: ["car_dealer", "car_repair"],
  auto: ["car_dealer", "car_repair"],
  énergie: ["electrician", "plumber"],
  energie: ["electrician", "plumber"],
};

function getVerticalGoogleTypes(niche: string): string[] {
  const normalized = niche.trim().toLowerCase();
  for (const [key, types] of Object.entries(VERTICAL_GOOGLE_TYPES)) {
    if (normalized.includes(key)) return types;
  }
  return [];
}

export function isCommercialVerticalNiche(niche: string): boolean {
  const normalized = niche.trim().toLowerCase();
  if (!normalized) return false;
  for (const vertical of COMMERCIAL_VERTICAL_NICHES) {
    if (normalized.includes(vertical)) return true;
  }
  return false;
}

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
      reason: `type Google exclu (${biz.types?.slice(0, 2).join(", ")})`,
    };
  }

  if (matchesAny(text, EXCLUDED_TEXT_PATTERNS)) {
    return { accepted: false, reason: "activité hors cible (club, école, coach…)" };
  }

  const nicheNorm = niche?.trim().toLowerCase() ?? "";
  if (nicheNorm && isCommercialVerticalNiche(nicheNorm)) {
    const verticalTypes = getVerticalGoogleTypes(nicheNorm);
    if (verticalTypes.length && biz.types?.some((t) => verticalTypes.includes(t))) {
      return { accepted: true, reason: "agence du vertical commercial" };
    }
  }

  const segmentPatterns = SEGMENT_POSITIVE_PATTERNS[segment];
  const hasSegmentSignal = matchesAny(text, segmentPatterns);
  const hasSalesSignal = matchesAny(text, POSITIVE_TEXT_PATTERNS);

  if (!hasSegmentSignal && !hasSalesSignal) {
    return {
      accepted: false,
      reason: "aucun signal commercial (nom ou activité)",
    };
  }

  // Pour une niche « métier » (sport, IT…) : exiger un lien niche ou signal vente fort
  if (nicheNorm && !isCommercialVerticalNiche(nicheNorm)) {
    const nicheWords = nicheNorm.split(/\s+/).filter((w) => w.length > 2);
    const mentionsNiche = nicheWords.some((w) => text.includes(w));
    const strongSales =
      matchesAny(text, [
        /\bcommercial\b/i,
        /\bmandataire\b/i,
        /\bagent commercial\b/i,
        /\breprésentant\b/i,
        /\brepresentant\b/i,
        /\bforce de vente\b/i,
        /\bcabinet commercial\b/i,
      ]) && hasSalesSignal;

    if (!mentionsNiche && !strongSales) {
      return {
        accepted: false,
        reason: `pas de lien avec la niche « ${niche} » ni profil commercial clair`,
      };
    }
  }

  return { accepted: true, reason: "profil commercial pertinent" };
}
