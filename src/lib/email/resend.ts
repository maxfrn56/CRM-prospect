import { Resend } from "resend";
import { Webhook } from "svix";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY manquant");
  return new Resend(key);
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
  headers?: Record<string, string>;
}

export async function sendEmail(input: SendEmailInput) {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) throw new Error("RESEND_FROM_EMAIL manquant");

  const replyTo =
    input.replyTo ??
    process.env.RESEND_REPLY_TO ??
    process.env.RESEND_FROM_EMAIL;

  const resend = getResend();
  const { data, error } = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo,
    tags: input.tags,
    headers: input.headers,
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function fetchReceivedEmail(emailId: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY manquant");

  const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
    headers: { Authorization: `Bearer ${key}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend receiving API: ${text}`);
  }

  return res.json() as Promise<{
    id: string;
    from: string;
    to: string[];
    subject: string;
    text: string | null;
    html: string | null;
    created_at: string;
  }>;
}

export function verifyWebhookPayload(
  payload: string,
  headers: Headers
): Record<string, unknown> {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "development") {
      return JSON.parse(payload) as Record<string, unknown>;
    }
    throw new Error("RESEND_WEBHOOK_SECRET manquant");
  }

  const wh = new Webhook(secret);
  return wh.verify(payload, {
    "svix-id": headers.get("svix-id") ?? "",
    "svix-timestamp": headers.get("svix-timestamp") ?? "",
    "svix-signature": headers.get("svix-signature") ?? "",
  }) as Record<string, unknown>;
}

export function extractEmailAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  const email = (match?.[1] ?? raw).trim().toLowerCase();
  return email;
}

export function appendProspectTracking(
  html: string,
  prospectId: string,
  emailId: string
): string {
  const marker = `<div style="display:none;font-size:0;line-height:0;max-height:0;overflow:hidden" data-prospect-id="${prospectId}" data-email-id="${emailId}"></div>`;
  if (html.includes("</body>")) {
    return html.replace("</body>", `${marker}</body>`);
  }
  return `${html}${marker}`;
}
