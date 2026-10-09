-- CreateEnum
CREATE TYPE "public"."TypeOrigineLot" AS ENUM ('STOCK_INITIAL', 'ENTREE');

-- CreateTable
CREATE TABLE "public"."AffectationSortie" (
    "id" SERIAL NOT NULL,
    "mouvementSortieId" INTEGER NOT NULL,
    "lotStockId" INTEGER NOT NULL,
    "quantite" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffectationSortie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LotStock" (
    "id" SERIAL NOT NULL,
    "articleId" INTEGER NOT NULL,
    "exerciceId" INTEGER NOT NULL,
    "typeOrigine" "public"."TypeOrigineLot" NOT NULL,
    "mouvementEntreeId" INTEGER,
    "detailCompteMatiereId" INTEGER,
    "dateOrigine" TIMESTAMP(3) NOT NULL,
    "quantiteInitiale" DECIMAL(12,2) NOT NULL,
    "quantiteRestante" DECIMAL(12,2) NOT NULL,
    "prixUnitaire" DECIMAL(12,2) NOT NULL,
    "lotParentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LotStock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AffectationSortie_mouvementSortieId_idx" ON "public"."AffectationSortie"("mouvementSortieId");

-- CreateIndex
CREATE INDEX "AffectationSortie_lotStockId_idx" ON "public"."AffectationSortie"("lotStockId");

-- CreateIndex
CREATE UNIQUE INDEX "LotStock_mouvementEntreeId_key" ON "public"."LotStock"("mouvementEntreeId");

-- CreateIndex
CREATE UNIQUE INDEX "LotStock_detailCompteMatiereId_key" ON "public"."LotStock"("detailCompteMatiereId");

-- CreateIndex
CREATE INDEX "LotStock_articleId_dateOrigine_id_idx" ON "public"."LotStock"("articleId", "dateOrigine", "id");

-- CreateIndex
CREATE INDEX "LotStock_exerciceId_idx" ON "public"."LotStock"("exerciceId");

-- CreateIndex
CREATE INDEX "LotStock_mouvementEntreeId_idx" ON "public"."LotStock"("mouvementEntreeId");

-- CreateIndex
CREATE INDEX "LotStock_detailCompteMatiereId_idx" ON "public"."LotStock"("detailCompteMatiereId");

-- CreateIndex
CREATE INDEX "LotStock_lotParentId_idx" ON "public"."LotStock"("lotParentId");

-- AddForeignKey
ALTER TABLE "public"."AffectationSortie" ADD CONSTRAINT "AffectationSortie_mouvementSortieId_fkey" FOREIGN KEY ("mouvementSortieId") REFERENCES "public"."Mouvement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AffectationSortie" ADD CONSTRAINT "AffectationSortie_lotStockId_fkey" FOREIGN KEY ("lotStockId") REFERENCES "public"."LotStock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LotStock" ADD CONSTRAINT "LotStock_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "public"."Article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LotStock" ADD CONSTRAINT "LotStock_exerciceId_fkey" FOREIGN KEY ("exerciceId") REFERENCES "public"."Exercice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LotStock" ADD CONSTRAINT "LotStock_mouvementEntreeId_fkey" FOREIGN KEY ("mouvementEntreeId") REFERENCES "public"."Mouvement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LotStock" ADD CONSTRAINT "LotStock_detailCompteMatiereId_fkey" FOREIGN KEY ("detailCompteMatiereId") REFERENCES "public"."DetailCompteMatiere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LotStock" ADD CONSTRAINT "LotStock_lotParentId_fkey" FOREIGN KEY ("lotParentId") REFERENCES "public"."LotStock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
