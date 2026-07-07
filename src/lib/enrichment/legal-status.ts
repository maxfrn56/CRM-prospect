import { enrichFromSirene, type SireneEnrichment } from "@/lib/enrichment/sirene";
import { enrichFromPappers, type PappersEnrichment } from "@/lib/enrichment/pappers";

export type LegalAdministrativeStatus = "active" | "ceased" | "unknown";

export interface LegalStatusResult {
  administrativeStatus: LegalAdministrativeStatus;
  label: string;
  siren?: string;
  siret?: string;
  legalName?: string;
  directorName?: string;
  closureDate?: string | null;
  radiationDate?: string | null;
  openEstablishments?: number | null;
  sources: string[];
  matched: boolean;
}

interface LegalStatusInput {
  name: string;
  siren?: string | null;
  siret?: string | null;
  city?: string | null;
  postalCode?: string | null;
}

export async function fetchLegalStatus(
  input: LegalStatusInput
): Promise<LegalStatusResult> {
  let sirene: SireneEnrichment = { matched: false };
  let pappers: PappersEnrichment = { matched: false };

  if (input.siren) {
    sirene = await enrichFromSirene({
      name: input.siren,
      city: input.city ?? undefined,
      postalCode: input.postalCode ?? undefined,
    });
  }

  if (!sirene.matched) {
    sirene = await enrichFromSirene({
      name: input.name,
      city: input.city ?? undefined,
      postalCode: input.postalCode ?? undefined,
    });
  }

  const siren = sirene.siren ?? input.siren ?? undefined;
  if (siren) {
    pappers = await enrichFromPappers({
      name: input.name,
      siren,
      city: input.city ?? undefined,
    });
  }

  return mergeLegalStatus(sirene, pappers);
}

function mergeLegalStatus(
  sirene: SireneEnrichment,
  pappers: PappersEnrichment
): LegalStatusResult {
  const sources: string[] = [];
  if (sirene.matched) sources.push("sirene");
  if (pappers.matched) sources.push("pappers");

  const ceasedFromSirene = sirene.administrativeStatus === "C";
  const ceasedFromPappers = pappers.isCeased === true;

  let administrativeStatus: LegalAdministrativeStatus = "unknown";
  if (ceasedFromSirene || ceasedFromPappers) {
    administrativeStatus = "ceased";
  } else if (sirene.administrativeStatus === "A" || pappers.matched) {
    administrativeStatus = "active";
  }

  const label =
    administrativeStatus === "ceased"
      ? pappers.statusLabel ??
        (sirene.closureDate
          ? `Cessée (INSEE, depuis ${formatFrDate(sirene.closureDate)})`
          : "Cessée / radiée (INSEE ou Pappers)")
      : administrativeStatus === "active"
        ? "Active (INSEE)"
        : "Statut juridique inconnu";

  return {
    administrativeStatus,
    label,
    siren: sirene.siren ?? pappers.siren,
    siret: sirene.siret ?? pappers.siret,
    legalName: sirene.legalName,
    directorName: sirene.directorName ?? pappers.dirigeant,
    closureDate: sirene.closureDate ?? pappers.cessationDate ?? null,
    radiationDate: pappers.radiationDate ?? null,
    openEstablishments: sirene.openEstablishments ?? null,
    sources,
    matched: sirene.matched || pappers.matched,
  };
}

function formatFrDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR");
}
