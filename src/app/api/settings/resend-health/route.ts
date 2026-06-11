import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getResendReplyToEmail } from "@/lib/email/resend";

export async function GET() {
  let replyTo = "";
  try {
    replyTo = getResendReplyToEmail();
  } catch {
    replyTo = "";
  }

  const from = process.env.RESEND_FROM_EMAIL?.trim() ?? "";
  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
  });

  const warnings: string[] = [];

  if (!process.env.RESEND_WEBHOOK_SECRET) {
    warnings.push(
      "RESEND_WEBHOOK_SECRET manquant — le CRM ne recevra pas les réponses."
    );
  }

  if (!replyTo) {
    warnings.push("Aucune adresse de réponse Resend configurée.");
  }

  if (
    settings?.senderEmail &&
    replyTo &&
    settings.senderEmail.trim().toLowerCase() !== replyTo.toLowerCase()
  ) {
    warnings.push(
      `L'email « ${settings.senderEmail} » dans Paramètres est différent de l'adresse de réponse Resend (${replyTo}). Les anciens emails pouvaient rediriger les réponses vers Zimbra.`
    );
  }

  if (replyTo && from && replyTo.toLowerCase() === from.toLowerCase()) {
    warnings.push(
      "Reply-To = From : vérifiez que le domaine a bien la réception Resend (Inbound) activée avec enregistrement MX. Si vous utilisez Zimbra sur le même domaine, utilisez un sous-domaine ou une adresse @xxx.resend.app."
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ?? "";
  const webhookUrl = appUrl ? `${appUrl}/api/webhooks/resend` : null;

  return NextResponse.json({
    from,
    replyTo,
    inboundEmail: process.env.RESEND_INBOUND_EMAIL?.trim() ?? null,
    webhookConfigured: Boolean(process.env.RESEND_WEBHOOK_SECRET),
    webhookUrl,
    warnings,
  });
}
