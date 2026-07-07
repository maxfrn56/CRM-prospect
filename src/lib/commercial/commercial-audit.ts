import type { AuditResult } from "@/lib/audit/website-audit";
import type { CommercialSegment } from "@/lib/commercial/segments";
import { getCommercialSegment } from "@/lib/commercial/segments";
import { mentionsNiche } from "@/lib/commercial/geo-zones";

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
  nafLabel?: string | null;
}

const B2B_KEYWORDS =
  /marque|brand|fabricant|grossiste|distributeur|distribution|importateur|fournisseur|équipementier|equipementier|industriel|industrie|B2B|professionnel|revendeur|wholesale|manufactur/i;

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

  let score = 40;

  const name = prospect.name.toLowerCase();
  const activity = (prospect.activity ?? prospect.nafLabel ?? "").toLowerCase();
  const combined = `${name} ${activity}`;
  const nicheVal = options.niche?.trim() ?? null;

  if (B2B_KEYWORDS.test(combined) || (nicheVal && mentionsNiche(combined, nicheVal))) {
    score += 22;
    signals.push("Acteur B2B du secteur (marque, fabricant, distributeur…)");
  } else {
    score += 4;
    issues.push("Profil B2B peu visible — à valider manuellement");
  }

  const hasWebsite = Boolean(prospect.website?.trim());
  const hasPhone = Boolean(prospect.phone?.trim());
  const hasEmail = Boolean(prospect.email?.trim());

  if (hasWebsite) {
    score += 12;
    signals.push("Site web — entreprise structurée");
    opportunities.push(
      "Prospection commerciale probablement gérée manuellement — automatisable"
    );
  } else {
    score += 5;
    opportunities.push("Présence digitale limitée — qualification téléphonique");
  }

  if (hasPhone) {
    score += 8;
    signals.push("Téléphone disponible");
  }
  if (hasEmail) {
    score += 15;
    signals.push("Email contactable pour outbound");
  } else {
    opportunities.push("Email à enrichir à l'audit pour campagne");
  }

  const employees = prospect.employeeRange ?? "";
  if (/10\s*à\s*19|20\s*à\s*49|6\s*à\s*9|3\s*à\s*5|5|6|7|8|9|10|11|12|13|14|15|16|17|18|19|20/i.test(employees)) {
    score += 20;
    signals.push("Taille compatible équipe commerciale interne");
    opportunities.push(
      "Équipe suffisante pour ROI sur un outil de prospection dédié"
    );
  } else if (/1\s*à\s*2|00|0\s*salarié/i.test(employees)) {
    score += 8;
    signals.push("Structure légère — décision rapide possible");
  }

  switch (options.segment) {
    case "B2B_BRAND":
      score += 10;
      if (/marque|brand|fabricant/i.test(combined)) {
        score += 8;
        opportunities.push(
          "Marque B2B : automatiser la prospection de nouveaux magasins / revendeurs"
        );
      }
      break;
    case "WHOLESALER":
      score += 12;
      opportunities.push(
        "Grossiste : industrialiser la prospection clients pro et les relances terrain"
      );
      break;
    case "MANUFACTURER":
      score += 10;
      opportunities.push(
        "Fabricant : outbound structuré vers distributeurs et clients industriels"
      );
      break;
  }

  const niche = options.niche?.trim() ?? null;
  if (niche) {
    const nicheWords = niche.toLowerCase().split(/\s+/);
    if (nicheWords.some((w) => w.length > 2 && combined.includes(w))) {
      score += 12;
      signals.push(`Secteur produit : ${niche}`);
    } else {
      signals.push(`Campagne secteur : ${niche}`);
      score += 4;
    }
  }

  score = Math.min(100, score);

  const segmentLabel = config?.label ?? options.segment;
  const summary =
    score >= 70
      ? `Fort potentiel (${score}/100) — ${segmentLabel}${niche ? ` · ${niche}` : ""} : bonne cible pour un CRM de prospection sur mesure.`
      : score >= 45
        ? `Potentiel modéré (${score}/100) — ${segmentLabel}, à valider en démo.`
        : `Priorité basse (${score}/100) — profil B2B incertain.`;

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
