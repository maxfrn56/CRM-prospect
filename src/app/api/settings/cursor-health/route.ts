import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  listCursorRepositories,
  normalizeGithubRepoUrl,
  verifyRepoAccessible,
} from "@/lib/mockup/cursor-client";

export async function GET() {
  const hasApiKey = Boolean(process.env.CURSOR_API_KEY?.trim());
  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
  });

  const repoUrl = settings?.mockupRepoUrl?.trim() ?? "";
  const repoRef = settings?.mockupRepoRef?.trim() || "main";

  const warnings: string[] = [];
  let normalizedRepoUrl: string | null = null;
  let repoAccessible: boolean | null = null;
  let accessibleRepos: string[] = [];

  if (!hasApiKey) {
    warnings.push("CURSOR_API_KEY manquant dans Railway.");
  }

  if (!repoUrl) {
    warnings.push("Repo GitHub des maquettes non renseigné dans Paramètres.");
  }

  if (repoUrl) {
    try {
      normalizedRepoUrl = normalizeGithubRepoUrl(repoUrl);
      if (normalizedRepoUrl !== repoUrl) {
        warnings.push(
          `L'URL sera normalisée en ${normalizedRepoUrl} (sans .git, format https).`
        );
      }
    } catch (err) {
      warnings.push(
        err instanceof Error ? err.message : "URL du repo GitHub invalide."
      );
    }
  }

  if (hasApiKey && normalizedRepoUrl) {
    const check = await verifyRepoAccessible(normalizedRepoUrl);
    repoAccessible = check.ok;
    if (!check.ok && check.error) {
      warnings.push(check.error);
    }
  }

  if (hasApiKey && warnings.length === 0 && repoAccessible === false) {
    try {
      accessibleRepos = (await listCursorRepositories()).slice(0, 8);
    } catch {
      // liste optionnelle
    }
  }

  const lastFailedJob = await prisma.mockupJob.findFirst({
    where: { status: "FAILED" },
    orderBy: { createdAt: "desc" },
    select: { error: true, createdAt: true },
  });

  return NextResponse.json({
    hasApiKey,
    repoUrl: normalizedRepoUrl ?? repoUrl,
    repoRef,
    mockupAutoEnabled: settings?.mockupAutoEnabled ?? false,
    repoAccessible,
    accessibleReposSample: accessibleRepos,
    lastError: lastFailedJob?.error ?? null,
    warnings,
  });
}
