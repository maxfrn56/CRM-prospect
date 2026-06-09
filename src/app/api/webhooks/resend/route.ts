import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  extractEmailAddress,
  fetchReceivedEmail,
  verifyWebhookPayload,
} from "@/lib/email/resend";
import { classifyReply } from "@/lib/llm/gemini";
import { mapReplyToStatus } from "@/lib/services/prospect-service";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "resend-webhook",
    message: "Endpoint actif. Configurez email.received sur Resend.",
  });
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.text();
    const event = verifyWebhookPayload(payload, req.headers);

    if (event.type !== "email.received") {
      return NextResponse.json({ ok: true, skipped: event.type });
    }

    const data = event.data as { email_id?: string } | undefined;
    const emailId = data?.email_id;
    if (!emailId) {
      return NextResponse.json({ error: "email_id manquant" }, { status: 400 });
    }

    const existing = await prisma.emailReply.findFirst({
      where: { resendEmailId: emailId },
    });
    if (existing) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    const received = await fetchReceivedEmail(emailId);
    const bodyText = received.text ?? stripHtml(received.html ?? "");
    const bodyHtml = received.html ?? "";

    const prospect = await findProspect({
      from: received.from,
      bodyText,
      bodyHtml,
      to: received.to,
    });

    if (!prospect) {
      console.warn("Webhook Resend: prospect non trouvé pour", received.from);
      return NextResponse.json({ ok: true, matched: false });
    }

    const lastEmail = await prisma.email.findFirst({
      where: { prospectId: prospect.id, status: { in: ["SENT", "REPLIED"] } },
      orderBy: { sentAt: "desc" },
    });

    const classification = await classifyReply({
      replyBody: bodyText,
      originalSubject: lastEmail?.subject ?? received.subject,
      prospectName: prospect.name,
    });

    await prisma.emailReply.create({
      data: {
        prospectId: prospect.id,
        emailId: lastEmail?.id,
        resendEmailId: emailId,
        fromAddress: received.from,
        subject: received.subject,
        bodyText,
        bodyHtml: received.html,
        classification: classification.classification,
        aiSummary: classification.summary,
        aiConfidence: classification.confidence,
      },
    });

    if (lastEmail) {
      await prisma.email.update({
        where: { id: lastEmail.id },
        data: { status: "REPLIED" },
      });
    }

    await prisma.prospect.update({
      where: { id: prospect.id },
      data: {
        status: mapReplyToStatus(classification.classification),
        replyClass: classification.classification,
      },
    });

    return NextResponse.json({
      ok: true,
      matched: true,
      prospectId: prospect.id,
      classification: classification.classification,
    });
  } catch (err) {
    console.error("Webhook Resend:", err);
    const message = err instanceof Error ? err.message : "Erreur";
    const status = message.includes("signature") || message.includes("Webhook")
      ? 401
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

async function findProspect(input: {
  from: string;
  bodyText: string;
  bodyHtml: string;
  to: string[];
}) {
  const fromEmail = extractEmailAddress(input.from);
  const combined = `${input.bodyHtml} ${input.bodyText}`;

  const prospectIdMatch = combined.match(/data-prospect-id="([^"]+)"/);
  if (prospectIdMatch?.[1]) {
    const byId = await prisma.prospect.findUnique({
      where: { id: prospectIdMatch[1] },
    });
    if (byId) return byId;
  }

  const emailIdMatch = combined.match(/data-email-id="([^"]+)"/);
  if (emailIdMatch?.[1]) {
    const sent = await prisma.email.findUnique({
      where: { id: emailIdMatch[1] },
      include: { prospect: true },
    });
    if (sent?.prospect) return sent.prospect;
  }

  const byEmail = await prisma.prospect.findFirst({
    where: { email: { equals: fromEmail, mode: "insensitive" } },
  });
  if (byEmail) return byEmail;

  // Dernier prospect contacté avec cet email
  const recentEmail = await prisma.email.findFirst({
    where: {
      status: { in: ["SENT", "REPLIED"] },
      prospect: { email: { equals: fromEmail, mode: "insensitive" } },
    },
    orderBy: { sentAt: "desc" },
    include: { prospect: true },
  });

  return recentEmail?.prospect ?? null;
}

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
