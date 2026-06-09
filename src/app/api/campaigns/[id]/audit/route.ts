import { NextRequest, NextResponse } from "next/server";
import { auditAllInCampaign } from "@/lib/services/prospect-service";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const results = await auditAllInCampaign(id);
    return NextResponse.json({ audited: results.length, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
