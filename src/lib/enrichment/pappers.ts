export interface PappersEnrichment {
  siren?: string;
  siret?: string;
  email?: string;
  phone?: string;
  website?: string;
  capital?: number;
  effectif?: string;
  formeJuridique?: string;
  dirigeant?: string;
  isCeased?: boolean;
  statusLabel?: string;
  cessationDate?: string | null;
  radiationDate?: string | null;
  matched: boolean;
}

interface PappersEntreprise {
  siren?: string;
  siret_siege?: string;
  nom_entreprise?: string;
  email?: string;
  telephone?: string;
  site_internet?: string;
  capital?: number;
  effectif?: string;
  forme_juridique?: string;
  entreprise_cessee?: boolean;
  date_cessation?: string | null;
  date_radiation?: string | null;
  statut_consolide?: string;
  representants?: { nom_complet?: string; qualite?: string }[];
}

export async function enrichFromPappers(input: {
  name: string;
  siren?: string;
  city?: string;
}): Promise<PappersEnrichment> {
  const apiKey = process.env.PAPPERS_API_KEY;
  if (!apiKey) return { matched: false };

  try {
    if (input.siren) {
      return fetchBySiren(input.siren, apiKey);
    }
    return searchByName(input.name, input.city, apiKey);
  } catch {
    return { matched: false };
  }
}

async function fetchBySiren(
  siren: string,
  apiKey: string
): Promise<PappersEnrichment> {
  const res = await fetch(
    `https://api.pappers.fr/v2/entreprise?api_token=${apiKey}&siren=${siren}`,
    { headers: { Accept: "application/json" } }
  );

  if (!res.ok) return { matched: false };

  const data = (await res.json()) as PappersEntreprise;
  return mapPappers(data);
}

async function searchByName(
  name: string,
  city: string | undefined,
  apiKey: string
): Promise<PappersEnrichment> {
  const params = new URLSearchParams({
    api_token: apiKey,
    q: name,
    par_page: "3",
  });
  if (city) params.set("ville", city);

  const res = await fetch(
    `https://api.pappers.fr/v2/recherche?${params}`,
    { headers: { Accept: "application/json" } }
  );

  if (!res.ok) return { matched: false };

  const data = (await res.json()) as {
    resultats?: PappersEntreprise[];
  };

  const first = data.resultats?.[0];
  if (!first) return { matched: false };
  return mapPappers(first);
}

function mapPappers(data: PappersEntreprise): PappersEnrichment {
  const dirigeant = data.representants?.[0]?.nom_complet;
  const isCeased = data.entreprise_cessee === true;
  const statusLabel = data.statut_consolide?.trim();

  return {
    siren: data.siren,
    siret: data.siret_siege,
    email: data.email,
    phone: data.telephone,
    website: data.site_internet,
    capital: data.capital,
    effectif: data.effectif,
    formeJuridique: data.forme_juridique,
    dirigeant,
    isCeased,
    statusLabel: isCeased
      ? (statusLabel ?? "Entreprise cessée (Pappers)")
      : statusLabel,
    cessationDate: data.date_cessation ?? null,
    radiationDate: data.date_radiation ?? null,
    matched: Boolean(data.siren),
  };
}
