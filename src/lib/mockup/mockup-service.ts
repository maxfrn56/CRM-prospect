import { prisma } from "@/lib/db";
import type { Prospect, MockupJob } from "@prisma/client";
import {
  createCursorAgent,
  getCursorAgent,
  getCursorRun,
} from "./cursor-client";

type ProspectWithCampaign = Prospect & {
  campaign?: { sector: string; city: string; name: string } | null;
  replies?: { aiSummary: string | null; bodyText: string; classification: string }[];
};

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function parseAudit(auditDetails: string | null) {
  if (!auditDetails) return null;
  try {
    return JSON.parse(auditDetails) as {
      summary?: string;
      issues?: string[];
      opportunities?: string[];
      websiteUrl?: string | null;
    };
  } catch {
    return null;
  }
}

export function buildMockupPrompt(
  prospect: ProspectWithCampaign,
  settings: {
    senderName: string;
    companyName: string;
  },
  replySummary?: string | null
): string {
  const audit = parseAudit(prospect.auditDetails);
  const slug = slugify(prospect.name) || prospect.id.slice(0, 8);

  return `Tu es un designer/développeur web. Crée une maquette de site vitrine professionnelle pour un prospect commercial.

## Contexte commercial
- Entreprise : ${prospect.name}
- Activité : ${prospect.activity ?? "non précisée"}
- Ville : ${prospect.city ?? prospect.campaign?.city ?? "non précisée"}
- Site actuel : ${prospect.website ?? "aucun ou inaccessible"}
- Téléphone : ${prospect.phone ?? "—"}
- Email : ${prospect.email ?? "—"}

## Audit web existant
${audit?.summary ?? "Audit non disponible — propose une vitrine moderne adaptée au secteur."}
${audit?.issues?.length ? `\nProblèmes détectés :\n- ${audit.issues.join("\n- ")}` : ""}
${audit?.opportunities?.length ? `\nOpportunités :\n- ${audit.opportunities.join("\n- ")}` : ""}

## Réponse du prospect (intérêt confirmé)
${replySummary ?? "Le prospect est intéressé par une maquette / refonte de site."}

## Mission
1. Crée le dossier \`mockups/${slug}/\` dans le repo
2. Génère \`index.html\` (+ \`styles.css\` si besoin) — page unique responsive, mobile-first
3. Design moderne, professionnel, couleurs adaptées au secteur (${prospect.activity ?? prospect.campaign?.sector ?? "local"})
4. Sections : hero accrocheur, services/atouts, preuves sociales ou zone confiance, contact (tél + CTA)
5. Utilise Tailwind CDN ou CSS vanilla — pas de build complexe
6. Ajoute un \`README.md\` dans le dossier avec 3 lignes de contexte prospect

Prestataire : ${settings.senderName} (${settings.companyName}).
Ne touche pas aux autres dossiers du repo hors \`mockups/${slug}/\`.`;
}

async function getSettings() {
  let settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
  });
  if (!settings) {
    settings = await prisma.appSettings.create({ data: { id: "default" } });
  }
  return settings;
}

export async function launchMockupForProspect(
  prospectId: string,
  triggeredBy: "AUTO" | "MANUAL",
  replySummary?: string | null
): Promise<MockupJob> {
  const settings = await getSettings();

  if (!settings.mockupRepoUrl?.trim()) {
    throw new Error(
      "Repo GitHub maquettes non configuré — renseignez-le dans Paramètres"
    );
  }

  const existing = await prisma.mockupJob.findFirst({
    where: {
      prospectId,
      status: { in: ["PENDING", "RUNNING"] },
    },
  });
  if (existing) {
    throw new Error("Une maquette est déjà en cours pour ce prospect");
  }

  const prospect = await prisma.prospect.findUniqueOrThrow({
    where: { id: prospectId },
    include: {
      campaign: true,
      replies: { orderBy: { receivedAt: "desc" }, take: 1 },
    },
  });

  const summary =
    replySummary ??
    prospect.replies[0]?.aiSummary ??
    prospect.replies[0]?.bodyText?.slice(0, 500) ??
    null;

  const prompt = buildMockupPrompt(prospect, settings, summary);

  const job = await prisma.mockupJob.create({
    data: {
      prospectId,
      triggeredBy,
      status: "PENDING",
      prompt,
      replySummary: summary,
    },
  });

  try {
    const result = await createCursorAgent({
      prompt,
      name: `Maquette — ${prospect.name}`.slice(0, 100),
      repoUrl: settings.mockupRepoUrl.trim(),
      repoRef: settings.mockupRepoRef || "main",
      autoCreatePR: settings.mockupAutoCreatePR,
    });

    return prisma.mockupJob.update({
      where: { id: job.id },
      data: {
        status: "RUNNING",
        cursorAgentId: result.agent.id,
        cursorRunId: result.run?.id ?? result.agent.latestRunId ?? null,
        cursorAgentUrl: result.agent.url ?? null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur Cursor";
    return prisma.mockupJob.update({
      where: { id: job.id },
      data: { status: "FAILED", error: message },
    });
  }
}

export async function syncMockupJob(jobId: string): Promise<MockupJob> {
  const job = await prisma.mockupJob.findUniqueOrThrow({
    where: { id: jobId },
  });

  if (!job.cursorRunId && job.cursorAgentId) {
    try {
      const agent = await getCursorAgent(job.cursorAgentId);
      if (agent.latestRunId) {
        await prisma.mockupJob.update({
          where: { id: jobId },
          data: {
            cursorRunId: agent.latestRunId,
            cursorAgentUrl: agent.url ?? job.cursorAgentUrl,
          },
        });
      }
    } catch {
      // ignore refresh errors
    }
  }

  const refreshed = await prisma.mockupJob.findUniqueOrThrow({
    where: { id: jobId },
  });

  if (!refreshed.cursorRunId || refreshed.status === "COMPLETED") {
    return refreshed;
  }

  try {
    const run = await getCursorRun(refreshed.cursorRunId);
    const branch = run.git?.branches?.[0];

    if (run.status === "FINISHED") {
      return prisma.mockupJob.update({
        where: { id: jobId },
        data: {
          status: "COMPLETED",
          prUrl: branch?.prUrl ?? null,
          branchName: branch?.branch ?? null,
        },
      });
    }

    if (["ERROR", "CANCELLED", "EXPIRED"].includes(run.status)) {
      return prisma.mockupJob.update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          error: `Run Cursor terminé avec le statut ${run.status}`,
          branchName: branch?.branch ?? null,
          prUrl: branch?.prUrl ?? null,
        },
      });
    }

    return refreshed;
  } catch {
    return refreshed;
  }
}

export async function getLatestMockupJob(prospectId: string) {
  const job = await prisma.mockupJob.findFirst({
    where: { prospectId },
    orderBy: { createdAt: "desc" },
  });

  if (!job || job.status !== "RUNNING") return job;
  return syncMockupJob(job.id);
}

export function shouldAutoLaunchMockup(input: {
  classification: string;
  mockupAutoEnabled: boolean;
  mockupRepoUrl: string;
}): boolean {
  return (
    input.classification === "HOT" &&
    input.mockupAutoEnabled &&
    Boolean(input.mockupRepoUrl?.trim()) &&
    Boolean(process.env.CURSOR_API_KEY)
  );
}
