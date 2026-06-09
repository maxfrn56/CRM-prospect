import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
  });
  return NextResponse.json(settings ?? {});
}

export async function PUT(req: Request) {
  const body = await req.json();
  const settings = await prisma.appSettings.upsert({
    where: { id: "default" },
    create: { id: "default", ...body },
    update: body,
  });
  return NextResponse.json(settings);
}
