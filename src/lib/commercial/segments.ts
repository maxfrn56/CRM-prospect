export type CommercialSegment = "INDEPENDENT" | "SDR_STARTUP" | "SALES_CABINET";

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

export const COMMERCIAL_SEGMENTS: Record<
  CommercialSegment,
  CommercialSegmentConfig
> = {
  INDEPENDENT: {
    id: "INDEPENDENT",
    label: "Commercial indépendant",
    shortLabel: "Indépendant",
    description:
      "Freelances, agents mandataires, commerciaux solo qui prospectent seuls.",
    searchHint: "commercial indépendant, mandataire, agent commercial",
    defaultNiches: [
      "immobilier",
      "assurance",
      "énergie",
      "SaaS B2B",
      "formation",
      "automobile",
    ],
    pitchContext: `Je propose un outil de prospection clé en main (recherche de leads, emails personnalisés, relances automatiques) configuré pour le domaine du prospect.

Promesse pour l'indépendant :
- Gagner 5 à 10 h/semaine sur la recherche de contacts et les relances
- Ne plus prospecter à la main (Excel, copier-coller LinkedIn)
- Pipeline de RDV plus régulier sans embaucher
- Mise en place et personnalisation par moi (comme pour mon propre CRM)

Offre : démo 15 min + setup personnalisé selon son secteur (immobilier, assurance, SaaS, etc.).`,
    pitchExample: `Bonjour,

Je m'appelle {expéditeur} et j'accompagne des commerciaux indépendants qui en ont marre de passer leurs soirées à chercher des contacts et relancer à la main.

J'ai construit pour moi un système qui trouve les prospects, rédige les emails et envoie les relances automatiquement — adapté à mon secteur. Je le déploie maintenant pour d'autres indépendants, avec votre vocabulaire métier et vos cibles.

Si vous prospectez encore sur Excel ou LinkedIn sans automatisation, je peux vous montrer en 15 minutes comment structurer ça pour votre activité — sans engagement.

Seriez-vous disponible cette semaine pour un court échange ?`,
  },
  SDR_STARTUP: {
    id: "SDR_STARTUP",
    label: "SDR / Startup",
    shortLabel: "SDR & startup",
    description:
      "Startups B2B, équipes SDR de 1 à 5 personnes en phase de croissance.",
    searchHint: "startup B2B, scale-up, agence growth",
    defaultNiches: [
      "SaaS B2B",
      "fintech",
      "RH tech",
      "martech",
      "cybersécurité",
      "healthtech",
    ],
    pitchContext: `Je vends une stack de prospection outbound sur mesure pour startups et SDR : import de cibles, scoring, séquences email, relances J+4/J+7/J+12, suivi des réponses.

Promesse SDR / startup :
- Outbound reproductible sans empiler 4 outils (Apollo + Lemlist + Notion…)
- Setup adapté à leur ICP et leur secteur (SaaS, fintech, etc.)
- Gain de temps du founder / head of sales sur l'ops commercial
- Coût inférieur à une stack US + mise en place incluse

Offre : audit de leur process actuel + démo du système configuré pour leur marché.`,
    pitchExample: `Bonjour,

Je travaille avec des équipes SDR et des startups B2B qui veulent industrialiser l'outbound sans budget enterprise.

J'ai développé un CRM de prospection (ciblage, emails IA, relances, scoring) que j'utilise moi-même et que je configure pour chaque marché : ICP, messaging, séquences.

Si votre équipe passe encore trop de temps sur la recherche manuelle de leads ou le copier-coller d'emails, je peux vous montrer en 15 min comment centraliser tout ça — adapté à {secteur/niche}.

Ouvert à un échange rapide cette semaine ?`,
  },
  SALES_CABINET: {
    id: "SALES_CABINET",
    label: "Cabinet commercial (5–20)",
    shortLabel: "Cabinet 5–20",
    description:
      "Cabinets de force de vente externalisée, agences commerciales B2B.",
    searchHint: "cabinet commercial, force de vente externalisée, agence commerciale",
    defaultNiches: [
      "industrie",
      "B2B services",
      "IT",
      "télécom",
      "distribution",
      "SaaS",
    ],
    pitchContext: `Je propose une plateforme de prospection white-label / configurée pour cabinets commerciaux (5 à 20 commerciaux) : campagnes par secteur, assignation, emails, relances, reporting.

Promesse cabinet :
- Homogénéiser la prospection de toute l'équipe (plus de fichiers Excel par commercial)
- Lancer des campagnes par vertical client en quelques clics
- Suivre qui a été contacté, qui a répondu, qui est chaud
- Déploiement et formation incluse — je personnalise comme pour mon usage agence

Offre : présentation direction + pilote sur 1 vertical.`,
    pitchExample: `Bonjour,

J'accompagne des cabinets commerciaux qui gèrent plusieurs verticals et plusieurs commerciaux sur des fichiers disparates.

J'ai bâti un outil de prospection (campagnes, ciblage, emails automatiques, relances, suivi des réponses) que je configure par secteur client — le même que j'utilise pour mon activité.

Si vos équipes perdent du temps à reconcilier des listes ou relancer manuellement, je peux vous présenter une démo adaptée à votre organisation (5–20 commerciaux) et à votre domaine {niche}.

Seriez-vous ouvert à un call de 20 minutes avec le dirigeant ou le responsable commercial ?`,
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
    ? `\n\nDomaine / niche cible du prospect : ${niche.trim()} — adapter les exemples et le vocabulaire à ce secteur.`
    : "";

  const example = config.pitchExample
    .replace(/\{expéditeur\}/gi, senderName)
    .replace(/\{expéditeur\}/gi, senderName);

  return {
    pitchContext: `${config.pitchContext}${nicheLine}\n\nExpéditeur : ${senderName} — ${companyName}`,
    pitchExample: example,
  };
}
