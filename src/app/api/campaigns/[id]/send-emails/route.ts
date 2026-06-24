import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { bulkSendEmailsInCampaign } from "@/lib/services/prospect-service";

export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

const SKIP_STATUSES = [
  "CONTACTED",
  "REPLIED",
  "HOT",
  "CONVERTED",
  "ARCHIVED",
] as const;

async function countEligible(campaignId: string, minScore: number) {
  return prisma.prospect.count({
    where: {
      campaignId,
      auditScore: { gt: minScore },
      email: { not: null },
      NOT: { email: "" },
      status: { notIn: [...SKIP_STATUSES] },
      emails: {
        none: {
          type: "INITIAL",
          status: { in: ["SENT", "DELIVERED", "OPENED", "REPLIED"] },
        },
      },
    },
  });
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const minScore = Math.max(
    0,
    parseInt(req.nextUrl.searchParams.get("minScore") ?? "30", 10) || 30
  );
  const count = await countEligible(id, minScore);
  return NextResponse.json({ count, minScore });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;

  let minScore = 30;
  try {
    const body = (await req.json()) as { minScore?: number };
    if (typeof body.minScore === "number" && body.minScore >= 0) {
      minScore = body.minScore;
    }
  } catch {
    // corps vide OK — seuil par défaut 30
  }

  try {
    const result = await bulkSendEmailsInCampaign(id, { minScore });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
