export interface SireneEnrichment {
  siren?: string;
  siret?: string;
  legalName?: string;
  nafCode?: string;
  nafLabel?: string;
  employeeRange?: string;
  creationDate?: string;
  directorName?: string;
  matched: boolean;
}

interface SireneResult {
  siren?: string;
  nom_complet?: string;
  nom_raison_sociale?: string;
  activite_principale?: string;
  libelle_activite_principale?: string;
  tranche_effectif_salarie?: string;
  date_creation?: string;
  siege?: {
    siret?: string;
    code_postal?: string;
    libelle_commune?: string;
    activite_principale?: string;
  };
  dirigeants?: { nom?: string; prenoms?: string; qualite?: string }[];
}

interface SireneResponse {
  results?: SireneResult[];
  total_results?: number;
}

export async function enrichFromSirene(input: {
  name: string;
  city?: string;
  postalCode?: string;
}): Promise<SireneEnrichment> {
  const params = new URLSearchParams({
    q: input.name,
    page: "1",
    per_page: "5",
  });

  if (input.postalCode) {
    params.set("code_postal", input.postalCode);
  } else if (input.city) {
    params.set("commune", input.city);
  }

  try {
    const res = await fetch(
      `https://recherche-entreprises.api.gouv.fr/search?${params}`,
      { headers: { Accept: "application/json" } }
    );

    if (!res.ok) {
      return { matched: false };
    }

    const data = (await res.json()) as SireneResponse;
    const match = findBestMatch(data.results ?? [], input);

    if (!match) return { matched: false };

    const director = match.dirigeants?.[0];
    const directorName = director
      ? [director.prenoms, director.nom].filter(Boolean).join(" ")
      : undefined;

    return {
      siren: match.siren,
      siret: match.siege?.siret,
      legalName: match.nom_raison_sociale ?? match.nom_complet,
      nafCode: match.activite_principale ?? match.siege?.activite_principale,
      nafLabel: match.libelle_activite_principale,
      employeeRange: match.tranche_effectif_salarie,
      creationDate: match.date_creation,
      directorName,
      matched: true,
    };
  } catch {
    return { matched: false };
  }
}

function findBestMatch(
  results: SireneResult[],
  input: { name: string; postalCode?: string }
): SireneResult | null {
  if (results.length === 0) return null;

  const normalizedInput = normalizeName(input.name);

  const scored = results.map((r) => {
    const name = normalizeName(r.nom_complet ?? r.nom_raison_sociale ?? "");
    let score = similarity(normalizedInput, name);

    if (
      input.postalCode &&
      r.siege?.code_postal === input.postalCode
    ) {
      score += 0.3;
    }

    return { result: r, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score >= 0.4 ? scored[0].result : null;
}

function normalizeName(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

function similarity(a: string, b: string) {
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.8;

  const wordsA = new Set(a.split(/\s+/));
  const wordsB = new Set(b.split(/\s+/));
  let common = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) common++;
  }
  return common / Math.max(wordsA.size, wordsB.size, 1);
}
