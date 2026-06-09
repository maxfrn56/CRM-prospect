import { enrichFromSirene } from "./sirene";
import { enrichFromPappers } from "./pappers";
import { findEmailOnWebsite } from "@/lib/email-finder/website-email-finder";
import type { BusinessResult } from "@/lib/google-places/client";

export interface EnrichedBusiness extends BusinessResult {
  siren?: string;
  siret?: string;
  nafCode?: string;
  nafLabel?: string;
  legalName?: string;
  directorName?: string;
  employeeRange?: string;
  enrichmentSource?: string;
  emailFoundOn?: string;
  emailConfidence?: number;
}

export interface EnrichOptions {
  /** Désactivé à l'import pour éviter les timeouts — activé à l'audit */
  skipEmailFinder?: boolean;
  skipPappers?: boolean;
}

export async function enrichBusiness(
  business: BusinessResult,
  options: EnrichOptions = {}
): Promise<EnrichedBusiness> {
  const sirene = await enrichFromSirene({
    name: business.name,
    city: business.city,
    postalCode: business.postalCode,
  });

  let enriched: EnrichedBusiness = {
    ...business,
    siren: sirene.siren,
    siret: sirene.siret,
    nafCode: sirene.nafCode,
    nafLabel: sirene.nafLabel,
    legalName: sirene.legalName,
    directorName: sirene.directorName,
    employeeRange: sirene.employeeRange,
    enrichmentSource: sirene.matched ? "sirene" : undefined,
  };

  if (!options.skipPappers) {
    const pappers = await enrichFromPappers({
      name: business.name,
      siren: sirene.siren,
      city: business.city,
    });

    if (pappers.matched) {
      enriched = {
        ...enriched,
        email: enriched.email ?? pappers.email,
        phone: enriched.phone ?? pappers.phone,
        website: enriched.website ?? pappers.website,
        siren: enriched.siren ?? pappers.siren,
        siret: enriched.siret ?? pappers.siret,
        employeeRange: enriched.employeeRange ?? pappers.effectif,
        directorName: enriched.directorName ?? pappers.dirigeant,
        enrichmentSource: enriched.enrichmentSource
          ? `${enriched.enrichmentSource}+pappers`
          : "pappers",
      };
    }
  }

  if (!options.skipEmailFinder && !enriched.email && enriched.website) {
    const found = await findEmailOnWebsite(enriched.website);
    if (found.email) {
      enriched.email = found.email;
      enriched.emailFoundOn = found.foundOn ?? undefined;
      enriched.emailConfidence = found.confidence;
      enriched.enrichmentSource = enriched.enrichmentSource
        ? `${enriched.enrichmentSource}+email-finder`
        : "email-finder";
    }
  }

  return enriched;
}

export async function findEmailForProspect(website: string | null | undefined) {
  return findEmailOnWebsite(website);
}
