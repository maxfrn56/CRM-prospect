import type { AuditResult } from "@/lib/audit/website-audit";
import type { LegalStatusResult } from "@/lib/enrichment/legal-status";
import type { GooglePlaceActivity } from "@/lib/google-places/place-activity";

export type ActivityLevel =
  | "ACTIVE"
  | "UNCERTAIN"
  | "LIKELY_INACTIVE"
  | "CLOSED";

export interface ActivityAssessment {
  level: ActivityLevel;
  scorePenalty: number;
  signals: string[];
  legal?: {
    status: LegalStatusResult["administrativeStatus"];
    label: string;
    closureDate?: string | null;
    radiationDate?: string | null;
    sources: string[];
  };
  google?: {
    businessStatus?: string | null;
    lastReviewDate?: string | null;
    monthsSinceLastReview?: number | null;
    reviewCount?: number | null;
  };
}

const STALE_REVIEW_MONTHS = 24;
const UNCERTAIN_REVIEW_MONTHS = 18;

export function assessProspectActivity(input: {
  legal: LegalStatusResult;
  google: GooglePlaceActivity;
  storedReviewCount?: number | null;
}): ActivityAssessment {
  const signals: string[] = [];
  let level: ActivityLevel = "ACTIVE";
  let scorePenalty = 0;

  const legal = input.legal;
  const google = input.google;
  const reviewCount = google.reviewCount ?? input.storedReviewCount ?? null;

  if (legal.administrativeStatus === "ceased") {
    level = "CLOSED";
    scorePenalty = 100;
    signals.push(`INSEE/Pappers : ${legal.label}`);
    if (legal.closureDate) {
      signals.push(`Date de cessation : ${formatFrDate(legal.closureDate)}`);
    }
    if (legal.radiationDate) {
      signals.push(`Date de radiation : ${formatFrDate(legal.radiationDate)}`);
    }
  }

  const googleClosed =
    google.businessStatus === "CLOSED_PERMANENTLY" ||
    google.businessStatus === "CLOSED_TEMPORARILY";

  if (googleClosed && level !== "CLOSED") {
    level = "CLOSED";
    scorePenalty = Math.max(scorePenalty, 85);
    signals.push(
      google.businessStatus === "CLOSED_PERMANENTLY"
        ? "Fiche Google : établissement fermé définitivement"
        : "Fiche Google : fermeture temporaire"
    );
  }

  if (level !== "CLOSED" && google.fetched) {
    const months = google.monthsSinceLastReview;

    if (months !== null && months !== undefined) {
      if (months >= STALE_REVIEW_MONTHS) {
        level = "LIKELY_INACTIVE";
        scorePenalty = Math.max(scorePenalty, 35);
        signals.push(
          `Dernier avis Google il y a ${months} mois — activité probablement faible ou arrêtée`
        );
      } else if (months >= UNCERTAIN_REVIEW_MONTHS) {
        level = level === "ACTIVE" ? "UNCERTAIN" : level;
        scorePenalty = Math.max(scorePenalty, 18);
        signals.push(
          `Dernier avis Google il y a ${months} mois — à vérifier avant contact`
        );
      } else {
        signals.push(
          `Dernier avis Google récent (${months} mois) — signal d'activité`
        );
      }
    } else if (reviewCount === 0) {
      level = level === "ACTIVE" ? "UNCERTAIN" : level;
      scorePenalty = Math.max(scorePenalty, 12);
      signals.push("Aucun avis Google — activité locale incertaine");
    }
  }

  if (
    level !== "CLOSED" &&
    legal.openEstablishments === 0 &&
    legal.administrativeStatus === "active"
  ) {
    level = "LIKELY_INACTIVE";
    scorePenalty = Math.max(scorePenalty, 30);
    signals.push("INSEE : 0 établissement ouvert");
  }

  return {
    level,
    scorePenalty,
    signals,
    legal: legal.matched
      ? {
          status: legal.administrativeStatus,
          label: legal.label,
          closureDate: legal.closureDate,
          radiationDate: legal.radiationDate,
          sources: legal.sources,
        }
      : undefined,
    google: google.fetched
      ? {
          businessStatus: google.businessStatus,
          lastReviewDate: google.lastReviewDate,
          monthsSinceLastReview: google.monthsSinceLastReview,
          reviewCount,
        }
      : undefined,
  };
}

export function applyActivityToAudit(
  audit: AuditResult,
  assessment: ActivityAssessment | null
): AuditResult {
  if (!assessment) return audit;

  let score = audit.score;
  let technicalScore = audit.technicalScore;

  if (assessment.level === "CLOSED") {
    score = Math.min(score, 10);
    technicalScore = Math.min(technicalScore, 10);
  } else if (assessment.scorePenalty > 0) {
    score = Math.max(0, score - assessment.scorePenalty);
    technicalScore = Math.max(0, technicalScore - assessment.scorePenalty);
  }

  const issues = [...audit.issues];
  const opportunities = [...audit.opportunities];

  if (assessment.level === "CLOSED") {
    for (const signal of assessment.signals) {
      if (!issues.some((i) => i.includes(signal.slice(0, 40)))) {
        issues.push(signal);
      }
    }
    opportunities.length = 0;
    opportunities.push("Entreprise probablement inactive — ne pas prospecter");
  } else if (
    assessment.level === "LIKELY_INACTIVE" ||
    assessment.level === "UNCERTAIN"
  ) {
    const mainSignal = assessment.signals.find((s) =>
      /avis Google|INSEE|Google/i.test(s)
    );
    if (mainSignal && !issues.includes(mainSignal)) {
      issues.push(mainSignal);
    }
    opportunities.push("Vérifier l'activité réelle avant envoi d'email");
  }

  const activitySummary =
    assessment.level === "CLOSED"
      ? "Prospect écarté — activité cessée ou fermée."
      : assessment.level === "LIKELY_INACTIVE"
        ? "Pertinence réduite — signaux d'inactivité."
        : assessment.level === "UNCERTAIN"
          ? "Pertinence incertaine — confirmer l'activité."
          : null;

  const summary = activitySummary
    ? `${audit.summary} ${activitySummary}`
    : audit.summary;

  return {
    ...audit,
    score,
    technicalScore,
    issues,
    opportunities,
    summary,
    activity: assessment,
  };
}

export function activityLevelLabel(level: ActivityLevel): string {
  switch (level) {
    case "CLOSED":
      return "Inactive / cessée";
    case "LIKELY_INACTIVE":
      return "Probablement inactive";
    case "UNCERTAIN":
      return "Activité incertaine";
    default:
      return "Active";
  }
}

function formatFrDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR");
}
