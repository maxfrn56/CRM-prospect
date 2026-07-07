import type { BusinessResult } from "@/lib/google-places/client";
import type { CommercialSegment } from "@/lib/commercial/segments";
import { mentionsNiche } from "@/lib/commercial/geo-zones";
import { fetchGooglePlaceProfile } from "@/lib/google-places/place-profile";
import { fetchWebsiteNicheText } from "@/lib/commercial/website-niche";
import {
  filterCommercialProspect,
  type CommercialFilterOptions,
} from "@/lib/commercial/prospect-filter";

export interface NicheRelevanceResult {
  accepted: boolean;
  reason: string;
  enrichedActivity: string | null;
  profileSnippet: string | null;
}

const BRAND_FRIENDLY_TYPES = new Set([
  "sporting_goods_store",
  "clothing_store",
  "shoe_store",
  "store",
  "corporate_office",
  "factory",
  "warehouse",
  "wholesaler",
]);

function baseText(biz: BusinessResult): string {
  return [biz.name, biz.activity, ...(biz.types ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isWrongSector(text: string, niche: string): boolean {
  const wrong =
    /\b(alimentaire|boisson|petfood|transgourmet|déménagement|demenagement|immobilier|assurance|pharmacie|plombier|boulangerie)\b/i;
  return wrong.test(text) && !mentionsNiche(text, niche);
}

function buildEnrichedActivity(
  biz: BusinessResult,
  placeLabel: string | null,
  placeDesc: string | null
): string | null {
  const parts = [
    biz.activity,
    placeLabel,
    placeDesc?.slice(0, 120),
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join(" · ");
}

/**
 * Évalue si un prospect appartient à la niche en analysant :
 * nom, activité Google, description fiche Google, meta description du site.
 */
export async function assessNicheRelevance(
  biz: BusinessResult,
  segment: CommercialSegment,
  options: CommercialFilterOptions
): Promise<NicheRelevanceResult> {
  const niche = options.niche?.trim() ?? "";
  const hard = filterCommercialProspect(biz, segment, options);
  if (!hard.accepted) {
    return {
      accepted: false,
      reason: hard.reason,
      enrichedActivity: null,
      profileSnippet: null,
    };
  }

  if (segment !== "B2B_BRAND" || !niche) {
    return {
      accepted: true,
      reason: hard.reason,
      enrichedActivity: biz.activity ?? null,
      profileSnippet: null,
    };
  }

  const nameActivity = baseText(biz);
  let profileSnippet: string | null = null;

  if (mentionsNiche(nameActivity, niche)) {
    return {
      accepted: true,
      reason: "niche détectée (nom / activité Google)",
      enrichedActivity: biz.activity ?? null,
      profileSnippet: null,
    };
  }

  const place = await fetchGooglePlaceProfile(biz.googlePlaceId);
  const placeText = place.combinedText;
  profileSnippet =
    place.editorialSummary ??
    place.generativeSummary ??
    place.primaryTypeLabel ??
    null;

  const websiteUrl = biz.website ?? place.website;
  let websiteText = "";

  if (mentionsNiche(placeText, niche)) {
    return {
      accepted: true,
      reason: "niche détectée (description Google Business)",
      enrichedActivity: buildEnrichedActivity(
        biz,
        place.primaryTypeLabel,
        profileSnippet
      ),
      profileSnippet,
    };
  }

  if (websiteUrl) {
    const web = await fetchWebsiteNicheText(websiteUrl);
    websiteText = web.combinedText;
    if (mentionsNiche(websiteText, niche)) {
      return {
        accepted: true,
        reason: "niche détectée (site web / meta description)",
        enrichedActivity: buildEnrichedActivity(
          biz,
          place.primaryTypeLabel,
          profileSnippet ?? websiteText.slice(0, 120)
        ),
        profileSnippet: profileSnippet ?? websiteText.slice(0, 200),
      };
    }
  }

  const fullText = `${nameActivity} ${placeText} ${websiteText}`;
  if (isWrongSector(fullText, niche)) {
    return {
      accepted: false,
      reason: "secteur sans rapport avec la niche",
      enrichedActivity: null,
      profileSnippet: null,
    };
  }

  const hasBrandType = biz.types?.some((t) => BRAND_FRIENDLY_TYPES.has(t));
  if (hasBrandType) {
    return {
      accepted: true,
      reason: "acteur retail / marque — retenu (zone + requête niche)",
      enrichedActivity: buildEnrichedActivity(
        biz,
        place.primaryTypeLabel,
        profileSnippet
      ),
      profileSnippet,
    };
  }

  return {
    accepted: true,
    reason: "dans la zone — retenu via requête secteur (nom sans mot-clé niche)",
    enrichedActivity: buildEnrichedActivity(
      biz,
      place.primaryTypeLabel,
      profileSnippet
    ),
    profileSnippet,
  };
}
