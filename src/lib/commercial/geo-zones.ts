/** Départements et villes hubs pour les recherches régionales */
export interface GeoZone {
  id: string;
  label: string;
  keywords: string[];
  departments: string[];
  searchCities: string[];
}

export const GEO_ZONES: GeoZone[] = [
  {
    id: "nouvelle-aquitaine",
    label: "Nouvelle-Aquitaine",
    keywords: [
      "nouvelle-aquitaine",
      "nouvelle aquitaine",
      "aquitaine",
      "sud-ouest",
      "sud ouest",
    ],
    departments: ["16", "17", "19", "23", "24", "33", "40", "47", "64", "79", "86", "87"],
    searchCities: [
      "Biarritz",
      "Anglet",
      "Bayonne",
      "Hendaye",
      "Saint-Jean-de-Luz",
      "Hossegor",
      "Seignosse",
      "Capbreton",
      "Mimizan",
      "Arcachon",
      "Lacanau",
      "Bordeaux",
      "Pau",
      "Dax",
      "La Rochelle",
      "Royan",
    ],
  },
  {
    id: "occitanie",
    label: "Occitanie",
    keywords: ["occitanie", "languedoc", "mid-pyrénées", "pyrenees"],
    departments: ["09", "11", "12", "30", "31", "32", "34", "46", "48", "65", "66", "81", "82"],
    searchCities: ["Toulouse", "Montpellier", "Perpignan", "Nîmes", "Carcassonne"],
  },
  {
    id: "pays-basque",
    label: "Pays basque",
    keywords: ["pays basque", "euskadi", "côte basque", "cote basque"],
    departments: ["64"],
    searchCities: ["Biarritz", "Bayonne", "Anglet", "Hendaye", "Saint-Jean-de-Luz"],
  },
  {
    id: "landes",
    label: "Landes",
    keywords: ["landes", "sud landes"],
    departments: ["40"],
    searchCities: ["Hossegor", "Capbreton", "Dax", "Mont-de-Marsan", "Seignosse"],
  },
];

/** Mots associés pour valider la niche dans le nom / activité */
export const NICHE_SYNONYMS: Record<string, string[]> = {
  surf: [
    "surf",
    "surfing",
    "surfeur",
    "surfer",
    "surfeuse",
    "glisse",
    "bodyboard",
    "skimboard",
    "skim",
    "wetsuit",
    "combinaison",
    "neoprene",
    "board",
    "boards",
    "shortboard",
    "longboard",
    "surfboard",
    "surfboards",
    "planche",
    "planches",
    "shaper",
    "shaping",
    "handshape",
    "quiver",
    "leash",
    "pad",
    "wax",
    "fin",
    "fins",
    "epoxy",
    "polyurethane",
    "hand shaped",
  ],
  sport: [
    "sport",
    "sports",
    "outdoor",
    "athletic",
    "fitness pro",
    "équipement sportif",
    "equipement sportif",
  ],
  outdoor: ["outdoor", "aventure", "rando", "trek", "camping", "nature"],
  mode: ["mode", "fashion", "textile", "vêtement", "vetement", "apparel"],
  cosmétique: ["cosmétique", "cosmetique", "beauté", "beaute", "skincare"],
  alimentaire: ["alimentaire", "agro", "food", "boisson", "épicerie", "epicerie"],
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function detectGeoZone(location: string): GeoZone | null {
  const n = normalize(location);
  for (const zone of GEO_ZONES) {
    if (zone.keywords.some((k) => n.includes(normalize(k)))) return zone;
  }
  return null;
}

/** Villes utilisées dans les requêtes Google (région → hubs, sinon ville seule) */
export function resolveSearchCities(location: string): string[] {
  const zone = detectGeoZone(location);
  if (zone) return zone.searchCities;
  const city = location.trim();
  return city ? [city] : [];
}

export function expandNicheTerms(niche: string): string[] {
  const n = normalize(niche);
  const terms = new Set<string>([n]);
  for (const [key, synonyms] of Object.entries(NICHE_SYNONYMS)) {
    if (n.includes(key) || key.includes(n)) {
      for (const s of synonyms) terms.add(normalize(s));
    }
  }
  if (NICHE_SYNONYMS[n]) {
    for (const s of NICHE_SYNONYMS[n]) terms.add(normalize(s));
  }
  return [...terms].filter((t) => t.length > 2);
}

export function matchesTargetArea(
  biz: { city?: string; postalCode?: string; address?: string },
  location: string
): boolean {
  const zone = detectGeoZone(location);
  const locText = normalize(
    [biz.city, biz.address, biz.postalCode].filter(Boolean).join(" ")
  );

  if (zone) {
    const dept = biz.postalCode?.slice(0, 2);
    if (dept && zone.departments.includes(dept)) return true;
    if (zone.keywords.some((k) => locText.includes(normalize(k)))) return true;
    if (zone.searchCities.some((c) => locText.includes(normalize(c)))) return true;
    return false;
  }

  const target = normalize(location);
  if (!target) return true;
  return locText.includes(target);
}

export function mentionsNiche(
  text: string,
  niche: string
): boolean {
  const normalized = normalize(text);
  return expandNicheTerms(niche).some((term) => normalized.includes(term));
}
