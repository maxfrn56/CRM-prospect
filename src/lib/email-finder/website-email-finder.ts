import * as cheerio from "cheerio";
import { fetchHtmlWithBrowser } from "@/lib/browser/playwright-client";
import {
  cleanEmail,
  extractEmailsFromHtml,
  isBlockedLocal,
  isPlatformEmail,
  isValidEmail,
} from "@/lib/email-finder/email-utils";

export interface EmailFinderResult {
  email: string | null;
  candidates: string[];
  foundOn: string | null;
  confidence: number;
}

const CONTACT_PATHS = [
  "/contact",
  "/contact/",
  "/contactez-nous",
  "/contactez-nous/",
  "/nous-contacter",
  "/nous-contacter/",
  "/mentions-legales",
  "/mentions-legales/",
  "/mention-legale",
  "/legal",
  "/legal/",
  "/cgv",
  "/a-propos",
  "/about",
  "/about-us",
  "/equipe",
  "/infos-pratiques",
  "/coordonnees",
];

const PRIORITY_LOCALS = [
  "contact",
  "info",
  "commercial",
  "direction",
  "accueil",
  "secretariat",
  "hello",
  "bonjour",
  "devis",
  "rdv",
  "reservation",
];

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
};

export async function findEmailOnWebsite(
  rawUrl: string | null | undefined
): Promise<EmailFinderResult> {
  const empty: EmailFinderResult = {
    email: null,
    candidates: [],
    foundOn: null,
    confidence: 0,
  };

  if (!rawUrl?.trim()) return empty;

  const baseUrl = normalizeUrl(rawUrl);
  if (!baseUrl) return empty;

  const domain = extractDomain(baseUrl);
  const found = new Map<string, { url: string; score: number }>();

  const urlsToVisit = new Set<string>([baseUrl]);
  for (const path of CONTACT_PATHS) {
    urlsToVisit.add(joinUrl(baseUrl, path));
  }

  const homepage = await fetchHtml(baseUrl);
  if (homepage) {
    collectFromHtml(homepage, baseUrl, domain, found);
    discoverContactLinks(homepage, baseUrl).forEach((u) => urlsToVisit.add(u));
  }

  for (const url of urlsToVisit) {
    if (url === baseUrl && homepage) continue;
    const html = await fetchHtml(url);
    if (html) collectFromHtml(html, url, domain, found);
    await sleep(180);
  }

  // Fallback Playwright sur pages contact si rien trouvé
  if (found.size === 0) {
    const priorityUrls = [...urlsToVisit].filter((u) =>
      /contact|mention|legal|about|propos|coordonnee/i.test(u)
    );
    for (const url of priorityUrls.slice(0, 4)) {
      const html = await fetchHtmlWithBrowser(url);
      if (html) collectFromHtml(html, url, domain, found);
      if (found.size > 0) break;
    }
  }

  const candidates = [...found.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .map(([email, meta]) => ({ email, ...meta }));

  if (candidates.length === 0) return empty;

  const best = candidates[0];
  return {
    email: best.email,
    candidates: candidates.map((c) => c.email),
    foundOn: best.url,
    confidence: Math.min(1, best.score / 100),
  };
}

function collectFromHtml(
  html: string,
  pageUrl: string,
  siteDomain: string | null,
  found: Map<string, { url: string; score: number }>
) {
  const $ = cheerio.load(html);
  const emails = new Set<string>();

  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const addr = cleanEmail(href.replace(/^mailto:/i, "").split("?")[0]);
    if (addr) emails.add(addr);
  });

  for (const e of extractEmailsFromHtml(html)) emails.add(e);

  const pageBonus = pageScore(pageUrl);

  for (const raw of emails) {
    const email = cleanEmail(raw);
    if (!email || !isValidEmail(email)) continue;
    if (isPlatformEmail(email) || isBlockedLocal(email)) continue;

    const score = scoreEmail(email, siteDomain, pageBonus);
    if (score <= 0) continue;

    const existing = found.get(email);
    if (!existing || score > existing.score) {
      found.set(email, { url: pageUrl, score });
    }
  }
}

function discoverContactLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const links: string[] = [];
  const keywords =
    /contact|mention|legal|nous-contacter|contactez|about|apropos|coordonnee/i;

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const text = $(el).text();
    if (!keywords.test(href) && !keywords.test(text)) return;

    try {
      const absolute = new URL(href, baseUrl).toString();
      if (absolute.startsWith("http")) links.push(absolute.split("#")[0]);
    } catch {
      // ignore
    }
  });

  return [...new Set(links)].slice(0, 10);
}

function scoreEmail(
  email: string,
  siteDomain: string | null,
  pageBonus: number
): number {
  const [local, domain] = email.split("@");
  if (!local || !domain) return 0;
  if (/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(email)) return 0;

  let score = 30 + pageBonus;

  if (siteDomain && domain.endsWith(siteDomain)) score += 35;
  else if (siteDomain && domain.includes(siteDomain.replace(/^www\./, "")))
    score += 20;

  const localBase = local.split("+")[0];
  const priorityIdx = PRIORITY_LOCALS.indexOf(localBase);
  if (priorityIdx >= 0) score += 30 - priorityIdx * 2;

  if (/^[a-z]+\.[a-z]+$/.test(localBase)) score += 10;

  return score;
}

function pageScore(url: string): number {
  const lower = url.toLowerCase();
  if (lower.includes("mention")) return 25;
  if (lower.includes("contact")) return 20;
  if (lower.includes("legal")) return 15;
  if (lower.includes("about") || lower.includes("propos")) return 10;
  return 0;
}

function normalizeUrl(raw: string): string | null {
  let url = raw.trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function joinUrl(base: string, path: string): string {
  try {
    return new URL(path, base).toString().split("#")[0];
  } catch {
    return base;
  }
}

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);

    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: FETCH_HEADERS,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("text/plain") &&
      contentType !== ""
    ) {
      return null;
    }

    const html = await res.text();
    return html.length > 600_000 ? html.slice(0, 600_000) : html;
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
