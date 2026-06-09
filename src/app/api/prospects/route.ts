import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaignId");
  const status = searchParams.get("status");
  const sort = searchParams.get("sort") ?? "score";

  const prospects = await prisma.prospect.findMany({
    where: {
      ...(campaignId ? { campaignId } : {}),
      ...(status ? { status: status as never } : {}),
    },
    orderBy:
      sort === "score"
        ? [{ auditScore: "desc" }, { createdAt: "desc" }]
        : { createdAt: "desc" },
    include: {
      campaign: { select: { name: true, sector: true, city: true } },
      _count: { select: { emails: true, replies: true } },
    },
  });

  return NextResponse.json(prospects);
}
