import { NextRequest, NextResponse } from "next/server";
import { processFollowups } from "@/lib/services/prospect-service";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const result = await processFollowups();
  return NextResponse.json(result);
}

export async function GET(req: NextRequest) {
  return POST(req);
}
