import { NextResponse } from "next/server";
import { processFollowups } from "@/lib/services/prospect-service";

export async function GET() {
  const preview = await processFollowups({ dryRun: true });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ?? "";
  const cronUrl = appUrl ? `${appUrl}/api/cron/followups` : null;

  return NextResponse.json({
    ...preview,
    cronConfigured: Boolean(process.env.CRON_SECRET),
    cronUrl,
    hint:
      preview.due > 0
        ? `${preview.due} relance(s) en attente — le cron doit appeler /api/cron/followups chaque jour, ou lancez-les manuellement ci-dessous.`
        : "Aucune relance due pour le moment.",
  });
}

export async function POST() {
  const result = await processFollowups({ dryRun: false });
  return NextResponse.json(result);
}
