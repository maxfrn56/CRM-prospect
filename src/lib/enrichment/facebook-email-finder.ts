import * as cheerio from "cheerio";
import { fetchHtmlWithBrowser } from "@/lib/browser/playwright-client";
import {
  cleanEmail,
  extractEmailsFromHtml,
  extractEmailsFromJsonScripts,
  extractEmailsFromText,
  isBlockedLocal,
  isPlatformEmail,
  isValidEmail,
  nameMatchScore,
  normalizeBusinessName,
} from "@/lib/email-finder/email-utils";

export interface FacebookEmailResult {
  email: string | null;
  candidates: string[];
  foundOn: string | null;
  confidence: number;
  facebookUrl: string | null;
  blocked?: boolean;
  discoveredVia?: "known" | "search" | "audit";
}

const FACEBOOK_SKIP = new Set([
  "login",
  "pages",
  "groups",
  "watch",
  "share",
  "sharer",
  "profile.php",
  "people",
  "help",
  "policies",
  "privacy",
  "marketplace",
  "gaming",
  "events",
  "hashtag",
  "reels",
  "stories",
  "business",
  "ads",
  "l.php",
  "dialog",
  "plugins",
  "tr",
  "p",
  "photo.php",
  "videos",
  "notes",
  "reg",
  "recover",
  "campaign",
  "search",
  "public",
]);

const PRIORITY_LOCALS = ["contact", "info", "commercial", "direction", "accueil"];

export function normalizeFacebookUrl(href: string): string | null {
  try {
    let url = href.trim();
    if (url.startsWith("//")) url = `https:${url}`;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\.|^m\./, "");
    if (host !== "facebook.com" && host !== "fb.com") return null;

    const pathParts = parsed.pathname.split("/").filter(Boolean);
    if (pathParts.length === 0) return null;

    const first = pathParts[0].toLowerCase();
    if (FACEBOOK_SKIP.has(first)) {
      if (first === "profile.php" && parsed.searchParams.get("id")) {
        return `https://www.facebook.com/profile.php?id=${parsed.searchParams.get("id")}`;
      }
      if (first === "pages" && pathParts.length >= 2) {
        const slug = pathParts[pathParts.length - 1];
        if (slug && !FACEBOOK_SKIP.has(slug.toLowerCase())) {
          return `https://www.facebook.com/${slug}/`;
        }
      }
      if (first === "pg" && pathParts.length >= 2) {
        return `https://www.facebook.com/${pathParts[1]}/`;
      }
      return null;
    }

    const slug = pathParts[0];
    if (!/^[a-zA-Z0-9.\-_]+$/.test(slug)) return null;

    return `https://www.facebook.com/${slug}/`;
  } catch {
    return null;
  }
}

export function extractFacebookFromHtml(html: string): string | null {
  const $ = cheerio.load(html);
  const found = new Set<string>();

  $('a[href*="facebook.com"], a[href*="fb.com"], a[href*="fb.me"]').each(
    (_, el) => {
      const href = $(el).attr("href");
      if (href) {
        const normalized = normalizeFacebookUrl(href);
        if (normalized) found.add(normalized);
      }
    }
  );

  const regex =
    /https?:\/\/(?:www\.|m\.)?(?:facebook\.com|fb\.com)\/[^\s"'<>]+/gi;
  for (const match of html.matchAll(regex)) {
    const normalized = normalizeFacebookUrl(match[0]);
    if (normalized) found.add(normalized);
  }

  return found.values().next().value ?? null;
}

/** Recherche une page Facebook via DuckDuckGo (sans site web connu). */
export async function findFacebookPageBySearch(
  businessName: string,
  city?: string | null
): Promise<string | null> {
  const query = encodeURIComponent(
    `site:facebook.com ${businessName} ${city ?? ""}`.trim()
  );

  const searchUrls = [
    `https://html.duckduckgo.com/html/?q=${query}`,
    `https://lite.duckduckgo.com/lite/?q=${query}`,
  ];

  for (const searchUrl of searchUrls) {
    const html = await fetchSearchHtml(searchUrl);
    if (!html) continue;

    const candidates: { url: string; score: number }[] = [];

    const regex =
      /https?:\/\/(?:www\.|m\.)?facebook\.com\/[a-zA-Z0-9.\-_/]+/gi;
    for (const match of html.matchAll(regex)) {
      const normalized = normalizeFacebookUrl(match[0]);
      if (!normalized) continue;

      const slug = normalized.split("/").filter(Boolean).pop() ?? "";
      const slugScore = nameMatchScore(slug.replace(/\./g, " "), businessName);
      candidates.push({ url: normalized, score: slugScore });
    }

    const $ = cheerio.load(html);
    $('a[href*="facebook.com"]').each((_, el) => {
      const href = $(el).attr("href") ?? "";
      const uddgMatch = href.match(/uddg=([^&]+)/);
      if (uddgMatch) {
        try {
          const fbUrl = decodeURIComponent(uddgMatch[1]);
          const normalized = normalizeFacebookUrl(fbUrl);
          if (normalized) {
            const slug = normalized.split("/").filter(Boolean).pop() ?? "";
            candidates.push({
              url: normalized,
              score: nameMatchScore(slug.replace(/\./g, " "), businessName),
            });
          }
        } catch {
          // ignore
        }
        return;
      }
    });

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates.find((c) => c.score >= 40);
    if (best) return best.url;
    if (candidates[0]?.score >= 25) return candidates[0].url;
  }

  return null;
}

async function fetchSearchHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html",
        "Accept-Language": "fr-FR,fr;q=0.9",
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function buildFacebookPageUrls(facebookUrl: string): string[] {
  const slug = facebookUrl.replace(/\/$/, "").split("/").pop() ?? "";
  const isProfile = facebookUrl.includes("profile.php");

  if (isProfile) {
    return [
      facebookUrl,
      facebookUrl.replace("www.facebook.com", "m.facebook.com"),
    ];
  }

  return [
    `https://www.facebook.com/pg/${slug}/about/`,
    `https://m.facebook.com/${slug}/about/`,
    `https://www.facebook.com/${slug}/about/`,
    `https://m.facebook.com/${slug}/`,
    `https://www.facebook.com/${slug}/?sk=about`,
    `https://m.facebook.com/${slug}/?sk=about`,
    facebookUrl,
    `${facebookUrl}about/`,
  ];
}

export async function findEmailOnFacebook(
  rawUrl: string | null | undefined,
  options?: { businessName?: string; useBrowser?: boolean }
): Promise<FacebookEmailResult> {
  const empty: FacebookEmailResult = {
    email: null,
    candidates: [],
    foundOn: null,
    confidence: 0,
    facebookUrl: null,
  };

  const facebookUrl = rawUrl ? normalizeFacebookUrl(rawUrl) : null;
  if (!facebookUrl) return empty;

  const urlsToTry = [...new Set(buildFacebookPageUrls(facebookUrl))];
  let blocked = false;
  const candidates = new Map<string, { url: string; score: number }>();

  for (const pageUrl of urlsToTry) {
    let html = await fetchFacebookHtml(pageUrl);

    if (!html || isFacebookLoginWall(html)) {
      blocked = blocked || Boolean(html && isFacebookLoginWall(html));
      html = await fetchHtmlWithBrowser(pageUrl);
    }

    if (!html) continue;
    if (isFacebookLoginWall(html)) {
      blocked = true;
      continue;
    }

    collectEmailsFromFacebookHtml(html, pageUrl, candidates, options?.businessName);
    await sleep(250);
  }

  const sorted = [...candidates.entries()].sort((a, b) => b[1].score - a[1].score);

  if (sorted.length === 0) {
    return {
      ...empty,
      facebookUrl,
      blocked: blocked && candidates.size === 0,
    };
  }

  const [email, meta] = sorted[0];
  return {
    email,
    candidates: sorted.map(([e]) => e),
    foundOn: meta.url,
    confidence: Math.min(1, meta.score / 100),
    facebookUrl,
    blocked: false,
  };
}

/** Recherche page FB + email — pour entreprises sans site web. */
export async function findEmailViaFacebookDiscovery(input: {
  businessName: string;
  city?: string | null;
  knownFacebookUrl?: string | null;
}): Promise<FacebookEmailResult & { facebookUrl: string | null }> {
  const facebookUrl =
    (input.knownFacebookUrl
      ? normalizeFacebookUrl(input.knownFacebookUrl)
      : null) ?? (await findFacebookPageBySearch(input.businessName, input.city));

  if (!facebookUrl) {
    return {
      email: null,
      candidates: [],
      foundOn: null,
      confidence: 0,
      facebookUrl: null,
      discoveredVia: undefined,
    };
  }

  const result = await findEmailOnFacebook(facebookUrl, {
    businessName: input.businessName,
    useBrowser: true,
  });

  return {
    ...result,
    facebookUrl,
    discoveredVia: input.knownFacebookUrl ? "known" : "search",
  };
}

function collectEmailsFromFacebookHtml(
  html: string,
  pageUrl: string,
  found: Map<string, { url: string; score: number }>,
  businessName?: string
) {
  const $ = cheerio.load(html);
  const emails = new Set<string>();

  $('a[href^="mailto:"]').each((_, el) => {
    const addr = cleanEmail(($(el).attr("href") ?? "").replace(/^mailto:/i, "").split("?")[0]);
    if (addr) emails.add(addr);
  });

  for (const e of extractEmailsFromHtml(html)) emails.add(e);
  for (const e of extractEmailsFromJsonScripts(html)) emails.add(e);
  for (const e of extractEmailsFromText($("body").text())) emails.add(e);

  const pageBonus = pageUrl.includes("/about") || pageUrl.includes("sk=about") ? 30 : 10;

  for (const raw of emails) {
    const email = cleanEmail(raw);
    if (!isValidEmail(email) || isPlatformEmail(email) || isBlockedLocal(email)) continue;

    const score = scoreFacebookEmail(email, pageBonus, businessName);
    if (score <= 0) continue;

    const existing = found.get(email);
    if (!existing || score > existing.score) {
      found.set(email, { url: pageUrl, score });
    }
  }
}

function scoreFacebookEmail(
  email: string,
  pageBonus: number,
  businessName?: string
): number {
  const local = email.split("@")[0]?.split("+")[0] ?? "";
  let score = 40 + pageBonus;

  if (PRIORITY_LOCALS.includes(local)) score += 25;
  if (businessName) {
    const domain = email.split("@")[1] ?? "";
    const nameNorm = normalizeBusinessName(businessName);
    const domainBase = domain.split(".")[0] ?? "";
    if (nameNorm.includes(domainBase) || domainBase.length > 4 && nameMatchScore(domainBase, businessName) > 50) {
      score += 15;
    }
  }

  return score;
}

function isFacebookLoginWall(html: string): boolean {
  const lower = html.toLowerCase();
  const shortPage = html.length < 15_000;
  return (
    lower.includes('id="loginform"') ||
    lower.includes("you must log in to continue") ||
    lower.includes("connectez-vous à facebook") ||
    lower.includes("log in to facebook") ||
    lower.includes("login_form") ||
    (shortPage && lower.includes('name="login"') && lower.includes("password"))
  );
}

async function fetchFacebookHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 14_000);

    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const html = await res.text();
    return html.length > 900_000 ? html.slice(0, 900_000) : html;
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
