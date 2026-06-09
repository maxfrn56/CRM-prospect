import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const [
    totalProspects,
    audited,
    contacted,
    hot,
    cold,
    campaigns,
    recentReplies,
  ] = await Promise.all([
    prisma.prospect.count(),
    prisma.prospect.count({ where: { status: "AUDITED" } }),
    prisma.prospect.count({ where: { status: "CONTACTED" } }),
    prisma.prospect.count({ where: { status: "HOT" } }),
    prisma.prospect.count({ where: { status: "COLD" } }),
    prisma.searchCampaign.count(),
    prisma.emailReply.findMany({
      take: 5,
      orderBy: { receivedAt: "desc" },
      include: { prospect: { select: { name: true } } },
    }),
  ]);

  const topProspects = await prisma.prospect.findMany({
    where: { auditScore: { gt: 0 } },
    orderBy: { auditScore: "desc" },
    take: 5,
    select: { id: true, name: true, auditScore: true, city: true, status: true },
  });

  return NextResponse.json({
    stats: { totalProspects, audited, contacted, hot, cold, campaigns },
    topProspects,
    recentReplies,
  });
}
