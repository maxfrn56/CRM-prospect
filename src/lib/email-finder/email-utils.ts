const EMAIL_REGEX =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const OBFUSCATED_PATTERNS = [
  /([a-z0-9._%+-]+)\s*\[\s*at\s*\]\s*([a-z0-9.-]+)\s*\[\s*dot\s*\]\s*([a-z]{2,})/gi,
  /([a-z0-9._%+-]+)\s*\(\s*at\s*\)\s*([a-z0-9.-]+)\s*\(\s*dot\s*\)\s*([a-z]{2,})/gi,
  /([a-z0-9._%+-]+)\s*@\s*([a-z0-9.-]+)\s*\.\s*([a-z]{2,})/gi,
  /([a-z0-9._%+-]+)\s*(?:&#64;|&commat;|@)\s*([a-z0-9.-]+)\s*(?:&#46;|&period;|\.\s*)\s*([a-z]{2,})/gi,
];

/** Domaines plateforme / technique — pas des emails de contact entreprise */
export const PLATFORM_EMAIL_DOMAINS = [
  "facebook.com",
  "fb.com",
  "meta.com",
  "instagram.com",
  "google.com",
  "example.com",
  "email.com",
  "domain.com",
  "yoursite.com",
  "sentry.io",
  "wixpress.com",
  "wordpress.com",
  "gravatar.com",
  "2x.png",
  "u003e",
];

export const BLOCKED_LOCALS = [
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
  "postmaster",
  "webmaster",
  "mailer-daemon",
  "unsubscribe",
];

export function cleanEmail(raw: string): string {
  return raw
    .replace(/mailto:/gi, "")
    .replace(/\u200b/g, "")
    .replace(/\\u0040/gi, "@")
    .replace(/&#64;/g, "@")
    .replace(/&amp;/g, "&")
    .replace(/[>,;)}\]'"]+$/g, "")
    .trim()
    .toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 60;
}

export function isPlatformEmail(email: string): boolean {
  const domain = email.split("@")[1] ?? "";
  return PLATFORM_EMAIL_DOMAINS.some((d) => domain.includes(d));
}

export function decodeCloudflareEmails(html: string): string[] {
  const found: string[] = [];
  const regex = /\/cdn-cgi\/l\/email-protection#([a-f0-9]+)/gi;
  for (const match of html.matchAll(regex)) {
    const decoded = decodeCloudflareHex(match[1]);
    if (decoded) found.push(decoded);
  }
  return found;
}

function decodeCloudflareHex(encoded: string): string | null {
  if (encoded.length < 4 || encoded.length % 2 !== 0) return null;
  try {
    const key = parseInt(encoded.slice(0, 2), 16);
    let email = "";
    for (let i = 2; i < encoded.length; i += 2) {
      email += String.fromCharCode(parseInt(encoded.slice(i, i + 2), 16) ^ key);
    }
    return isValidEmail(email) ? email : null;
  } catch {
    return null;
  }
}

export function extractEmailsFromText(text: string): string[] {
  const emails = new Set<string>();

  const normalized = text
    .replace(/\\u0040/gi, "@")
    .replace(/&#64;/g, "@")
    .replace(/&amp;/g, "&");

  for (const match of normalized.matchAll(EMAIL_REGEX)) {
    emails.add(cleanEmail(match[0]));
  }

  for (const pattern of OBFUSCATED_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of normalized.matchAll(pattern)) {
      const rebuilt = cleanEmail(`${match[1]}@${match[2]}.${match[3]}`);
      if (isValidEmail(rebuilt)) emails.add(rebuilt);
    }
  }

  return [...emails];
}

export function extractEmailsFromJsonScripts(html: string): string[] {
  const emails = new Set<string>();
  const jsonEmailPatterns = [
    /"(?:email|actual_email|public_email|contact_email)":"([^"\\]+)"/gi,
    /"(?:email|actual_email|public_email|contact_email)":"([^"@]+@[^"\\]+)"/gi,
    /email\\":\\"([^"\\]+@[^"\\]+)\\"/gi,
  ];

  for (const pattern of jsonEmailPatterns) {
    pattern.lastIndex = 0;
    for (const match of html.matchAll(pattern)) {
      const email = cleanEmail(match[1].replace(/\\u0040/g, "@"));
      if (isValidEmail(email)) emails.add(email);
    }
  }

  return [...emails];
}

export function extractEmailsFromHtml(html: string): string[] {
  const emails = new Set<string>();

  for (const e of decodeCloudflareEmails(html)) emails.add(e);
  for (const e of extractEmailsFromJsonScripts(html)) emails.add(e);
  for (const e of extractEmailsFromText(html)) emails.add(e);

  return [...emails].filter(
    (e) => isValidEmail(e) && !isPlatformEmail(e) && !isBlockedLocal(e)
  );
}

export function isBlockedLocal(email: string): boolean {
  const local = email.split("@")[0]?.split("+")[0] ?? "";
  return BLOCKED_LOCALS.some((b) => local === b || local.startsWith(`${b}+`));
}

export function normalizeBusinessName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function nameMatchScore(pageName: string, businessName: string): number {
  const a = normalizeBusinessName(pageName);
  const b = normalizeBusinessName(businessName);
  if (!a || !b) return 0;
  if (a.includes(b) || b.includes(a)) return 100;

  const aTokens = b.split(" ").filter((t) => t.length > 2);
  const matched = aTokens.filter((t) => a.includes(t)).length;
  return aTokens.length > 0 ? Math.round((matched / aTokens.length) * 100) : 0;
}
