import * as cheerio from "cheerio";

export interface AuditResult {
  score: number;
  hasWebsite: boolean;
  websiteUrl: string | null;
  https: boolean;
  responsive: boolean;
  loadTimeMs: number | null;
  outdatedDesign: boolean;
  missingMetaDescription: boolean;
  instagramUrl: string | null;
  issues: string[];
  opportunities: string[];
  summary: string;
}

const OUTDATED_PATTERNS = [
  /table[^>]*layout/i,
  /font[^>]*face/i,
  /marquee/i,
  /blink/i,
  /frameset/i,
  /jquery-1\.[0-9]/i,
  /bootstrap-3/i,
  /copyright\s*(19[89]\d|200[0-9]|201[0-5])/i,
  /©\s*(19[89]\d|200[0-9]|201[0-5])/i,
];

const INSTAGRAM_SKIP = new Set([
  "p",
  "reel",
  "reels",
  "stories",
  "tv",
  "explore",
  "accounts",
  "about",
  "legal",
  "developer",
  "help",
  "direct",
  "nametag",
  "directory",
  "privacy",
  "terms",
]);

const EXTRA_INSTAGRAM_PATHS = [
  "/contact",
  "/contact/",
  "/nous-contacter",
  "/mentions-legales",
  "/a-propos",
  "/about",
];

export async function auditWebsite(
  rawUrl: string | null | undefined
): Promise<AuditResult> {
  const issues: string[] = [];
  const opportunities: string[] = [];

  if (!rawUrl || rawUrl.trim() === "") {
    return {
      score: 95,
      hasWebsite: false,
      websiteUrl: null,
      https: false,
      responsive: false,
      loadTimeMs: null,
      outdatedDesign: false,
      missingMetaDescription: true,
      instagramUrl: null,
      issues: ["Aucun site web référencé"],
      opportunities: [
        "Création de site vitrine professionnel",
        "Présence en ligne inexistante — forte opportunité commerciale",
      ],
      summary: "Pas de site web — prospect très pertinent pour une création de site.",
    };
  }

  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  let finalUrl = url;
  let html = "";
  let loadTimeMs: number | null = null;
  let https = url.startsWith("https://");

  try {
    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ProspectCRM/1.0; +https://localhost)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timeout);

    loadTimeMs = Date.now() - start;
    finalUrl = res.url;
    https = finalUrl.startsWith("https://");
    html = await res.text();

    if (!res.ok) {
      issues.push(`Site inaccessible (HTTP ${res.status})`);
      opportunities.push("Site en panne ou mal configuré — refonte recommandée");
    }
  } catch {
    issues.push("Site inaccessible ou timeout");
    opportunities.push("Site potentiellement down — opportunité de refonte");
    const instagramUrl = await findInstagramOnSite(url);
    return buildResult({
      score: 80,
      hasWebsite: true,
      websiteUrl: url,
      https,
      responsive: false,
      loadTimeMs,
      outdatedDesign: false,
      missingMetaDescription: true,
      instagramUrl,
      issues,
      opportunities,
    });
  }

  const instagramUrl = await findInstagramOnSite(url, html);

  const $ = cheerio.load(html);
  const viewport = $('meta[name="viewport"]').attr("content");
  const responsive = Boolean(viewport && viewport.includes("width"));
  const metaDesc = $('meta[name="description"]').attr("content");
  const missingMetaDescription = !metaDesc || metaDesc.length < 20;

  const bodyText = $("body").text().toLowerCase();
  const htmlSource = html.toLowerCase();
  const outdatedDesign = OUTDATED_PATTERNS.some(
    (p) => p.test(htmlSource) || p.test(bodyText)
  );

  if (!https) {
    issues.push("Pas de certificat HTTPS");
    opportunities.push("Migration HTTPS + sécurisation");
  }

  if (!responsive) {
    issues.push("Site non responsive (pas de viewport mobile)");
    opportunities.push("Refonte responsive mobile-first");
  }

  if (loadTimeMs !== null && loadTimeMs > 3000) {
    issues.push(`Temps de chargement lent (${(loadTimeMs / 1000).toFixed(1)}s)`);
    opportunities.push("Optimisation des performances");
  }

  if (outdatedDesign) {
    issues.push("Design daté détecté");
    opportunities.push("Modernisation du design et de l'UX");
  }

  if (missingMetaDescription) {
    issues.push("Meta description absente ou trop courte");
    opportunities.push("Optimisation SEO de base");
  }

  const title = $("title").text().trim();
  if (!title || title.length < 10) {
    issues.push("Balise title absente ou trop courte");
  }

  const inlineStyles = $("[style]").length;
  if (inlineStyles > 30) {
    issues.push("Nombreuses styles inline — code legacy probable");
  }

  let score = 0;
  if (!https) score += 25;
  if (!responsive) score += 25;
  if (outdatedDesign) score += 20;
  if (missingMetaDescription) score += 10;
  if (loadTimeMs !== null && loadTimeMs > 3000) score += 10;
  if (issues.some((i) => i.includes("inaccessible"))) score += 15;
  score = Math.min(100, score);

  if (issues.length === 0) {
    opportunities.push("Site correct — proposer audit approfondi ou maintenance");
  }

  const summary =
    score >= 70
      ? `Fort potentiel (${score}/100) : ${issues.slice(0, 2).join(", ") || "plusieurs axes d'amélioration"}.`
      : score >= 40
        ? `Potentiel modéré (${score}/100) : quelques optimisations possibles.`
        : `Faible priorité (${score}/100) : site déjà en bon état.`;

  return buildResult({
    score,
    hasWebsite: true,
    websiteUrl: finalUrl,
    https,
    responsive,
    loadTimeMs,
    outdatedDesign,
    missingMetaDescription,
    instagramUrl,
    issues,
    opportunities,
    summary,
  });
}

function normalizeInstagramUrl(href: string): string | null {
  try {
    const url = new URL(href, "https://www.instagram.com");
    const host = url.hostname.replace(/^www\./, "");
    if (host !== "instagram.com" && host !== "instagr.am") return null;

    const username = url.pathname.split("/").filter(Boolean)[0];
    if (!username || INSTAGRAM_SKIP.has(username.toLowerCase())) return null;
    if (!/^[a-zA-Z0-9._]+$/.test(username)) return null;

    return `https://www.instagram.com/${username}/`;
  } catch {
    return null;
  }
}

export function extractInstagramFromHtml(html: string): string | null {
  const $ = cheerio.load(html);
  const found = new Set<string>();

  $('a[href*="instagram.com"], a[href*="instagr.am"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      const normalized = normalizeInstagramUrl(href);
      if (normalized) found.add(normalized);
    }
  });

  const regex =
    /https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9._]+)/gi;
  for (const match of html.matchAll(regex)) {
    const normalized = normalizeInstagramUrl(match[0]);
    if (normalized) found.add(normalized);
  }

  return found.values().next().value ?? null;
}

async function findInstagramOnSite(
  rawUrl: string,
  homepageHtml?: string
): Promise<string | null> {
  let baseUrl = rawUrl.trim();
  if (!/^https?:\/\//i.test(baseUrl)) baseUrl = `https://${baseUrl}`;

  try {
    baseUrl = new URL(baseUrl).origin;
  } catch {
    return null;
  }

  if (homepageHtml) {
    const fromHome = extractInstagramFromHtml(homepageHtml);
    if (fromHome) return fromHome;
  }

  const urls = new Set<string>();
  if (!homepageHtml) urls.add(baseUrl);
  for (const path of EXTRA_INSTAGRAM_PATHS) {
    urls.add(new URL(path, baseUrl).toString().split("#")[0]);
  }

  for (const pageUrl of urls) {
    const html = homepageHtml && pageUrl === baseUrl ? homepageHtml : await fetchPageHtml(pageUrl);
    if (!html) continue;
    const instagram = extractInstagramFromHtml(html);
    if (instagram) return instagram;
  }

  return null;
}

async function fetchPageHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ProspectCRM/1.0; +https://localhost)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const html = await res.text();
    return html.length > 500_000 ? html.slice(0, 500_000) : html;
  } catch {
    return null;
  }
}

function buildResult(partial: Omit<AuditResult, "summary"> & { summary?: string }): AuditResult {
  return {
    ...partial,
    summary:
      partial.summary ??
      `Score ${partial.score}/100 — ${partial.issues.length} problème(s) détecté(s).`,
  };
}
