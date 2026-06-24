import { NextRequest, NextResponse } from "next/server";
import {
  auditProspect,
  generateAndSaveEmail,
  sendProspectEmail,
} from "@/lib/services/prospect-service";
import { findEmailForProspect } from "@/lib/enrichment";
import { prisma } from "@/lib/db";
import type { ContactChannel, ProspectStatus, ReplyClassification } from "@prisma/client";
import {
  getLatestMockupJob,
  launchMockupForProspect,
  syncMockupJob,
} from "@/lib/mockup/mockup-service";

type Params = { params: Promise<{ id: string }> };

const CONTACTED_STATUSES: ProspectStatus[] = [
  "CONTACTED",
  "REPLIED",
  "HOT",
  "COLD",
  "CONVERTED",
];

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const prospect = await prisma.prospect.findUnique({
    where: { id },
    include: {
      campaign: true,
      emails: { orderBy: { createdAt: "desc" } },
      replies: { orderBy: { receivedAt: "desc" } },
    },
  });

  if (!prospect) {
    return NextResponse.json({ error: "Prospect introuvable" }, { status: 404 });
  }

  const latestMockupJob = await getLatestMockupJob(id);

  return NextResponse.json({ ...prospect, latestMockupJob });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = (await req.json()) as { action: string; emailId?: string };
  const { action } = body;

  try {
    switch (action) {
      case "audit": {
        const result = await auditProspect(id);
        return NextResponse.json(result);
      }
      case "find-email": {
        const prospect = await prisma.prospect.findUniqueOrThrow({
          where: { id },
          include: { campaign: true },
        });
        const found = await findEmailForProspect(prospect.website, {
          name: prospect.name,
          city: prospect.city ?? prospect.campaign?.city,
          postalCode: prospect.postalCode,
          sector: prospect.campaign?.sector,
          auditDetails: prospect.auditDetails,
        });
        if (found.email) {
          const source = found.foundOn?.includes("barreau")
            ? "barreau"
            : found.foundOn?.includes("facebook")
              ? "facebook"
              : "email-finder";
          await prisma.prospect.update({
            where: { id },
            data: {
              email: found.email,
              enrichmentSource: prospect.enrichmentSource
                ? `${prospect.enrichmentSource}+${source}`
                : source,
            },
          });
        }
        return NextResponse.json(found);
      }
      case "find-facebook": {
        const prospect = await prisma.prospect.findUniqueOrThrow({
          where: { id },
        });
        let facebookUrl: string | null = null;
        if (prospect.auditDetails) {
          try {
            facebookUrl =
              (JSON.parse(prospect.auditDetails) as { facebookUrl?: string })
                .facebookUrl ?? null;
          } catch {
            facebookUrl = null;
          }
        }
        if (!facebookUrl) {
          return NextResponse.json(
            {
              error:
                "Aucune page Facebook détectée — lancez d'abord un audit du site.",
            },
            { status: 400 }
          );
        }
        const { findEmailOnFacebook } = await import(
          "@/lib/enrichment/facebook-email-finder"
        );
        const found = await findEmailOnFacebook(facebookUrl);
        if (found.email) {
          await prisma.prospect.update({
            where: { id },
            data: {
              email: found.email,
              enrichmentSource: prospect.enrichmentSource
                ? `${prospect.enrichmentSource}+facebook`
                : "facebook",
            },
          });
        }
        return NextResponse.json(found);
      }
      case "generate-email": {
        const email = await generateAndSaveEmail(id, "INITIAL");
        return NextResponse.json({ email });
      }
      case "send-email": {
        const prospect = await prisma.prospect.findUnique({ where: { id } });
        if (!prospect?.email) {
          return NextResponse.json(
            {
              error:
                "Aucun email enregistré pour ce prospect — saisissez-le dans Coordonnées puis cliquez Enregistrer.",
            },
            { status: 400 }
          );
        }

        const alreadySent = await prisma.email.findFirst({
          where: {
            prospectId: id,
            type: "INITIAL",
            status: { in: ["SENT", "DELIVERED", "OPENED", "REPLIED"] },
          },
        });
        if (alreadySent && !body.emailId) {
          return NextResponse.json(
            { error: "Un email initial a déjà été envoyé à ce prospect." },
            { status: 400 }
          );
        }

        let emailId = body.emailId;
        if (!emailId) {
          const existingDraft = await prisma.email.findFirst({
            where: { prospectId: id, type: "INITIAL", status: "DRAFT" },
            orderBy: { createdAt: "desc" },
          });
          if (existingDraft) {
            emailId = existingDraft.id;
          } else {
            const draft = await generateAndSaveEmail(id, "INITIAL");
            emailId = draft.id;
          }
        }
        const result = await sendProspectEmail(emailId);
        return NextResponse.json({ result });
      }
      case "launch-mockup": {
        const job = await launchMockupForProspect(id, "MANUAL");
        if (job.status === "FAILED") {
          return NextResponse.json(
            { error: job.error ?? "Échec du lancement Cursor" },
            { status: 400 }
          );
        }
        return NextResponse.json({ job });
      }
      case "sync-mockup": {
        const latest = await prisma.mockupJob.findFirst({
          where: { prospectId: id },
          orderBy: { createdAt: "desc" },
        });
        if (!latest) {
          return NextResponse.json(
            { error: "Aucune maquette pour ce prospect" },
            { status: 404 }
          );
        }
        const job = await syncMockupJob(latest.id);
        return NextResponse.json({ job });
      }
      default:
        return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
    }
  } catch (err) {
    console.error(`POST /api/prospects/${id} action=${action}:`, err);
    const message =
      err instanceof Error ? err.message : "Erreur lors de l'opération";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const data = (await req.json()) as {
    status?: ProspectStatus;
    email?: string;
    contactChannel?: ContactChannel | null;
    contactNotes?: string | null;
  };

  const current = await prisma.prospect.findUnique({ where: { id } });
  if (!current) {
    return NextResponse.json({ error: "Prospect introuvable" }, { status: 404 });
  }

  const nextStatus = data.status ?? current.status;
  const becameContacted =
    CONTACTED_STATUSES.includes(nextStatus) &&
    !CONTACTED_STATUSES.includes(current.status);

  let emailUpdate: string | null | undefined;
  let enrichmentSourceUpdate: string | undefined;
  let replyClassUpdate: ReplyClassification | undefined;

  if (
    data.status !== undefined &&
    data.status !== current.status &&
    ["COLD", "HOT", "REPLIED"].includes(data.status)
  ) {
    replyClassUpdate =
      data.status === "COLD"
        ? "COLD"
        : data.status === "HOT"
          ? "HOT"
          : (current.replyClass ?? "WARM");
  }

  if (data.email !== undefined) {
    const trimmed = data.email?.trim().toLowerCase() || null;
    if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
      return NextResponse.json(
        { error: "Adresse email invalide" },
        { status: 400 }
      );
    }
    emailUpdate = trimmed;
    if (trimmed && trimmed !== current.email?.toLowerCase()) {
      enrichmentSourceUpdate = current.enrichmentSource?.includes("manual")
        ? current.enrichmentSource
        : current.enrichmentSource
          ? `${current.enrichmentSource}+manual`
          : "manual";
    }
  }

  const prospect = await prisma.prospect.update({
    where: { id },
    data: {
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(emailUpdate !== undefined ? { email: emailUpdate } : {}),
      ...(enrichmentSourceUpdate !== undefined
        ? { enrichmentSource: enrichmentSourceUpdate }
        : {}),
      ...(data.contactChannel !== undefined
        ? { contactChannel: data.contactChannel }
        : {}),
      ...(data.contactNotes !== undefined
        ? { contactNotes: data.contactNotes }
        : {}),
      ...(replyClassUpdate !== undefined
        ? { replyClass: replyClassUpdate }
        : {}),
      ...(becameContacted && !current.contactedAt
        ? { contactedAt: new Date() }
        : {}),
    },
  });

  return NextResponse.json(prospect);
}
