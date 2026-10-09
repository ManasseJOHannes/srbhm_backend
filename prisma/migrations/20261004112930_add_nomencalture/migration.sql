/*
  Warnings:

  - Added the required column `nomenclatureId` to the `Article` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Article" ADD COLUMN     "nomenclatureId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "public"."Nomenclature" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT,
    "description" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Nomenclature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Nomenclature_code_key" ON "public"."Nomenclature"("code");

-- AddForeignKey
ALTER TABLE "public"."Article" ADD CONSTRAINT "Article_nomenclatureId_fkey" FOREIGN KEY ("nomenclatureId") REFERENCES "public"."Nomenclature"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
