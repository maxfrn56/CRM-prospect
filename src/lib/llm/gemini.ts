import { GoogleGenAI } from "@google/genai";
import type { AuditResult } from "@/lib/audit/website-audit";
import type { ReplyClassification } from "@prisma/client";

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY manquant");
  return new GoogleGenAI({ apiKey });
}

function model() {
  return process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Erreur Gemini inconnue";
  }
}

function parseRetryAfterSeconds(message: string): number | null {
  const match = message.match(/retry in (\d+(?:\.\d+)?)\s*s/i);
  return match ? Math.ceil(parseFloat(match[1])) : null;
}

function formatGeminiError(err: unknown): Error {
  const raw = extractErrorMessage(err);
  const isQuota =
    /429|RESOURCE_EXHAUSTED|quota exceeded|exceeded your current quota/i.test(
      raw
    );

  if (isQuota) {
    const currentModel = model();
    return new Error(
      `Quota Gemini gratuit dépassé pour ${currentModel} (environ 20 requêtes/jour). ` +
        "Attendez la réinitialisation (minuit PT), activez la facturation sur Google AI Studio, " +
        "ou essayez GEMINI_MODEL=gemini-2.0-flash dans Railway."
    );
  }

  return new Error(raw || "Erreur Gemini");
}

async function generateJson<T>(
  prompt: string,
  options?: { temperature?: number }
): Promise<T> {
  const ai = getClient();
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: model(),
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: options?.temperature ?? 0.5,
        },
      });

      const text = response.text;
      if (!text) throw new Error("Réponse Gemini vide");
      return parseJsonResponse<T>(text);
    } catch (err) {
      lastError = err;
      const message = extractErrorMessage(err);
      const retrySec = parseRetryAfterSeconds(message);
      if (attempt === 0 && retrySec !== null && retrySec <= 90) {
        await sleep((retrySec + 1) * 1000);
        continue;
      }
      throw formatGeminiError(err);
    }
  }

  throw formatGeminiError(lastError);
}

function parseJsonResponse<T>(text: string): T {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1].trim() : trimmed;

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(
      "Réponse Gemini illisible — vérifiez GEMINI_API_KEY et GEMINI_MODEL"
    );
  }
}

export interface GeneratedEmail {
  subject: string;
  bodyHtml: string;
  bodyText: string;
}

export interface EmailSignature {
  senderName: string;
  companyName: string;
  phone?: string;
  website?: string;
  senderEmail?: string;
}

export function buildEmailSignature(sig: EmailSignature): {
  html: string;
  text: string;
} {
  const lines: string[] = ["Cordialement,", sig.senderName, sig.companyName];
  const textLines = [...lines];

  if (sig.phone?.trim()) {
    textLines.push(`Tél. ${sig.phone.trim()}`);
  }
  if (sig.website?.trim()) {
    const url = sig.website.trim().replace(/\/$/, "");
    const display = url.replace(/^https?:\/\//, "");
    textLines.push(url.startsWith("http") ? url : `https://${url}`);
  }
  if (sig.senderEmail?.trim()) {
    textLines.push(sig.senderEmail.trim());
  }

  let html = `<p style="margin-top:24px">Cordialement,<br><strong>${escapeHtml(sig.senderName)}</strong><br>${escapeHtml(sig.companyName)}`;
  if (sig.phone?.trim()) {
    html += `<br>Tél. ${escapeHtml(sig.phone.trim())}`;
  }
  if (sig.website?.trim()) {
    const raw = sig.website.trim();
    const href = raw.startsWith("http") ? raw : `https://${raw}`;
    const display = raw.replace(/^https?:\/\//, "").replace(/\/$/, "");
    html += `<br><a href="${escapeHtml(href)}">${escapeHtml(display)}</a>`;
  }
  if (sig.senderEmail?.trim()) {
    html += `<br><a href="mailto:${escapeHtml(sig.senderEmail.trim())}">${escapeHtml(sig.senderEmail.trim())}</a>`;
  }
  html += "</p>";

  return { html, text: textLines.join("\n") };
}

export function appendSignatureToEmail(
  email: GeneratedEmail,
  signature: EmailSignature
): GeneratedEmail {
  const sig = buildEmailSignature(signature);
  return {
    subject: email.subject,
    bodyHtml: `${email.bodyHtml.trim()}${sig.html}`,
    bodyText: `${email.bodyText.trim()}\n\n${sig.text}`,
  };
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function generateProspectionEmail(input: {
  prospectName: string;
  activity?: string;
  city?: string;
  audit: AuditResult;
  senderName: string;
  companyName: string;
  pitchContext: string;
  pitchExample?: string;
  emailType: "INITIAL" | "FOLLOWUP_J4" | "FOLLOWUP_J7" | "FOLLOWUP_J12";
  directorName?: string;
}): Promise<GeneratedEmail> {
  const prompt = buildProspectionPrompt(input);
  return generateJson<GeneratedEmail>(prompt, { temperature: 0.25 });
}

function buildProspectionPrompt(input: {
  prospectName: string;
  activity?: string;
  city?: string;
  audit: AuditResult;
  senderName: string;
  companyName: string;
  pitchContext: string;
  pitchExample?: string;
  emailType: "INITIAL" | "FOLLOWUP_J4" | "FOLLOWUP_J7" | "FOLLOWUP_J12";
  directorName?: string;
}): string {
  const followupContext = {
    INITIAL:
      "Premier contact — reprendre le modèle de pitch tel quel, en personnalisant uniquement le prospect.",
    FOLLOWUP_J4:
      "Relance J+4 — même ton et même offre que le pitch, message plus court (80-120 mots), rappel léger sans insister.",
    FOLLOWUP_J7:
      "Relance J+7 — même ton et même offre que le pitch, mentionner 1 point concret de l'audit (80-120 mots).",
    FOLLOWUP_J12:
      "Dernière relance J+12 — même ton que le pitch, très court (60-90 mots), respectueux, porte ouverte.",
  }[input.emailType];

  const pitchContext = input.pitchContext.trim();
  const pitchExample = input.pitchExample?.trim() ?? "";

  const pitchPriorityBlock = pitchContext
    ? `
=== PITCH / OFFRE (PRIORITÉ ABSOLUE — NE PAS DÉVIER) ===
${pitchContext}

Obligations liées au pitch :
- Reprendre les services, la promesse et le positionnement EXACTS ci-dessus
- Utiliser le même vocabulaire métier que dans le pitch (ne pas reformuler librement)
- Ne PAS inventer d'autres prestations, tarifs, garanties ou arguments absents du pitch
- Ne PAS remplacer le positionnement par un discours générique de "développeur freelance"`
    : "";

  const templateBlock = pitchExample
    ? `
=== MODÈLE D'EMAIL À RESPECTER (STRUCTURE ET TON OBLIGATOIRES) ===
"""
${pitchExample}
"""

Consignes strictes sur ce modèle :
- CONSERVER la structure : même nombre de paragraphes, même type d'accroche, même progression
- CONSERVER le ton, le registre de langue et le style de phrases du modèle
- CONSERVER la formulation du call-to-action (RDV, durée, modalité) sauf adaptation minimale au prospect
- Personnaliser UNIQUEMENT : nom/ville/activité du prospect + 1 à 2 phrases sur l'audit du site
- Les phrases d'audit doivent s'intégrer naturellement là où le modèle parle du site ou de la présence en ligne
- Ne PAS réécrire "à ta sauce" : le lecteur doit reconnaître le même email que le modèle`
    : pitchContext
      ? `
=== MODÈLE D'EMAIL ===
Aucun exemple fourni — rédige en t'appuyant STRICTEMENT sur le pitch ci-dessus (ton, offre, CTA).
Structure recommandée : accroche courte → valeur du pitch → 1 point d'audit → CTA du pitch.`
      : "";

  const wordLimit =
    input.emailType === "INITIAL" ? "100-160 mots" : "60-120 mots";

  return `Tu rédiges un email de prospection B2B en français pour ${input.senderName} (${input.companyName}).

${pitchPriorityBlock}
${templateBlock}

=== PROSPECT (personnalisation autorisée) ===
- Entreprise : ${input.prospectName}
- Secteur : ${input.activity ?? "non précisé"}
- Ville : ${input.city ?? "non précisée"}
- Dirigeant : ${input.directorName ?? "non connu"}

=== AUDIT SITE (1 à 2 éléments max à intégrer) ===
- Score pertinence : ${input.audit.score}/100
- Site : ${input.audit.hasWebsite ? input.audit.websiteUrl : "Aucun site web"}
- Analyse visuelle : ${
    input.audit.visual?.analyzed
      ? `${input.audit.visual.summary} (besoin refonte ${input.audit.visual.needsWorkScore}/100)`
      : "non disponible"
  }
- Problèmes : ${input.audit.issues.slice(0, 4).join("; ") || "aucun majeur"}
- Opportunités : ${input.audit.opportunities.slice(0, 3).join("; ") || "aucune"}

=== TYPE D'EMAIL ===
${input.emailType} — ${followupContext}

=== RÈGLES FINALES ===
- ${wordLimit} pour le corps (hors signature)
- Ton humain et professionnel, fidèle au pitch — pas de formules génériques type "expert passionné", "solution sur mesure" si absentes du pitch
- NE PAS inclure de signature (Cordialement, nom, téléphone, site) — ajoutée automatiquement après
- Répondre en JSON strict : {"subject":"...", "bodyText":"...", "bodyHtml":"<p>...</p>"}`;
}

export async function classifyReply(input: {
  replyBody: string;
  originalSubject?: string;
  prospectName: string;
}): Promise<{
  classification: ReplyClassification;
  summary: string;
  confidence: number;
  wantsMockup: boolean;
}> {
  const prompt = `Analyse cette réponse email à une prospection commerciale web.

Prospect: ${input.prospectName}
Sujet original: ${input.originalSubject ?? "N/A"}

Réponse:
"""
${input.replyBody.slice(0, 3000)}
"""

Classifie en une catégorie:
- HOT: intérêt clair, demande RDV, questions sur le projet, budget évoqué
- WARM: intérêt modéré, demande plus d'infos, pas de refus
- COLD: refus explicite, pas intéressé, désinscription
- OUT_OF_OFFICE: absence, réponse automatique
- BOUNCE: erreur de livraison, adresse invalide
- UNKNOWN: impossible à déterminer

Indique wantsMockup=true si le prospect demande (explicitement ou implicitement) une maquette, un aperçu visuel, une démo de site, une refonte, ou montre un intérêt concret pour voir à quoi ressemblerait son futur site.

Réponds en JSON: {"classification":"HOT|WARM|COLD|OUT_OF_OFFICE|BOUNCE|UNKNOWN","summary":"1 phrase","confidence":0.0-1.0,"wantsMockup":true|false}`;

  try {
    const result = await generateJson<{
      classification: ReplyClassification;
      summary: string;
      confidence: number;
      wantsMockup?: boolean;
    }>(prompt);
    return {
      ...result,
      wantsMockup: Boolean(result.wantsMockup),
    };
  } catch {
    return {
      classification: "UNKNOWN",
      summary: "Classification impossible",
      confidence: 0,
      wantsMockup: false,
    };
  }
}
