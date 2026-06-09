import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchReceivedEmail } from "@/lib/email/resend";
import { classifyReply } from "@/lib/llm/gemini";
import { mapReplyToStatus } from "@/lib/services/prospect-service";

export async function POST(req: NextRequest) {
  try {
    const event = await req.json();

    if (event.type !== "email.received") {
      return NextResponse.json({ ok: true });
    }

    const emailId = event.data?.email_id as string | undefined;
    if (!emailId) {
      return NextResponse.json({ error: "email_id manquant" }, { status: 400 });
    }

    const received = await fetchReceivedEmail(emailId);
    const bodyText = received.text ?? stripHtml(received.html ?? "");

    const prospectIdTag = extractProspectFromBody(bodyText);
    let prospect = prospectIdTag
      ? await prisma.prospect.findUnique({ where: { id: prospectIdTag } })
      : null;

    if (!prospect && received.from) {
      prospect = await prisma.prospect.findFirst({
        where: { email: received.from.replace(/.*<(.+)>.*/, "$1").trim() },
      });
    }

    if (!prospect) {
      return NextResponse.json({ ok: true, matched: false });
    }

    const lastEmail = await prisma.email.findFirst({
      where: { prospectId: prospect.id, status: "SENT" },
      orderBy: { sentAt: "desc" },
    });

    const classification = await classifyReply({
      replyBody: bodyText,
      originalSubject: lastEmail?.subject,
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
      classification: classification.classification,
    });
  } catch (err) {
    console.error("Webhook Resend:", err);
    const message = err instanceof Error ? err.message : "Erreur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractProspectFromBody(_body: string) {
  return null;
}
