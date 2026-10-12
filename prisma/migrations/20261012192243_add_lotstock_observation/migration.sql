-- AlterTable
ALTER TABLE "public"."LotStock" ADD COLUMN     "observation" TEXT;

-- Reprise des observations d'origine déjà rattachées aux lots (table
-- "ObservationStock", conservée telle quelle) vers la nouvelle colonne
-- "LotStock"."observation". Uniquement les lots encore sans observation
-- (aucun écrasement) ; en cas de lignes multiples pour un même lot,
-- la plus ancienne est conservée.
UPDATE "public"."LotStock" AS lot
SET "observation" = src."texte"
FROM (
  SELECT DISTINCT ON ("lotStockId") "lotStockId", "texte"
  FROM "public"."ObservationStock"
  ORDER BY "lotStockId", "id"
) AS src
WHERE src."lotStockId" = lot."id"
  AND lot."observation" IS NULL;
