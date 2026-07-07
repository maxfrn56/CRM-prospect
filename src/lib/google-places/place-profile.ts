import { getGooglePlacesApiKey, normalizePlaceId } from "@/lib/google-places/place-id";

const FIELD_MASK = [
  "editorialSummary",
  "generativeSummary",
  "primaryTypeDisplayName",
  "types",
  "websiteUri",
].join(",");

export interface GooglePlaceProfile {
  fetched: boolean;
  editorialSummary: string | null;
  generativeSummary: string | null;
  primaryTypeLabel: string | null;
  types: string[];
  website: string | null;
  /** Texte combiné pour recherche niche */
  combinedText: string;
}

export async function fetchGooglePlaceProfile(
  googlePlaceId: string | null | undefined
): Promise<GooglePlaceProfile> {
  const empty: GooglePlaceProfile = {
    fetched: false,
    editorialSummary: null,
    generativeSummary: null,
    primaryTypeLabel: null,
    types: [],
    website: null,
    combinedText: "",
  };

  const apiKey = getGooglePlacesApiKey();
  if (!apiKey || !googlePlaceId?.trim()) return empty;

  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(normalizePlaceId(googlePlaceId))}`,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": FIELD_MASK,
        },
        next: { revalidate: 0 },
      }
    );

    if (!res.ok) return empty;

    const data = (await res.json()) as {
      editorialSummary?: { text?: string; overview?: string };
      generativeSummary?: { overview?: { text?: string } };
      primaryTypeDisplayName?: { text?: string };
      types?: string[];
      websiteUri?: string;
    };

    const editorialSummary =
      data.editorialSummary?.text ??
      data.editorialSummary?.overview ??
      null;
    const generativeSummary =
      data.generativeSummary?.overview?.text ?? null;
    const primaryTypeLabel = data.primaryTypeDisplayName?.text ?? null;
    const types = data.types ?? [];

    const combinedText = [
      editorialSummary,
      generativeSummary,
      primaryTypeLabel,
      ...types.map((t) => t.replace(/_/g, " ")),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return {
      fetched: true,
      editorialSummary,
      generativeSummary,
      primaryTypeLabel,
      types,
      website: data.websiteUri ?? null,
      combinedText,
    };
  } catch {
    return empty;
  }
}
