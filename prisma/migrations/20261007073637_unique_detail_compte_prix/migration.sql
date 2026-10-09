/*
  Warnings:

  - A unique constraint covering the columns `[compteMatiereId,articleId,prixUnitaire]` on the table `DetailCompteMatiere` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "DetailCompteMatiere_compteMatiereId_articleId_prixUnitaire_key" ON "public"."DetailCompteMatiere"("compteMatiereId", "articleId", "prixUnitaire");
