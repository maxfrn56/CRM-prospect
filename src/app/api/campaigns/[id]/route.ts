import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;

  const campaign = await prisma.searchCampaign.findUnique({
    where: { id },
    include: { _count: { select: { prospects: true } } },
  });

  if (!campaign) {
    return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });
  }

  return NextResponse.json({
    id: campaign.id,
    name: campaign.name,
    sector: campaign.sector,
    city: campaign.city,
    prospectCount: campaign._count.prospects,
    createdAt: campaign.createdAt,
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;

  const campaign = await prisma.searchCampaign.findUnique({
    where: { id },
    include: { _count: { select: { prospects: true } } },
  });

  if (!campaign) {
    return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.prospect.deleteMany({ where: { campaignId: id } }),
    prisma.searchCampaign.delete({ where: { id } }),
  ]);

  return NextResponse.json({
    ok: true,
    deletedProspects: campaign._count.prospects,
  });
}
