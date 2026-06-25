export interface BusinessResult {
  googlePlaceId: string;
  name: string;
  activity?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
  googleMapsUrl?: string;
  types?: string[];
}

export interface SearchParams {
  sector: string;
  city: string;
  maxResults?: number;
  /** Requête complète — ignore la concaténation sector + city */
  textQuery?: string;
}

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.types",
  "places.googleMapsUri",
  "nextPageToken",
].join(",");

function getApiKey() {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY manquant");
  return key;
}

function parseAddress(formattedAddress?: string) {
  if (!formattedAddress) return { city: undefined, postalCode: undefined };

  const match = formattedAddress.match(/(\d{5})\s+([^,]+)/);
  return {
    postalCode: match?.[1],
    city: match?.[2]?.trim(),
  };
}

interface PlaceResult {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  types?: string[];
  googleMapsUri?: string;
}

interface SearchResponse {
  places?: PlaceResult[];
  nextPageToken?: string;
}

function normalizePlace(place: PlaceResult, fallbackCity: string): BusinessResult {
  const { city, postalCode } = parseAddress(place.formattedAddress);
  const activity = place.types?.find(
    (t) => !["point_of_interest", "establishment", "service"].includes(t)
  );

  return {
    googlePlaceId: place.id ?? "",
    name: place.displayName?.text ?? "Sans nom",
    activity: activity?.replace(/_/g, " "),
    address: place.formattedAddress,
    city: city ?? fallbackCity,
    postalCode,
    phone: place.nationalPhoneNumber ?? place.internationalPhoneNumber,
    website: place.websiteUri,
    rating: place.rating,
    reviewCount: place.userRatingCount,
    googleMapsUrl: place.googleMapsUri,
    types: place.types,
  };
}

export async function searchBusinesses(
  params: SearchParams
): Promise<BusinessResult[]> {
  const maxResults = params.maxResults ?? 60;
  const textQuery = params.textQuery ?? `${params.sector} ${params.city}`.trim();
  const all: BusinessResult[] = [];
  const seen = new Set<string>();
  let pageToken: string | undefined;

  while (all.length < maxResults) {
    const body: Record<string, unknown> = {
      textQuery,
      languageCode: "fr",
      regionCode: "FR",
      pageSize: Math.min(20, maxResults - all.length),
    };
    if (pageToken) body.pageToken = pageToken;

    const res = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": getApiKey(),
          "X-Goog-FieldMask": FIELD_MASK,
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Google Places API (${res.status}): ${text}`);
    }

    const data = (await res.json()) as SearchResponse;
    const places = data.places ?? [];

    if (places.length === 0) break;

    for (const place of places) {
      const biz = normalizePlace(place, params.city);
      if (biz.googlePlaceId && !seen.has(biz.googlePlaceId)) {
        seen.add(biz.googlePlaceId);
        all.push(biz);
      }
    }

    if (!data.nextPageToken || all.length >= maxResults) break;
    pageToken = data.nextPageToken;
    await sleep(400);
  }

  return all;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
