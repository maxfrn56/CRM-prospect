import * as cheerio from "cheerio";
import { findEmailOnWebsite } from "@/lib/email-finder/website-email-finder";
import { enrichFromPappers } from "./pappers";
import {
  findLawyerInCnbAnnuaire,
  isLawyerSector,
  type CnbLawyerRecord,
} from "./cnb-annuaire";

export interface BarreauEmailResult {
  email: string | null;
  source: string | null;
  matchedLawyer: CnbLawyerRecord | null;
  matchScore: number;
  profileUrl: string | null;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value: string): string {
  return normalizeText(value).replace(/\s+/g, "-");
}

function extractEmailFromHtml(html: string): string | null {
  const $ = cheerio.load(html);

  const mailto = $('a[href^="mailto:"]').first().attr("href");
  if (mailto) {
    const email = mailto.replace(/^mailto:/i, "").split("?")[0].trim();
    if (email.includes("@")) return email.toLowerCase();
  }

  const regex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = html.match(regex) ?? [];
  for (const raw of matches) {
    const email = raw.toLowerCase();
    if (
      !email.includes("barreau") &&
      !email.includes("avocat.fr") &&
      !email.includes("example.com")
    ) {
      return email;
    }
  }

  return null;
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
          "Mozilla/5.0 (compatible; ProspectCRM/1.0; +https://localhost)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function profileUrlsForBarreau(record: CnbLawyerRecord): string[] {
  const last = slugify(record.lastName);
  const first = slugify(record.firstName);
  const barreau = record.barreau.toUpperCase();

  const urls: string[] = [];

  if (barreau === "LYON") {
    urls.push(
      `https://www.barreaulyon.com/annuaire/avocat/${last}-${first}/`,
      `https://www.barreaulyon.com/annuaire/avocat/${first}-${last}/`
    );
  }

  if (barreau === "PARIS") {
    urls.push(
      `https://www.avocatparis.org/annuaire/${last}-${first}`,
      `https://www.avocatparis.org/annuaire/${first}-${last}`
    );
  }

  if (barreau === "BORDEAUX") {
    urls.push(
      `https://www.barreau-bordeaux.com/avocat/${last}-${first}/`,
      `https://www.barreau-bordeaux.com/avocat/${first}-${last}/`
    );
  }

  if (barreau === "MARSEILLE") {
    urls.push(
      `https://www.barreau-marseille.avocat.fr/fr/annuaire/${last}-${first}`,
      `https://www.barreau-marseille.avocat.fr/fr/annuaire/${first}-${last}`
    );
  }

  if (barreau.includes("LILLE")) {
    urls.push(
      `https://www.barreaudelille.com/annuaire/${last}-${first}/`,
      `https://www.barreaudelille.com/annuaire/${first}-${last}/`
    );
  }

  if (barreau === "TOULOUSE") {
    urls.push(
      `https://www.barreau-toulouse.avocat.fr/annuaire/${last}-${first}/`,
      `https://www.barreau-toulouse.avocat.fr/annuaire/${first}-${last}/`
    );
  }

  if (barreau === "NANTES") {
    urls.push(
      `https://www.barreau-nantes.fr/annuaire/${last}-${first}/`,
      `https://www.barreau-nantes.fr/annuaire/${first}-${last}/`
    );
  }

  return urls;
}

async function scrapeBarreauProfile(
  record: CnbLawyerRecord
): Promise<{ email: string | null; profileUrl: string | null }> {
  const urls = profileUrlsForBarreau(record);

  for (const url of urls) {
    const html = await fetchHtml(url);
    if (!html) continue;

    const email = extractEmailFromHtml(html);
    if (email) {
      return { email, profileUrl: url };
    }
  }

  return { email: null, profileUrl: urls[0] ?? null };
}

export async function findEmailViaBarreau(input: {
  name: string;
  city?: string | null;
  postalCode?: string | null;
  website?: string | null;
  sector?: string | null;
}): Promise<BarreauEmailResult> {
  const empty: BarreauEmailResult = {
    email: null,
    source: null,
    matchedLawyer: null,
    matchScore: 0,
    profileUrl: null,
  };

  if (!isLawyerSector(input.sector)) return empty;

  const match = await findLawyerInCnbAnnuaire({
    name: input.name,
    city: input.city,
    postalCode: input.postalCode,
  });

  if (!match) return empty;

  const { record, score } = match;

  if (input.website) {
    const onSite = await findEmailOnWebsite(input.website);
    if (onSite.email) {
      return {
        email: onSite.email,
        source: "barreau+website",
        matchedLawyer: record,
        matchScore: score,
        profileUrl: null,
      };
    }
  }

  const profile = await scrapeBarreauProfile(record);
  if (profile.email) {
    return {
      email: profile.email,
      source: "barreau",
      matchedLawyer: record,
      matchScore: score,
      profileUrl: profile.profileUrl,
    };
  }

  if (record.siren) {
    const pappers = await enrichFromPappers({
      name: record.structureName || input.name,
      siren: record.siren,
      city: input.city ?? record.city,
    });
    if (pappers.email) {
      return {
        email: pappers.email,
        source: "barreau+pappers",
        matchedLawyer: record,
        matchScore: score,
        profileUrl: profile.profileUrl,
      };
    }
    if (pappers.website) {
      const onSite = await findEmailOnWebsite(pappers.website);
      if (onSite.email) {
        return {
          email: onSite.email,
          source: "barreau+pappers-website",
          matchedLawyer: record,
          matchScore: score,
          profileUrl: profile.profileUrl,
        };
      }
    }
  }

  return {
    email: null,
    source: null,
    matchedLawyer: record,
    matchScore: score,
    profileUrl: profile.profileUrl,
  };
}

export { isLawyerSector };
