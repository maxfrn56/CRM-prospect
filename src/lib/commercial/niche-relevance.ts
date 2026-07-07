import type { BusinessResult } from "@/lib/google-places/client";
import type { CommercialSegment } from "@/lib/commercial/segments";
import { mentionsNiche } from "@/lib/commercial/geo-zones";
import { fetchGooglePlaceProfile } from "@/lib/google-places/place-profile";
import { fetchWebsiteNicheText } from "@/lib/commercial/website-niche";
import {
  qualifiesAsB2BBrand,
  isB2CExcluded,
} from "@/lib/commercial/b2b-profile";
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
 * Évalue si un prospect appartient à la niche ET au profil B2B marque :
 * nom, fiche Google, meta description site.
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

  if (isB2CExcluded(nameActivity)) {
    return {
      accepted: false,
      reason: "magasin B2C, école ou location",
      enrichedActivity: null,
      profileSnippet: null,
    };
  }

  const place = await fetchGooglePlaceProfile(biz.googlePlaceId);
  const profileSnippet =
    place.editorialSummary ??
    place.generativeSummary ??
    place.primaryTypeLabel ??
    null;

  const websiteUrl = biz.website ?? place.website;
  let websiteText = "";
  if (websiteUrl) {
    const web = await fetchWebsiteNicheText(websiteUrl);
    websiteText = web.combinedText;
  }

  const allTypes = [...new Set([...(biz.types ?? []), ...place.types])];
  const fullText = [nameActivity, place.combinedText, websiteText]
    .filter(Boolean)
    .join(" ");

  if (isWrongSector(fullText, niche)) {
    return {
      accepted: false,
      reason: "secteur sans rapport avec la niche",
      enrichedActivity: null,
      profileSnippet: null,
    };
  }

  if (!mentionsNiche(fullText, niche)) {
    return {
      accepted: false,
      reason: `secteur « ${niche} » non confirmé (nom, fiche Google ou site)`,
      enrichedActivity: null,
      profileSnippet: null,
    };
  }

  const b2b = qualifiesAsB2BBrand(fullText, allTypes);
  if (!b2b.ok) {
    return {
      accepted: false,
      reason: b2b.reason,
      enrichedActivity: null,
      profileSnippet: null,
    };
  }

  return {
    accepted: true,
    reason: `${b2b.reason} · niche ${niche}`,
    enrichedActivity: buildEnrichedActivity(
      biz,
      place.primaryTypeLabel,
      profileSnippet
    ),
    profileSnippet,
  };
}
