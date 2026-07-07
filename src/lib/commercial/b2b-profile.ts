/** Signaux qu'une entreprise vend en B2B (marque, fabricant, réseau de distribution). */
export const B2B_SIGNAL_PATTERNS: RegExp[] = [
  /\bmarque\b/i,
  /\bbrand\b/i,
  /\bfabricant\b/i,
  /\bfabrication\b/i,
  /\bmanufacturer\b/i,
  /\bmanufacturing\b/i,
  /\bgrossiste\b/i,
  /\bwholesale\b/i,
  /\bwholesaler\b/i,
  /\bdistributeur\b/i,
  /\bdistribution\b/i,
  /\bimportateur\b/i,
  /\bfournisseur\b/i,
  /\béquipementier\b/i,
  /\bequipementier\b/i,
  /\bprofessionnels?\b/i,
  /\bprofessionnel\b/i,
  /\brevendeur/i,
  /\bdealer/i,
  /\bstockist/i,
  /\bb2b\b/i,
  /\busine\b/i,
  /\batelier\b/i,
  /\bshaper\b/i,
  /\bshaping\b/i,
  /\bhandshape\b/i,
  /\bindustriel\b/i,
  /\bindustrie\b/i,
  /\busine\b/i,
  /\bexport\b/i,
  /\bespace\s+pro\b/i,
  /\bcatalogue\s+pro\b/i,
  /\bnos\s+revendeurs\b/i,
  /\btrouver\s+un\s+revendeur\b/i,
  /\br[eé]seau\s+de\s+distribution\b/i,
  /\bpoints?\s+de\s+vente\s+partenaires\b/i,
  /\bshowroom\s+marque\b/i,
  /\bheadquarters\b/i,
  /\bsi[eè]ge\s+social\b/i,
];

/** Magasins B2C, écoles, locations — hors cible pour un CRM de prospection B2B. */
export const B2C_EXCLUSION_PATTERNS: RegExp[] = [
  /\bécole\s+de\s+surf\b/i,
  /\becole\s+de\s+surf\b/i,
  /\bsurf\s+school\b/i,
  /\bsurf\s+club\b/i,
  /\bclub\s+de\s+surf\b/i,
  /\bcours\s+de\s+surf\b/i,
  /\bcours\s+de\s+(glisse|bodyboard|skimboard)\b/i,
  /\b(leçons?|lecons?|lessons?)\s+(de\s+)?surf\b/i,
  /\bstage(s)?\s+(de\s+)?surf\b/i,
  /\bcamp(s)?\s+(de\s+)?surf\b/i,
  /\binitiation\s+(au\s+)?surf\b/i,
  /\bmoniteur(s)?\s+(de\s+)?surf\b/i,
  /\bmonitor(s)?\s+(de\s+)?surf\b/i,
  /\bcoaching\s+surf\b/i,
  /\blocation\s+(de\s+)?(surf|planche|matos|combinaison)\b/i,
  /\blouer\s+(une\s+)?(planche|combinaison)\b/i,
  /\b(rent|rental)\s+(surf|board|wetsuit)\b/i,
  /\bsurf\s*shop\b/i,
  /\bboutique\s+de\s+surf\b/i,
  /\bmagasin\s+de\s+surf\b/i,
  /\bshop\s+de\s+surf\b/i,
  /\bcentre\s+de\s+formation\b/i,
];

export const PURE_RETAIL_GOOGLE_TYPES = new Set([
  "sporting_goods_store",
  "clothing_store",
  "shoe_store",
  "jewelry_store",
  "department_store",
  "shopping_mall",
]);

export const B2B_GOOGLE_TYPES = new Set([
  "factory",
  "wholesaler",
  "corporate_office",
  "warehouse",
]);

export function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

export function hasB2BSignal(text: string): boolean {
  return matchesAny(text, B2B_SIGNAL_PATTERNS);
}

export function isB2CExcluded(text: string): boolean {
  return matchesAny(text, B2C_EXCLUSION_PATTERNS);
}

export function isPureRetailGoogleType(types: string[] | undefined): boolean {
  if (!types?.length) return false;
  return types.some((t) => PURE_RETAIL_GOOGLE_TYPES.has(t));
}

export function hasB2BGoogleType(types: string[] | undefined): boolean {
  if (!types?.length) return false;
  return types.some((t) => B2B_GOOGLE_TYPES.has(t));
}

export interface B2BQualification {
  ok: boolean;
  reason: string;
}

/**
 * Une marque B2B = signal wholesale/fabricant/réseau pro,
 * ou type Google factory/wholesaler/siège — pas un magasin pur B2C.
 */
export function qualifiesAsB2BBrand(
  text: string,
  types: string[] | undefined
): B2BQualification {
  if (isB2CExcluded(text)) {
    return { ok: false, reason: "magasin B2C, école ou location" };
  }

  if (hasB2BGoogleType(types)) {
    return { ok: true, reason: "profil fabricant / grossiste / siège" };
  }

  if (hasB2BSignal(text)) {
    return { ok: true, reason: "signal marque / fabricant / distribution B2B" };
  }

  if (isPureRetailGoogleType(types)) {
    return {
      ok: false,
      reason: "magasin retail B2C sans signal marque ou distribution pro",
    };
  }

  const retailHint =
    /\b(magasin|boutique|shop|store|retail|articles de sport)\b/i.test(text);
  if (retailHint) {
    return {
      ok: false,
      reason: "commerce de détail sans profil marque B2B",
    };
  }

  return {
    ok: false,
    reason: "pas de signal B2B (fabricant, marque, réseau revendeurs)",
  };
}
