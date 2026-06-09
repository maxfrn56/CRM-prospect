import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const ALLOWED_FIELDS = [
  "senderName",
  "senderEmail",
  "companyName",
  "pitchContext",
  "pitchExample",
  "website",
  "phone",
  "followupEnabled",
] as const;

export async function GET() {
  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
  });
  return NextResponse.json(settings ?? {});
}

export async function PUT(req: Request) {
  const body = (await req.json()) as Record<string, unknown>;

  const data: Record<string, unknown> = {};
  for (const key of ALLOWED_FIELDS) {
    if (key in body) data[key] = body[key];
  }

  const settings = await prisma.appSettings.upsert({
    where: { id: "default" },
    create: { id: "default", ...data },
    update: data,
  });
  return NextResponse.json(settings);
}
