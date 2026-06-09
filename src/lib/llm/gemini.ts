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
  const followupContext = {
    INITIAL: "Premier contact — présentez-vous brièvement et proposez de la valeur.",
    FOLLOWUP_J4: "Relance J+4 — ton léger, rappel de votre proposition sans insister.",
    FOLLOWUP_J7: "Relance J+7 — mentionnez un point concret de leur site ou absence de site.",
    FOLLOWUP_J12: "Dernière relance J+12 — court, respectueux, porte ouverte.",
  }[input.emailType];

  const exampleBlock = input.pitchExample?.trim()
    ? `
Exemple de pitch / email modèle (inspire-toi du ton, du rythme et de la structure — ne copie pas mot pour mot, personnalise pour ce prospect):
"""
${input.pitchExample.trim()}
"""`
    : "";

  const prompt = `Tu es un développeur web full stack freelance qui rédige un email de prospection B2B en français.

Contexte expéditeur:
- Nom: ${input.senderName}
- Activité: ${input.companyName}
- Pitch / services: ${input.pitchContext}
${exampleBlock}

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
- 120-180 mots max pour le corps du message (hors signature)
- Pas de superlatifs excessifs
- Proposer un échange de 15 min, pas de prix
- Personnaliser avec 1-2 éléments concrets de l'audit
- NE PAS inclure de signature (pas de cordialement, nom, téléphone, site) — elle sera ajoutée automatiquement
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
