import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { ProspectStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") ?? "all";

  let statusFilter: ProspectStatus | { in: ProspectStatus[] } | undefined;

  switch (filter) {
    case "CONTACTED":
    case "HOT":
    case "COLD":
      statusFilter = filter;
      break;
    case "replied":
      statusFilter = { in: ["REPLIED", "HOT", "COLD"] };
      break;
    default:
      statusFilter = undefined;
  }

  const prospects = await prisma.prospect.findMany({
    where: {
      OR: [
        { emails: { some: { status: { in: ["SENT", "REPLIED"] } } } },
        { contactedAt: { not: null } },
        { status: { in: ["CONTACTED", "REPLIED", "HOT", "COLD", "CONVERTED"] } },
      ],
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      campaign: { select: { name: true } },
      emails: {
        where: { status: { in: ["SENT", "REPLIED", "DRAFT"] } },
        orderBy: { sentAt: "asc" },
        select: {
          id: true,
          type: true,
          status: true,
          subject: true,
          sentAt: true,
          followupDay: true,
        },
      },
      replies: {
        orderBy: { receivedAt: "desc" },
        take: 1,
        select: {
          id: true,
          classification: true,
          aiSummary: true,
          receivedAt: true,
        },
      },
    },
  });

  const stats = {
    total: prospects.length,
    contacted: prospects.filter((p) => p.status === "CONTACTED").length,
    replied: prospects.filter((p) =>
      ["REPLIED", "HOT"].includes(p.status)
    ).length,
    hot: prospects.filter((p) => p.status === "HOT").length,
    cold: prospects.filter((p) => p.status === "COLD").length,
  };

  return NextResponse.json({ prospects, stats });
}
