export type CommercialSegment = "B2B_BRAND" | "WHOLESALER" | "MANUFACTURER";

export type CampaignType = "WEB_AGENCY" | "SALES_TOOL";

export interface CommercialSegmentConfig {
  id: CommercialSegment;
  label: string;
  shortLabel: string;
  description: string;
  searchHint: string;
  defaultNiches: string[];
  pitchContext: string;
  pitchExample: string;
}

const SHARED_PITCH_BASE = `Je vends et déploie un CRM de prospection automatique sur mesure pour entreprises B2B :
- Ciblage de prospects (magasins, revendeurs, entreprises clientes)
- Emails personnalisés par IA selon le secteur et la cible
- Relances automatiques J+4 / J+7 / J+12
- Scoring et suivi des réponses
- Installation et personnalisation incluse — je configure l'outil selon vos produits, votre territoire et vos personas acheteurs

Promesse : décharger l'équipe commerciale de la prospection manuelle (Excel, LinkedIn, relances oubliées) pour se concentrer sur les RDV et la vente.`;

export const COMMERCIAL_SEGMENTS: Record<
  CommercialSegment,
  CommercialSegmentConfig
> = {
  B2B_BRAND: {
    id: "B2B_BRAND",
    label: "Marque B2B",
    shortLabel: "Marque B2B",
    description:
      "Marques qui vendent à des magasins, revendeurs ou enseignes (ex. marque de surf → shops).",
    searchHint: "marque, fabricant, vente revendeurs, grossiste",
    defaultNiches: [
      "surf",
      "sport",
      "cosmétique",
      "alimentaire",
      "mode",
      "outdoor",
      "vin",
    ],
    pitchContext: `${SHARED_PITCH_BASE}

Segment : marque B2B qui développe un réseau de points de vente / revendeurs.
Angle : automatiser la prospection de nouveaux magasins et relancer les comptes dormants — outil installé au sein de l'entreprise, adapté à leur catalogue et à leurs cibles retail/pro.`,
    pitchExample: `Bonjour,

Je m'appelle {expéditeur}. J'accompagne des marques B2B qui développent leur réseau de magasins et revendeurs — et qui perdent un temps fou à prospecter à la main.

J'ai construit un CRM de prospection automatique (ciblage, emails personnalisés, relances, suivi) que j'installe et configure sur mesure pour chaque marque : vos produits, vos cibles, votre territoire.

Si votre équipe cherche encore de nouveaux points de vente sur Excel ou LinkedIn sans automatisation, je peux vous montrer en 15 minutes comment structurer ça pour {niche/secteur} — sans engagement.

Seriez-vous disponible cette semaine pour une courte démo ?`,
  },
  WHOLESALER: {
    id: "WHOLESALER",
    label: "Grossiste / distributeur",
    shortLabel: "Grossiste",
    description:
      "Grossistes et distributeurs B2B avec une force commerciale terrain.",
    searchHint: "grossiste, distributeur, importateur, vente professionnels",
    defaultNiches: [
      "alimentaire",
      "boissons",
      "équipement pro",
      "fournitures",
      "BTP",
      "hygiène",
      "emballage",
    ],
    pitchContext: `${SHARED_PITCH_BASE}

Segment : grossiste / distributeur B2B avec commerciaux terrain.
Angle : industrialiser la prospection de nouveaux clients pro (commerces, entreprises, artisans) et harmoniser les relances sur toute l'équipe.`,
    pitchExample: `Bonjour,

Je travaille avec des grossistes et distributeurs B2B dont les commerciaux passent trop de temps à constituer des fichiers prospects et relancer manuellement.

J'installe un outil de prospection automatique (ciblage, emails IA, relances, scoring) configuré pour votre secteur {niche} et vos typologies de clients pro — le même que j'utilise et personnalise pour chaque entreprise.

Si vous voulez décharger vos commerciaux de cette partie répétitive, je peux vous faire une démo de 15 minutes adaptée à votre activité.

Ouvert à un échange cette semaine ?`,
  },
  MANUFACTURER: {
    id: "MANUFACTURER",
    label: "Fabricant / industriel",
    shortLabel: "Fabricant",
    description:
      "Fabricants et équipementiers qui vendent B2B à d'autres entreprises.",
    searchHint: "fabricant, industriel, équipementier, vente B2B",
    defaultNiches: [
      "industrie",
      "mécanique",
      "emballage",
      "textile",
      "agroalimentaire",
      "électronique",
      "chimie",
    ],
    pitchContext: `${SHARED_PITCH_BASE}

Segment : fabricant / équipementier B2B.
Angle : accélérer l'outbound vers industriels, intégrateurs, distributeurs — pipeline de leads qualifiés sans empiler les outils.`,
    pitchExample: `Bonjour,

J'accompagne des fabricants et équipementiers B2B qui veulent structurer leur prospection commerciale sans recruter une armée de SDR.

Je déploie un CRM de prospection automatique (ciblage, emails, relances, suivi des réponses) personnalisé pour votre marché {niche} et vos types de clients — installé directement pour votre équipe commerciale.

Si votre prospection est encore éclatée entre Excel, mails manuels et relances oubliées, je peux vous montrer en 15 min comment centraliser tout ça.

Seriez-vous ouvert à un court call avec le dirigeant ou le responsable commercial ?`,
  },
};

export function getCommercialSegment(id: string | null | undefined) {
  if (!id || !(id in COMMERCIAL_SEGMENTS)) return null;
  return COMMERCIAL_SEGMENTS[id as CommercialSegment];
}

export function commercialSegmentLabel(id: string | null | undefined): string {
  return getCommercialSegment(id)?.label ?? id ?? "—";
}

export { buildCommercialSearchQueries, buildCommercialSearchQuery } from "@/lib/commercial/search-queries";

export function getCommercialPitch(
  segment: CommercialSegment,
  niche: string | null | undefined,
  senderName: string,
  companyName: string
): { pitchContext: string; pitchExample: string } {
  const config = COMMERCIAL_SEGMENTS[segment];
  const nicheLine = niche?.trim()
    ? `\n\nSecteur / produit du prospect : ${niche.trim()} — adapter exemples (magasins, revendeurs, clients pro du secteur).`
    : "";

  const example = config.pitchExample
    .replace(/\{expéditeur\}/gi, senderName)
    .replace(/\{niche\/secteur\}/gi, niche?.trim() ?? "votre secteur")
    .replace(/\{niche\}/gi, niche?.trim() ?? "votre secteur");

  return {
    pitchContext: `${config.pitchContext}${nicheLine}\n\nExpéditeur : ${senderName} — ${companyName}`,
    pitchExample: example,
  };
}
