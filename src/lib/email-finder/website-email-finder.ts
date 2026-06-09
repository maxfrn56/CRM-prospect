import * as cheerio from "cheerio";

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
];

const BLOCKED_DOMAINS = [
  "wixpress.com",
  "sentry.io",
  "example.com",
  "domain.com",
  "email.com",
  "yoursite.com",
  "wordpress.com",
  "gravatar.com",
  "facebook.com",
  "instagram.com",
  "google.com",
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "orange.fr",
  "free.fr",
  "laposte.net",
  "sentry-next.wixpress.com",
  "u003e",
  "2x.png",
];

const BLOCKED_LOCALS = [
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
  "postmaster",
  "webmaster",
  "admin",
  "support",
  "newsletter",
  "marketing",
  "unsubscribe",
  "privacy",
  "abuse",
  "mailer-daemon",
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

const EMAIL_REGEX =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

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
    await sleep(200);
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
    const addr = href.replace(/^mailto:/i, "").split("?")[0].trim();
    if (addr) emails.add(addr.toLowerCase());
  });

  const text = $("body").text().replace(/\s+/g, " ");
  const htmlSource = $.html();
  for (const source of [text, htmlSource]) {
    const matches = source.match(EMAIL_REGEX) ?? [];
    for (const m of matches) emails.add(m.toLowerCase());
  }

  const pageBonus = pageScore(pageUrl);

  for (const raw of emails) {
    const email = cleanEmail(raw);
    if (!email || !isValidEmail(email)) continue;

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
    /contact|mention|legal|nous-contacter|contactez|about|apropos/i;

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const text = $(el).text();
    if (!keywords.test(href) && !keywords.test(text)) return;

    try {
      const absolute = new URL(href, baseUrl).toString();
      if (absolute.startsWith("http")) links.push(absolute.split("#")[0]);
    } catch {
      // ignore invalid URLs
    }
  });

  return [...new Set(links)].slice(0, 8);
}

function scoreEmail(
  email: string,
  siteDomain: string | null,
  pageBonus: number
): number {
  const [local, domain] = email.split("@");
  if (!local || !domain) return 0;

  if (BLOCKED_DOMAINS.some((d) => domain.includes(d))) return 0;
  if (BLOCKED_LOCALS.some((b) => local === b || local.startsWith(`${b}+`)))
    return 0;
  if (email.length > 60) return 0;
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

function isValidEmail(email: string): boolean {
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

function normalizeUrl(raw: string): string | null {
  let url = raw.trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const parsed = new URL(url);
    return parsed.origin;
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
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host || null;
  } catch {
    return null;
  }
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ProspectCRM-EmailFinder/1.0)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "fr-FR,fr;q=0.9",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain"))
      return null;

    const html = await res.text();
    return html.length > 500_000 ? html.slice(0, 500_000) : html;
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
