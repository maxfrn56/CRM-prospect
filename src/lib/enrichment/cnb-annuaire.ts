export interface CnbLawyerRecord {
  barreau: string;
  lastName: string;
  firstName: string;
  structureName: string;
  siren: string;
  address1: string;
  postalCode: string;
  city: string;
}

export interface CnbMatchResult {
  record: CnbLawyerRecord;
  score: number;
}

let cachedRecords: CnbLawyerRecord[] | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/maitre|maître|me\b|cabinet|avocat|avocats/gi, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .filter((t) => t.length > 1);
}

async function resolveCsvUrl(): Promise<string> {
  const override = process.env.CNB_AVOCATS_CSV_URL?.trim();
  if (override) return override;

  const res = await fetch(
    "https://www.data.gouv.fr/api/1/datasets/annuaire-des-avocats-de-france/"
  );
  if (!res.ok) {
    throw new Error("Impossible de récupérer l'URL de l'annuaire CNB");
  }

  const data = (await res.json()) as {
    resources?: { url?: string; title?: string; format?: string }[];
  };

  const csv = data.resources?.find(
    (r) =>
      r.format === "csv" ||
      r.title?.toLowerCase().endsWith(".csv") ||
      r.url?.includes("annuaire-avocats")
  );

  if (!csv?.url) {
    throw new Error("Fichier CSV annuaire avocats introuvable sur data.gouv.fr");
  }

  return csv.url;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ";" && !inQuotes) {
      fields.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  fields.push(current.trim());
  return fields;
}

function parseCsv(content: string): CnbLawyerRecord[] {
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const records: CnbLawyerRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 9) continue;

    const lastName = cols[1]?.trim();
    const firstName = cols[2]?.trim();
    if (!lastName || !firstName) continue;

    records.push({
      barreau: cols[0]?.trim() ?? "",
      lastName,
      firstName,
      structureName: cols[3]?.trim() ?? "",
      siren: cols[4]?.trim() ?? "",
      address1: cols[5]?.trim() ?? "",
      postalCode: cols[7]?.trim() ?? "",
      city: cols[8]?.trim() ?? "",
    });
  }

  return records;
}

export async function loadCnbAnnuaire(): Promise<CnbLawyerRecord[]> {
  const now = Date.now();
  if (cachedRecords && now - cacheLoadedAt < CACHE_TTL_MS) {
    return cachedRecords;
  }

  const url = await resolveCsvUrl();
  const res = await fetch(url, {
    headers: { Accept: "text/csv,text/plain,*/*" },
  });

  if (!res.ok) {
    throw new Error(`Téléchargement annuaire CNB échoué (${res.status})`);
  }

  const buffer = await res.arrayBuffer();
  const decoder = new TextDecoder("latin1");
  const content = decoder.decode(buffer);

  cachedRecords = parseCsv(content);
  cacheLoadedAt = now;
  return cachedRecords;
}

function scoreLawyerMatch(
  prospectName: string,
  record: CnbLawyerRecord,
  city?: string | null,
  postalCode?: string | null
): number {
  const pn = normalizeText(prospectName);
  const fullDirect = normalizeText(`${record.firstName} ${record.lastName}`);
  const fullReverse = normalizeText(`${record.lastName} ${record.firstName}`);
  const structure = normalizeText(record.structureName);

  let score = 0;

  if (pn === fullDirect || pn === fullReverse) score += 100;
  else if (structure && (pn.includes(structure) || structure.includes(pn))) {
    score += 85;
  } else {
    const prospectTokens = tokenize(prospectName);
    const nameTokens = tokenize(`${record.firstName} ${record.lastName}`);
    const lastNorm = normalizeText(record.lastName);
    const firstNorm = normalizeText(record.firstName);

    if (prospectTokens.includes(lastNorm)) score += 45;
    if (prospectTokens.includes(firstNorm)) score += 25;

    const overlap = prospectTokens.filter((t) => nameTokens.includes(t)).length;
    score += overlap * 15;
  }

  if (postalCode && record.postalCode === postalCode) score += 20;
  if (city) {
    const nc = normalizeText(city);
    const rc = normalizeText(record.city);
    if (rc && (rc.includes(nc) || nc.includes(rc))) score += 15;
  }

  return score;
}

export function isLawyerSector(sector?: string | null): boolean {
  if (!sector) return false;
  return /avocat|cabinet d.?avocat|barreau/i.test(sector);
}

export async function findLawyerInCnbAnnuaire(input: {
  name: string;
  city?: string | null;
  postalCode?: string | null;
}): Promise<CnbMatchResult | null> {
  const records = await loadCnbAnnuaire();
  let best: CnbMatchResult | null = null;

  for (const record of records) {
    const score = scoreLawyerMatch(
      input.name,
      record,
      input.city,
      input.postalCode
    );
    if (score < 50) continue;
    if (!best || score > best.score) {
      best = { record, score };
    }
  }

  return best;
}
