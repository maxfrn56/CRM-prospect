import { NextRequest, NextResponse } from "next/server";
import {
  auditProspect,
  generateAndSaveEmail,
  sendProspectEmail,
} from "@/lib/services/prospect-service";
import { findEmailForProspect } from "@/lib/enrichment";
import { prisma } from "@/lib/db";
import type { ContactChannel, ProspectStatus } from "@prisma/client";

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

  return NextResponse.json(prospect);
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
        });
        if (!prospect.website) {
          return NextResponse.json(
            { error: "Aucun site web pour ce prospect" },
            { status: 400 }
          );
        }
        const found = await findEmailForProspect(prospect.website);
        if (found.email) {
          await prisma.prospect.update({
            where: { id },
            data: {
              email: found.email,
              enrichmentSource: prospect.enrichmentSource
                ? `${prospect.enrichmentSource}+email-finder`
                : "email-finder",
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
        let emailId = body.emailId;
        if (!emailId) {
          const draft = await generateAndSaveEmail(id, "INITIAL");
          emailId = draft.id;
        }
        const result = await sendProspectEmail(emailId);
        return NextResponse.json({ result });
      }
      default:
        return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur";
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
      ...(becameContacted && !current.contactedAt
        ? { contactedAt: new Date() }
        : {}),
    },
  });

  return NextResponse.json(prospect);
}
