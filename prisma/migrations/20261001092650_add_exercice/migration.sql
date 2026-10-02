-- CreateEnum
CREATE TYPE "public"."StatutExercice" AS ENUM ('EN_COURS', 'CLOTURE');

-- CreateTable
CREATE TABLE "public"."Exercice" (
    "id" SERIAL NOT NULL,
    "annee" INTEGER NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "statut" "public"."StatutExercice" NOT NULL DEFAULT 'EN_COURS',
    "soaId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exercice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Exercice_soaId_idx" ON "public"."Exercice"("soaId");

-- CreateIndex
CREATE INDEX "Exercice_statut_idx" ON "public"."Exercice"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "Exercice_soaId_annee_key" ON "public"."Exercice"("soaId", "annee");

-- AddForeignKey
ALTER TABLE "public"."Exercice" ADD CONSTRAINT "Exercice_soaId_fkey" FOREIGN KEY ("soaId") REFERENCES "public"."soas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
