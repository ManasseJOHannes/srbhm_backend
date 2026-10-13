-- CreateTable
CREATE TABLE "public"."Inventaire" (
    "id" SERIAL NOT NULL,
    "exerciceId" INTEGER NOT NULL,
    "dateInventaire" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LigneInventaire" (
    "id" SERIAL NOT NULL,
    "inventaireId" INTEGER NOT NULL,
    "articleId" INTEGER NOT NULL,
    "prixUnitaire" DECIMAL(65,30) NOT NULL,
    "quantitePhysique" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LigneInventaire_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Inventaire_exerciceId_key" ON "public"."Inventaire"("exerciceId");

-- CreateIndex
CREATE INDEX "LigneInventaire_inventaireId_idx" ON "public"."LigneInventaire"("inventaireId");

-- CreateIndex
CREATE INDEX "LigneInventaire_articleId_idx" ON "public"."LigneInventaire"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "LigneInventaire_inventaireId_articleId_prixUnitaire_key" ON "public"."LigneInventaire"("inventaireId", "articleId", "prixUnitaire");

-- AddForeignKey
ALTER TABLE "public"."Inventaire" ADD CONSTRAINT "Inventaire_exerciceId_fkey" FOREIGN KEY ("exerciceId") REFERENCES "public"."Exercice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LigneInventaire" ADD CONSTRAINT "LigneInventaire_inventaireId_fkey" FOREIGN KEY ("inventaireId") REFERENCES "public"."Inventaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LigneInventaire" ADD CONSTRAINT "LigneInventaire_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "public"."Article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
