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

async function generateJson<T>(prompt: string): Promise<T> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: model(),
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      temperature: 0.5,
    },
  });

  const text = response.text;
  if (!text) throw new Error("Réponse Gemini vide");
  return JSON.parse(text) as T;
}

export interface GeneratedEmail {
  subject: string;
  bodyHtml: string;
  bodyText: string;
}

export async function generateProspectionEmail(input: {
  prospectName: string;
  activity?: string;
  city?: string;
  audit: AuditResult;
  senderName: string;
  companyName: string;
  pitchContext: string;
  emailType: "INITIAL" | "FOLLOWUP_J4" | "FOLLOWUP_J7" | "FOLLOWUP_J12";
  directorName?: string;
}): Promise<GeneratedEmail> {
  const followupContext = {
    INITIAL: "Premier contact — présentez-vous brièvement et proposez de la valeur.",
    FOLLOWUP_J4: "Relance J+4 — ton léger, rappel de votre proposition sans insister.",
    FOLLOWUP_J7: "Relance J+7 — mentionnez un point concret de leur site ou absence de site.",
    FOLLOWUP_J12: "Dernière relance J+12 — court, respectueux, porte ouverte.",
  }[input.emailType];

  const prompt = `Tu es un développeur web full stack freelance qui rédige un email de prospection B2B en français.

Contexte expéditeur:
- Nom: ${input.senderName}
- Activité: ${input.companyName}
- Pitch: ${input.pitchContext}

Prospect:
- Entreprise: ${input.prospectName}
- Secteur: ${input.activity ?? "non précisé"}
- Ville: ${input.city ?? "non précisée"}
- Dirigeant: ${input.directorName ?? "non connu"}

Audit site web (score ${input.audit.score}/100):
- Site: ${input.audit.hasWebsite ? input.audit.websiteUrl : "Aucun"}
- Problèmes: ${input.audit.issues.join("; ") || "aucun majeur"}
- Opportunités: ${input.audit.opportunities.join("; ")}

Type d'email: ${input.emailType}
Consigne: ${followupContext}

Règles:
- Ton professionnel, humain, pas robotique
- 120-180 mots max
- Pas de superlatifs excessifs
- Proposer un échange de 15 min, pas de prix
- Personnaliser avec 1-2 éléments concrets de l'audit
- Répondre en JSON strict: {"subject":"...", "bodyText":"...", "bodyHtml":"<p>...</p>"}`;

  return generateJson<GeneratedEmail>(prompt);
}

export async function classifyReply(input: {
  replyBody: string;
  originalSubject?: string;
  prospectName: string;
}): Promise<{
  classification: ReplyClassification;
  summary: string;
  confidence: number;
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

Réponds en JSON: {"classification":"HOT|WARM|COLD|OUT_OF_OFFICE|BOUNCE|UNKNOWN","summary":"1 phrase","confidence":0.0-1.0}`;

  try {
    return await generateJson<{
      classification: ReplyClassification;
      summary: string;
      confidence: number;
    }>(prompt);
  } catch {
    return {
      classification: "UNKNOWN",
      summary: "Classification impossible",
      confidence: 0,
    };
  }
}
