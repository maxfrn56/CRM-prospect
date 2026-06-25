import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { importSearchResults } from "@/lib/services/prospect-service";
import { z } from "zod";

export const maxDuration = 120;

const schema = z
  .object({
    name: z.string().min(1),
    sector: z.string().min(1),
    city: z.string().min(1),
    maxPages: z.number().min(1).max(5).optional(),
    campaignType: z.enum(["WEB_AGENCY", "SALES_TOOL"]).optional(),
    commercialSegment: z
      .enum(["INDEPENDENT", "SDR_STARTUP", "SALES_CABINET"])
      .optional(),
    niche: z.string().optional(),
  })
  .refine(
    (data) =>
      data.campaignType !== "SALES_TOOL" || Boolean(data.commercialSegment),
    {
      message: "commercialSegment requis pour une campagne commerciale",
      path: ["commercialSegment"],
    }
  );

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type");
  const campaigns = await prisma.searchCampaign.findMany({
    where: type ? { campaignType: type as "WEB_AGENCY" | "SALES_TOOL" } : undefined,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { prospects: true } } },
  });
  return NextResponse.json(campaigns);
}

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const campaignType = body.campaignType ?? "WEB_AGENCY";

    const campaign = await prisma.searchCampaign.create({
      data: {
        name: body.name,
        sector: body.sector,
        city: body.city,
        campaignType,
        commercialSegment:
          campaignType === "SALES_TOOL" ? body.commercialSegment : null,
        niche:
          campaignType === "SALES_TOOL"
            ? body.niche ?? body.sector
            : null,
      },
    });

    after(async () => {
      try {
        await importSearchResults({
          campaignId: campaign.id,
          sector: body.sector,
          city: body.city,
          maxPages: body.maxPages,
          campaignType,
          commercialSegment: body.commercialSegment,
          niche: body.niche ?? body.sector,
        });
      } catch (err) {
        console.error(`Import campagne ${campaign.id} échoué:`, err);
      }
    });

    return NextResponse.json({
      campaign,
      importing: true,
      message:
        "Import lancé en arrière-plan. Les prospects apparaîtront dans quelques instants.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
