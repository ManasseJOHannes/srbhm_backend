CREATE TABLE "Inventaire" (
    "id" SERIAL NOT NULL,
    "exerciceId" INTEGER NOT NULL,
    "dateInventaire" TIMESTAMP(3) NOT NULL,
    "lieu" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventaire_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LigneInventaire" (
    "id" SERIAL NOT NULL,
    "inventaireId" INTEGER NOT NULL,
    "articleId" INTEGER NOT NULL,
    "prixUnitaire" DECIMAL(12,2) NOT NULL,
    "quantitePhysique" DECIMAL(12,2) NOT NULL,
    "observation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LigneInventaire_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Inventaire_exerciceId_key" ON "Inventaire"("exerciceId");
CREATE UNIQUE INDEX "LigneInventaire_inventaireId_articleId_prixUnitaire_key"
    ON "LigneInventaire"("inventaireId", "articleId", "prixUnitaire");
CREATE INDEX "LigneInventaire_inventaireId_idx" ON "LigneInventaire"("inventaireId");
CREATE INDEX "LigneInventaire_articleId_idx" ON "LigneInventaire"("articleId");

ALTER TABLE "Inventaire"
    ADD CONSTRAINT "Inventaire_exerciceId_fkey"
    FOREIGN KEY ("exerciceId") REFERENCES "Exercice"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LigneInventaire"
    ADD CONSTRAINT "LigneInventaire_inventaireId_fkey"
    FOREIGN KEY ("inventaireId") REFERENCES "Inventaire"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LigneInventaire"
    ADD CONSTRAINT "LigneInventaire_articleId_fkey"
    FOREIGN KEY ("articleId") REFERENCES "Article"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
