import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { importSearchResults } from "@/lib/services/prospect-service";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  sector: z.string().min(1),
  city: z.string().min(1),
  maxPages: z.number().min(1).max(10).optional(),
});

export async function GET() {
  const campaigns = await prisma.searchCampaign.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { prospects: true } } },
  });
  return NextResponse.json(campaigns);
}

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());

    const campaign = await prisma.searchCampaign.create({
      data: {
        name: body.name,
        sector: body.sector,
        city: body.city,
      },
    });

    const prospects = await importSearchResults({
      campaignId: campaign.id,
      sector: body.sector,
      city: body.city,
      maxPages: body.maxPages,
    });

    return NextResponse.json({
      campaign,
      imported: prospects.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
