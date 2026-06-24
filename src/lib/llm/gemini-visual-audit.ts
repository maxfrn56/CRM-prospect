import { GoogleGenAI } from "@google/genai";
import type { WebsiteScreenshots } from "@/lib/audit/screenshot-capture";
import { screenshotToDataUrl } from "@/lib/audit/screenshot-capture";

export type VisualDesignRating =
  | "excellent"
  | "good"
  | "average"
  | "dated"
  | "poor"
  | "unknown";

export interface VisualAuditResult {
  analyzed: boolean;
  skippedReason?: string;
  designQuality: number;
  needsWorkScore: number;
  rating: VisualDesignRating;
  summary: string;
  issues: string[];
  opportunities: string[];
  screenshotDesktop?: string;
  screenshotMobile?: string;
  capturedAt?: string;
}

const RATING_LABELS: Record<VisualDesignRating, string> = {
  excellent: "Design excellent",
  good: "Design correct",
  average: "Design moyen",
  dated: "Design daté",
  poor: "Design faible",
  unknown: "Non analysé",
};

export function visualRatingLabel(rating: VisualDesignRating): string {
  return RATING_LABELS[rating] ?? rating;
}

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY manquant");
  return new GoogleGenAI({ apiKey });
}

function model() {
  return process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
}

function parseJsonResponse<T>(text: string): T {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(raw) as T;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeRating(raw: string): VisualDesignRating {
  const v = raw.toLowerCase().trim();
  if (v === "excellent" || v === "good" || v === "average" || v === "dated" || v === "poor") {
    return v;
  }
  return "unknown";
}

export async function analyzeWebsiteVisual(input: {
  screenshots: WebsiteScreenshots;
  businessName?: string;
  websiteUrl?: string;
  activity?: string;
}): Promise<VisualAuditResult> {
  const ai = getClient();

  const prompt = `Tu es un expert UX/UI et développeur web freelance en France. Analyse ces captures d'écran (desktop + mobile) du site d'une entreprise.

Entreprise: ${input.businessName ?? "non précisée"}
Secteur: ${input.activity ?? "non précisé"}
URL: ${input.websiteUrl ?? "non précisée"}

Objectif commercial: identifier si cette entreprise a VRAIMENT besoin d'un nouveau site ou d'une refonte (prospect pertinent pour un freelance web).

Évalue visuellement:
- Modernité et esthétique (typographie, couleurs, espacements, images)
- Professionnalisme perçu pour une entreprise locale/B2B
- Lisibilité, hiérarchie visuelle, clarté du message
- Cohérence mobile vs desktop
- Signes de site amateur, template générique mal personnalisé, ou design des années 2000-2015

Réponds en JSON strict:
{
  "designQuality": 1-10,
  "needsWorkScore": 0-100,
  "rating": "excellent|good|average|dated|poor",
  "summary": "2 phrases max en français",
  "issues": ["problème visuel concret 1", "..."],
  "opportunities": ["opportunité commerciale pour un dev web 1", "..."]
}

Règles pour needsWorkScore (0 = site parfait, 100 = refonte urgente):
- excellent design récent → 5-20
- bon site propre → 20-35
- site moyen améliorable → 45-65
- design daté → 70-85
- site amateur / très mauvais → 85-100
- needsWorkScore doit être cohérent avec designQuality (inversement corrélé)`;

  try {
    const response = await ai.models.generateContent({
      model: model(),
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: input.screenshots.desktop.mimeType,
                data: input.screenshots.desktop.base64,
              },
            },
            {
              inlineData: {
                mimeType: input.screenshots.mobile.mimeType,
                data: input.screenshots.mobile.base64,
              },
            },
            { text: prompt },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        temperature: 0.25,
      },
    });

    const text = response.text;
    if (!text) throw new Error("Réponse Gemini vide");

    const parsed = parseJsonResponse<{
      designQuality?: number;
      needsWorkScore?: number;
      rating?: string;
      summary?: string;
      issues?: string[];
      opportunities?: string[];
    }>(text);

    const designQuality = clamp(Math.round(parsed.designQuality ?? 5), 1, 10);
    let needsWorkScore = clamp(Math.round(parsed.needsWorkScore ?? 50), 0, 100);
    const rating = normalizeRating(parsed.rating ?? "unknown");

    if (parsed.needsWorkScore === undefined) {
      needsWorkScore = clamp(Math.round(100 - designQuality * 9), 0, 100);
    }

    return {
      analyzed: true,
      designQuality,
      needsWorkScore,
      rating,
      summary: parsed.summary?.trim() || visualRatingLabel(rating),
      issues: (parsed.issues ?? []).slice(0, 6),
      opportunities: (parsed.opportunities ?? []).slice(0, 4),
      screenshotDesktop: screenshotToDataUrl(input.screenshots.desktop),
      screenshotMobile: screenshotToDataUrl(input.screenshots.mobile),
      capturedAt: input.screenshots.capturedAt,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur Gemini vision";
    return {
      analyzed: false,
      skippedReason: message,
      designQuality: 0,
      needsWorkScore: 0,
      rating: "unknown",
      summary: "Analyse visuelle indisponible",
      issues: [],
      opportunities: [],
    };
  }
}
