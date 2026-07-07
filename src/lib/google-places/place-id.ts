export function normalizePlaceId(placeId: string): string {
  const trimmed = placeId.trim();
  if (trimmed.startsWith("places/")) return trimmed.slice("places/".length);
  return trimmed;
}

export function getGooglePlacesApiKey(): string | null {
  return process.env.GOOGLE_PLACES_API_KEY ?? null;
}
