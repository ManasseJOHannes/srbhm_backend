/*
  Warnings:

  - You are about to drop the column `actif` on the `Article` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `Article` table. All the data in the column will be lost.
  - You are about to drop the column `reference` on the `Article` table. All the data in the column will be lost.
  - You are about to drop the column `articleId` on the `CompteMatiere` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[exerciceId]` on the table `CompteMatiere` will be added. If there are existing duplicate values, this will fail.
  - Made the column `libelle` on table `Nomenclature` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "public"."TypeMouvement" AS ENUM ('ENTREE', 'SORTIE');

-- DropForeignKey
ALTER TABLE "public"."CompteMatiere" DROP CONSTRAINT "CompteMatiere_articleId_fkey";

-- DropIndex
DROP INDEX "public"."Article_reference_key";

-- DropIndex
DROP INDEX "public"."CompteMatiere_articleId_idx";

-- DropIndex
DROP INDEX "public"."CompteMatiere_exerciceId_articleId_key";

-- DropIndex
DROP INDEX "public"."CompteMatiere_exerciceId_idx";

-- AlterTable
ALTER TABLE "public"."Article" DROP COLUMN "actif",
DROP COLUMN "description",
DROP COLUMN "reference";

-- AlterTable
ALTER TABLE "public"."CompteMatiere" DROP COLUMN "articleId",
ADD COLUMN     "valeurEntrees" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "valeurExistanteDebut" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "valeurRestante" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "valeurSorties" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."Nomenclature" ALTER COLUMN "libelle" SET NOT NULL;

-- CreateTable
CREATE TABLE "public"."DetailCompteMatiere" (
    "id" SERIAL NOT NULL,
    "compteMatiereId" INTEGER NOT NULL,
    "articleId" INTEGER NOT NULL,
    "folioGrandLivre" INTEGER,
    "prixUnitaire" DECIMAL(65,30) NOT NULL,
    "existantDebut" INTEGER NOT NULL DEFAULT 0,
    "entrees" INTEGER NOT NULL DEFAULT 0,
    "sorties" INTEGER NOT NULL DEFAULT 0,
    "observation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DetailCompteMatiere_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Mouvement" (
    "id" SERIAL NOT NULL,
    "type" "public"."TypeMouvement" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "exerciceId" INTEGER NOT NULL,
    "articleId" INTEGER NOT NULL,
    "quantite" DECIMAL(65,30) NOT NULL,
    "prixUnitaire" DECIMAL(65,30) NOT NULL,
    "observation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mouvement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DetailCompteMatiere_compteMatiereId_idx" ON "public"."DetailCompteMatiere"("compteMatiereId");

-- CreateIndex
CREATE INDEX "DetailCompteMatiere_articleId_idx" ON "public"."DetailCompteMatiere"("articleId");

-- CreateIndex
CREATE INDEX "Mouvement_exerciceId_idx" ON "public"."Mouvement"("exerciceId");

-- CreateIndex
CREATE INDEX "Mouvement_articleId_idx" ON "public"."Mouvement"("articleId");

-- CreateIndex
CREATE INDEX "Mouvement_type_idx" ON "public"."Mouvement"("type");

-- CreateIndex
CREATE INDEX "Mouvement_date_idx" ON "public"."Mouvement"("date");

-- CreateIndex
CREATE INDEX "Article_nomenclatureId_idx" ON "public"."Article"("nomenclatureId");

-- CreateIndex
CREATE UNIQUE INDEX "CompteMatiere_exerciceId_key" ON "public"."CompteMatiere"("exerciceId");

-- AddForeignKey
ALTER TABLE "public"."DetailCompteMatiere" ADD CONSTRAINT "DetailCompteMatiere_compteMatiereId_fkey" FOREIGN KEY ("compteMatiereId") REFERENCES "public"."CompteMatiere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DetailCompteMatiere" ADD CONSTRAINT "DetailCompteMatiere_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "public"."Article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Mouvement" ADD CONSTRAINT "Mouvement_exerciceId_fkey" FOREIGN KEY ("exerciceId") REFERENCES "public"."Exercice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Mouvement" ADD CONSTRAINT "Mouvement_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "public"."Article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
