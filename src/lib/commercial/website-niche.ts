import * as cheerio from "cheerio";
import { mentionsNiche } from "@/lib/commercial/geo-zones";

export interface WebsiteNicheResult {
  fetched: boolean;
  relevant: boolean;
  combinedText: string;
}

export async function fetchWebsiteNicheText(
  rawUrl: string | null | undefined
): Promise<WebsiteNicheResult> {
  const empty: WebsiteNicheResult = {
    fetched: false,
    relevant: false,
    combinedText: "",
  };

  if (!rawUrl?.trim()) return empty;

  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

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

    if (!res.ok) return empty;

    const html = (await res.text()).slice(0, 200_000);
    const $ = cheerio.load(html);

    const parts = [
      $("title").first().text(),
      $('meta[name="description"]').attr("content"),
      $('meta[property="og:description"]').attr("content"),
      $('meta[name="keywords"]').attr("content"),
      $("h1").first().text(),
      $("h2").first().text(),
    ].filter(Boolean);

    let combinedText = parts.join(" ").replace(/\s+/g, " ").trim().toLowerCase();

    if (!combinedText || combinedText.length < 40) {
      const bodySnippet = $("body")
        .text()
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 900);
      combinedText = [combinedText, bodySnippet].filter(Boolean).join(" ").toLowerCase();
    }

    return {
      fetched: true,
      relevant: false,
      combinedText,
    };
  } catch {
    return empty;
  }
}

export async function isWebsiteNicheRelevant(
  rawUrl: string | null | undefined,
  niche: string
): Promise<{ relevant: boolean; combinedText: string }> {
  const result = await fetchWebsiteNicheText(rawUrl);
  if (!result.fetched) return { relevant: false, combinedText: "" };
  return {
    relevant: mentionsNiche(result.combinedText, niche),
    combinedText: result.combinedText,
  };
}
