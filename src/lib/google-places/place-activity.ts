import { getGooglePlacesApiKey, normalizePlaceId } from "@/lib/google-places/place-id";

const FIELD_MASK = [
  "businessStatus",
  "userRatingCount",
  "reviews.publishTime",
].join(",");

export interface GooglePlaceActivity {
  businessStatus?: string | null;
  reviewCount?: number | null;
  lastReviewDate?: string | null;
  monthsSinceLastReview?: number | null;
  fetched: boolean;
}

function monthsBetween(from: Date, to: Date): number {
  return (
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth())
  );
}

export async function fetchGooglePlaceActivity(
  googlePlaceId: string | null | undefined
): Promise<GooglePlaceActivity> {
  const empty: GooglePlaceActivity = {
    fetched: false,
    businessStatus: null,
    reviewCount: null,
    lastReviewDate: null,
    monthsSinceLastReview: null,
  };

  const apiKey = getGooglePlacesApiKey();
  if (!apiKey || !googlePlaceId?.trim()) return empty;

  const placeId = normalizePlaceId(googlePlaceId);

  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
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
      businessStatus?: string;
      userRatingCount?: number;
      reviews?: { publishTime?: string }[];
    };

    let lastReviewDate: string | null = null;
    let monthsSinceLastReview: number | null = null;

    const publishTimes = (data.reviews ?? [])
      .map((r) => r.publishTime)
      .filter(Boolean) as string[];

    if (publishTimes.length > 0) {
      const latest = publishTimes
        .map((iso) => new Date(iso))
        .filter((d) => !Number.isNaN(d.getTime()))
        .sort((a, b) => b.getTime() - a.getTime())[0];

      if (latest) {
        lastReviewDate = latest.toISOString();
        monthsSinceLastReview = monthsBetween(latest, new Date());
      }
    }

    return {
      fetched: true,
      businessStatus: data.businessStatus ?? null,
      reviewCount: data.userRatingCount ?? null,
      lastReviewDate,
      monthsSinceLastReview,
    };
  } catch {
    return empty;
  }
}
