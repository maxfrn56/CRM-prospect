import type { AuditResult } from "@/lib/audit/website-audit";
import type { CommercialSegment } from "@/lib/commercial/segments";
import { getCommercialSegment } from "@/lib/commercial/segments";

export interface CommercialAuditResult extends AuditResult {
  auditKind: "commercial";
  commercialSegment: CommercialSegment;
  niche: string | null;
  commercialSignals: string[];
}

interface ProspectForCommercialAudit {
  name: string;
  activity?: string | null;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  employeeRange?: string | null;
  city?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
}

export async function auditCommercialProspect(
  prospect: ProspectForCommercialAudit,
  options: {
    segment: CommercialSegment;
    niche?: string | null;
  }
): Promise<CommercialAuditResult> {
  const config = getCommercialSegment(options.segment);
  const issues: string[] = [];
  const opportunities: string[] = [];
  const signals: string[] = [];

  let score = 35;

  const hasWebsite = Boolean(prospect.website?.trim());
  const hasPhone = Boolean(prospect.phone?.trim());
  const hasEmail = Boolean(prospect.email?.trim());

  if (!hasWebsite) {
    score += 15;
    signals.push("Peu de présence web structurée");
    opportunities.push("Prospection probablement manuelle — fort besoin d'outil");
  } else {
    signals.push("Site web présent");
    issues.push("Process de prospection possiblement non industrialisé");
  }

  if (hasPhone) {
    score += 10;
    signals.push("Téléphone disponible");
  }
  if (hasEmail) {
    score += 15;
    signals.push("Email contactable");
  } else {
    opportunities.push("Email à trouver à l'audit pour outbound");
  }

  const employees = prospect.employeeRange ?? "";
  if (/00|1\s*à\s*2|1-2|0\s*salarié/i.test(employees)) {
    score += 20;
    signals.push("Structure légère — décision rapide");
  } else if (/3\s*à\s*9|10\s*à\s*19|5|6|7|8|9|10|11|12|13|14|15|16|17|18|19|20/i.test(employees)) {
    score += 25;
    signals.push("Taille compatible cabinet / équipe commerciale");
  }

  switch (options.segment) {
    case "INDEPENDENT":
      score += 15;
      opportunities.push(
        "Cible idéale : gain de temps direct sur la prospection solo"
      );
      break;
    case "SDR_STARTUP":
      score += 12;
      opportunities.push("Stack outbound unifiée vs outils fragmentés");
      break;
    case "SALES_CABINET":
      score += 18;
      opportunities.push("Standardisation multi-commerciaux / multi-verticals");
      break;
  }

  const niche = options.niche?.trim() ?? null;
  if (niche) {
    signals.push(`Vertical : ${niche}`);
    score += 8;
  }

  const activity = (prospect.activity ?? "").toLowerCase();
  const name = prospect.name.toLowerCase();
  const commercialKeywords =
    /commercial|vente|sales|business development|sdr|prospection|mandataire|cabinet|agency|agence|conseil/i;
  if (commercialKeywords.test(activity) || commercialKeywords.test(name)) {
    score += 12;
    signals.push("Activité alignée profil commercial");
  }

  score = Math.min(100, score);

  const segmentLabel = config?.label ?? options.segment;
  const summary =
    score >= 70
      ? `Fort potentiel (${score}/100) — ${segmentLabel}${niche ? ` · ${niche}` : ""} : bon profil pour l'outil de prospection.`
      : score >= 45
        ? `Potentiel modéré (${score}/100) — ${segmentLabel}, à qualifier en demo.`
        : `Priorité basse (${score}/100) — profil moins aligné.`;

  return {
    auditKind: "commercial",
    commercialSegment: options.segment,
    niche,
    commercialSignals: signals,
    score,
    technicalScore: score,
    hasWebsite,
    websiteUrl: prospect.website ?? null,
    https: prospect.website?.startsWith("https://") ?? false,
    responsive: false,
    loadTimeMs: null,
    outdatedDesign: false,
    missingMetaDescription: false,
    instagramUrl: null,
    facebookUrl: null,
    visual: null,
    issues,
    opportunities,
    summary,
  };
}

export function isCommercialAudit(
  audit: AuditResult | null | undefined
): audit is CommercialAuditResult {
  return (
    audit != null &&
    "auditKind" in audit &&
    (audit as CommercialAuditResult).auditKind === "commercial"
  );
}
