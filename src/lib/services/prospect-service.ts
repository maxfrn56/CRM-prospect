import { prisma } from "@/lib/db";
import { auditWebsite, type AuditResult } from "@/lib/audit/website-audit";
import { generateProspectionEmail, appendSignatureToEmail } from "@/lib/llm/gemini";
import { sendEmail, appendProspectTracking } from "@/lib/email/resend";
import { searchBusinesses } from "@/lib/google-places/client";
import { enrichBusiness, findEmailForProspect } from "@/lib/enrichment";
import type { EmailType, ProspectStatus } from "@prisma/client";

const FOLLOWUP_DAYS = [4, 7, 12] as const;

export async function auditProspect(prospectId: string) {
  const prospect = await prisma.prospect.findUniqueOrThrow({
    where: { id: prospectId },
  });

  let email = prospect.email;
  let enrichmentSource = prospect.enrichmentSource;

  if (!email && prospect.website) {
    const found = await findEmailForProspect(prospect.website);
    if (found.email) {
      email = found.email;
      enrichmentSource = enrichmentSource
        ? `${enrichmentSource}+email-finder`
        : "email-finder";
    }
  }

  const audit = await auditWebsite(prospect.website);

  await prisma.prospect.update({
    where: { id: prospectId },
    data: {
      email,
      enrichmentSource,
      auditScore: audit.score,
      auditDetails: JSON.stringify(audit),
      auditedAt: new Date(),
      status: "AUDITED",
    },
  });

  return { audit, emailFound: Boolean(email && !prospect.email) };
}

export async function auditAllInCampaign(campaignId: string) {
  const prospects = await prisma.prospect.findMany({
    where: { campaignId, status: "NEW" },
  });

  const results: { id: string; score: number; emailFound?: boolean }[] = [];
  for (const p of prospects) {
    const result = await auditProspect(p.id);
    results.push({
      id: p.id,
      score: result.audit.score,
      emailFound: result.emailFound,
    });
    await sleep(500);
  }
  return results;
}

export async function generateAndSaveEmail(
  prospectId: string,
  type: EmailType = "INITIAL"
) {
  const prospect = await prisma.prospect.findUniqueOrThrow({
    where: { id: prospectId },
  });

  if (!prospect.email) {
    throw new Error("Ce prospect n'a pas d'adresse email");
  }

  const settings = await getSettings();
  const audit: AuditResult = prospect.auditDetails
    ? JSON.parse(prospect.auditDetails)
    : await auditWebsite(prospect.website);

  const generated = appendSignatureToEmail(
    await generateProspectionEmail({
      prospectName: prospect.name,
      activity: prospect.activity ?? undefined,
      city: prospect.city ?? undefined,
      audit,
      senderName: settings.senderName,
      companyName: settings.companyName,
      pitchContext: settings.pitchContext,
      pitchExample: settings.pitchExample || undefined,
      emailType: type,
      directorName: prospect.directorName ?? undefined,
    }),
    {
      senderName: settings.senderName,
      companyName: settings.companyName,
      phone: settings.phone || undefined,
      website: settings.website || undefined,
      senderEmail: settings.senderEmail || undefined,
    }
  );

  const followupDay =
    type === "INITIAL" ? 0 : parseInt(type.replace("FOLLOWUP_J", ""), 10);

  return prisma.email.create({
    data: {
      prospectId,
      type,
      subject: generated.subject,
      bodyHtml: generated.bodyHtml,
      bodyText: generated.bodyText,
      status: "DRAFT",
      followupDay,
    },
  });
}

export async function sendProspectEmail(emailId: string) {
  const email = await prisma.email.findUniqueOrThrow({
    where: { id: emailId },
    include: { prospect: true },
  });

  if (!email.prospect.email) {
    throw new Error("Email prospect manquant");
  }

  const result = await sendEmail({
    to: email.prospect.email,
    subject: email.subject,
    html: appendProspectTracking(
      email.bodyHtml,
      email.prospectId,
      email.id
    ),
    text: email.bodyText ?? undefined,
    tags: [
      { name: "prospect_id", value: email.prospectId },
      { name: "email_id", value: email.id },
    ],
  });

  await prisma.email.update({
    where: { id: emailId },
    data: {
      status: "SENT",
      sentAt: new Date(),
      resendId: result?.id,
    },
  });

  await prisma.prospect.update({
    where: { id: email.prospectId },
    data: { status: "CONTACTED" },
  });

  return result;
}

export async function processFollowups() {
  const settings = await getSettings();
  if (!settings.followupEnabled) return { processed: 0 };

  let processed = 0;
  const now = new Date();

  const contacted = await prisma.prospect.findMany({
    where: {
      status: "CONTACTED",
      email: { not: null },
    },
    include: {
      emails: {
        where: { status: "SENT" },
        orderBy: { sentAt: "asc" },
      },
      replies: true,
    },
  });

  for (const prospect of contacted) {
    if (prospect.replies.length > 0) continue;

    const initial = prospect.emails.find((e) => e.type === "INITIAL");
    if (!initial?.sentAt) continue;

    const daysSince = daysBetween(initial.sentAt, now);
    const sentTypes = new Set(prospect.emails.map((e) => e.type));

    for (const day of FOLLOWUP_DAYS) {
      const type = `FOLLOWUP_J${day}` as EmailType;
      if (daysSince >= day && !sentTypes.has(type)) {
        const draft = await generateAndSaveEmail(prospect.id, type);
        await sendProspectEmail(draft.id);
        processed++;
        break;
      }
    }
  }

  return { processed };
}

export async function importSearchResults(input: {
  campaignId: string;
  sector: string;
  city: string;
  maxPages?: number;
}) {
  const maxResults = (input.maxPages ?? 3) * 20;
  const businesses = await searchBusinesses({
    sector: input.sector,
    city: input.city,
    maxResults,
  });

  const created = [];
  for (const biz of businesses) {
    const existing = await prisma.prospect.findFirst({
      where: { googlePlaceId: biz.googlePlaceId },
    });
    if (existing) continue;

    const enriched = await enrichBusiness(biz);

    const prospect = await prisma.prospect.create({
      data: {
        campaignId: input.campaignId,
        googlePlaceId: enriched.googlePlaceId,
        name: enriched.name,
        activity: enriched.activity ?? enriched.nafLabel,
        address: enriched.address,
        city: enriched.city ?? input.city,
        postalCode: enriched.postalCode,
        phone: enriched.phone,
        email: enriched.email,
        website: enriched.website,
        rating: enriched.rating,
        reviewCount: enriched.reviewCount,
        googleMapsUrl: enriched.googleMapsUrl,
        siren: enriched.siren,
        siret: enriched.siret,
        nafCode: enriched.nafCode,
        nafLabel: enriched.nafLabel,
        legalName: enriched.legalName,
        directorName: enriched.directorName,
        employeeRange: enriched.employeeRange,
        enrichmentSource: enriched.enrichmentSource,
        status: "NEW",
      },
    });
    created.push(prospect);
    await sleep(300);
  }

  return created;
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

function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function mapReplyToStatus(
  classification: string
): ProspectStatus {
  switch (classification) {
    case "HOT":
      return "HOT";
    case "WARM":
      return "REPLIED";
    case "COLD":
      return "COLD";
    default:
      return "REPLIED";
  }
}
