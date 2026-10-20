-- Recensement libre : excédent, déficit et existant de référence figé.
ALTER TABLE "LigneInventaire"
ADD COLUMN "existantReference" DECIMAL(12,2),
ADD COLUMN "quantiteExcedent" DECIMAL(12,2),
ADD COLUMN "quantiteDeficit" DECIMAL(12,2);

-- Les excédents constatés génèrent une entrée de stock traçable.
CREATE TYPE "OrigineMouvement" AS ENUM ('MANUEL', 'RECENSEMENT');

ALTER TABLE "Mouvement"
ADD COLUMN "origine" "OrigineMouvement" NOT NULL DEFAULT 'MANUEL',
ADD COLUMN "ligneInventaireId" INTEGER;

CREATE UNIQUE INDEX "Mouvement_ligneInventaireId_key"
ON "Mouvement"("ligneInventaireId");

ALTER TABLE "Mouvement"
ADD CONSTRAINT "Mouvement_ligneInventaireId_fkey"
FOREIGN KEY ("ligneInventaireId") REFERENCES "LigneInventaire"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
