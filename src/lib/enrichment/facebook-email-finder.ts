import * as cheerio from "cheerio";

export interface FacebookEmailResult {
  email: string | null;
  candidates: string[];
  foundOn: string | null;
  confidence: number;
  facebookUrl: string | null;
  blocked?: boolean;
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
]);

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const BLOCKED_EMAIL_DOMAINS = [
  "facebook.com",
  "fb.com",
  "meta.com",
  "example.com",
  "email.com",
  "sentry.io",
];

const BLOCKED_LOCALS = [
  "noreply",
  "no-reply",
  "donotreply",
  "postmaster",
  "webmaster",
];

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
          return `https://www.facebook.com/${slug}`;
        }
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

export async function findEmailOnFacebook(
  rawUrl: string | null | undefined
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

  const slug = facebookUrl.replace(/\/$/, "").split("/").pop() ?? "";
  const isProfile = facebookUrl.includes("profile.php");

  const urlsToTry = isProfile
    ? [facebookUrl, facebookUrl.replace("www.facebook.com", "m.facebook.com")]
    : [
        `https://m.facebook.com/${slug}/about`,
        `https://m.facebook.com/${slug}/`,
        `${facebookUrl.replace("www.facebook.com", "m.facebook.com")}about`,
        facebookUrl,
        `${facebookUrl}about`,
      ];

  const uniqueUrls = [...new Set(urlsToTry)];

  let blocked = false;
  const candidates = new Map<string, { url: string; score: number }>();

  for (const pageUrl of uniqueUrls) {
    const html = await fetchFacebookHtml(pageUrl);
    if (!html) continue;

    if (isFacebookLoginWall(html)) {
      blocked = true;
      continue;
    }

    collectEmailsFromFacebookHtml(html, pageUrl, candidates);
    await sleep(300);
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

function collectEmailsFromFacebookHtml(
  html: string,
  pageUrl: string,
  found: Map<string, { url: string; score: number }>
) {
  const decoded = html
    .replace(/\\u0040/gi, "@")
    .replace(/&#64;/g, "@")
    .replace(/&amp;/g, "&");

  const $ = cheerio.load(decoded);
  const emails = new Set<string>();

  $('a[href^="mailto:"]').each((_, el) => {
    const addr = ($(el).attr("href") ?? "")
      .replace(/^mailto:/i, "")
      .split("?")[0]
      .trim()
      .toLowerCase();
    if (addr) emails.add(addr);
  });

  for (const source of [decoded, $("body").text()]) {
    const matches = source.match(EMAIL_REGEX) ?? [];
    for (const m of matches) emails.add(m.toLowerCase());
  }

  const pageBonus = pageUrl.includes("/about") ? 25 : 10;

  for (const raw of emails) {
    const email = cleanEmail(raw);
    if (!isValidBusinessEmail(email)) continue;

    const score = scoreFacebookEmail(email, pageBonus);
    if (score <= 0) continue;

    const existing = found.get(email);
    if (!existing || score > existing.score) {
      found.set(email, { url: pageUrl, score });
    }
  }
}

function scoreFacebookEmail(email: string, pageBonus: number): number {
  const [local, domain] = email.split("@");
  if (!local || !domain) return 0;
  if (BLOCKED_EMAIL_DOMAINS.some((d) => domain.includes(d))) return 0;
  if (BLOCKED_LOCALS.some((b) => local === b || local.startsWith(`${b}+`)))
    return 0;
  if (email.length > 60) return 0;

  let score = 35 + pageBonus;
  if (local === "contact" || local === "info") score += 20;
  return score;
}

function isValidBusinessEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function cleanEmail(raw: string): string {
  return raw
    .replace(/mailto:/gi, "")
    .replace(/\u200b/g, "")
    .replace(/[>,;)}\]'"]+$/g, "")
    .trim()
    .toLowerCase();
}

function isFacebookLoginWall(html: string): boolean {
  const lower = html.toLowerCase();
  return (
    lower.includes('id="loginform"') ||
    lower.includes("you must log in to continue") ||
    lower.includes("connectez-vous à facebook") ||
    lower.includes("log in to facebook") ||
    (lower.includes('name="login"') && lower.includes("password"))
  );
}

async function fetchFacebookHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const html = await res.text();
    return html.length > 800_000 ? html.slice(0, 800_000) : html;
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
