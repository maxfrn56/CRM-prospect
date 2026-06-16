import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatScore(score: number): string {
  return `${score}/100`;
}

export function scoreColor(score: number): string {
  if (score >= 75) return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (score >= 50) return "text-amber-700 bg-amber-50 border-amber-200";
  if (score >= 25) return "text-orange-700 bg-orange-50 border-orange-200";
  return "text-stone-600 bg-stone-50 border-stone-200";
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    NEW: "Nouveau",
    AUDITED: "Audité",
    CONTACTED: "Contacté",
    REPLIED: "Répondu",
    HOT: "Chaud",
    COLD: "Froid",
    CONVERTED: "Converti",
    ARCHIVED: "Archivé",
  };
  return labels[status] ?? status;
}

export function replyClassLabel(c: string): string {
  const labels: Record<string, string> = {
    HOT: "Prospect chaud",
    WARM: "Intérêt modéré",
    COLD: "Pas intéressé",
    OUT_OF_OFFICE: "Absence",
    BOUNCE: "Rebond",
    UNKNOWN: "Non classé",
  };
  return labels[c] ?? c;
}

export function emailTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    INITIAL: "Mail initial",
    FOLLOWUP_J4: "Relance J+4",
    FOLLOWUP_J7: "Relance J+7",
    FOLLOWUP_J12: "Relance J+12",
  };
  return labels[type] ?? type;
}

export function contactChannelLabel(channel: string): string {
  const labels: Record<string, string> = {
    EMAIL: "Email",
    INSTAGRAM: "Instagram",
    PHONE: "Téléphone",
    LINKEDIN: "LinkedIn",
    IN_PERSON: "En personne",
    OTHER: "Autre",
  };
  return labels[channel] ?? channel;
}

export const OUTREACH_STEPS = [
  "INITIAL",
  "FOLLOWUP_J4",
  "FOLLOWUP_J7",
  "FOLLOWUP_J12",
] as const;

export const PROSPECT_STATUSES = [
  "NEW",
  "AUDITED",
  "CONTACTED",
  "REPLIED",
  "HOT",
  "COLD",
  "CONVERTED",
  "ARCHIVED",
] as const;

export const CONTACT_CHANNELS = [
  "INSTAGRAM",
  "PHONE",
  "EMAIL",
  "LINKEDIN",
  "IN_PERSON",
  "OTHER",
] as const;

export function statusBadgeClass(status: string): string {
  switch (status) {
    case "HOT":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "CONTACTED":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "AUDITED":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "REPLIED":
    case "WARM":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "COLD":
      return "border-stone-200 bg-stone-100 text-stone-600";
    case "CONVERTED":
      return "border-emerald-300 bg-emerald-100 text-emerald-800";
    default:
      return "border-stone-200 bg-stone-50 text-stone-600";
  }
}

/** Teinte de fond légère pour les lignes du tableau prospects */
export function prospectRowTintClass(
  status: string,
  expanded = false
): string {
  switch (status) {
    case "AUDITED":
      return expanded
        ? "bg-violet-50/80"
        : "bg-violet-50/35 hover:bg-violet-50/55";
    case "CONTACTED":
      return expanded
        ? "bg-blue-50/80"
        : "bg-blue-50/35 hover:bg-blue-50/55";
    default:
      return expanded ? "bg-stone-50" : "hover:bg-stone-50";
  }
}
