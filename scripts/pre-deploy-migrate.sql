-- Réinitialise les anciens segments commerciaux avant changement d'enum Prisma
UPDATE "SearchCampaign"
SET "commercialSegment" = NULL
WHERE "commercialSegment"::text IN (
  'INDEPENDENT',
  'SDR_STARTUP',
  'SALES_CABINET'
);
