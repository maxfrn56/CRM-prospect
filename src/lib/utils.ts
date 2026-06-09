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
