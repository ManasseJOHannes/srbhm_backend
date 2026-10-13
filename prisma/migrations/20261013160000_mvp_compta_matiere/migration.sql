-- CreateEnum
CREATE TYPE "public"."TypeMouvement" AS ENUM ('ENTREE', 'SORTIE');

-- CreateTable
CREATE TABLE "public"."Nomenclature" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "description" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Nomenclature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Article" (
    "id" SERIAL NOT NULL,
    "designation" TEXT NOT NULL,
    "unite" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nomenclatureId" INTEGER NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompteMatiere" (
    "id" SERIAL NOT NULL,
    "exerciceId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "valeurExistanteDebut" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "valeurEntrees" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "valeurSorties" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "valeurRestante" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "CompteMatiere_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DetailCompteMatiere" (
    "id" SERIAL NOT NULL,
    "compteMatiereId" INTEGER NOT NULL,
    "articleId" INTEGER NOT NULL,
    "folioGrandLivre" INTEGER,
    "prixUnitaire" DECIMAL(65,30) NOT NULL,
    "existantDebut" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "entrees" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sorties" DECIMAL(65,30) NOT NULL DEFAULT 0,
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
CREATE UNIQUE INDEX "Nomenclature_code_key" ON "public"."Nomenclature"("code");

-- CreateIndex
CREATE INDEX "Article_nomenclatureId_idx" ON "public"."Article"("nomenclatureId");

-- CreateIndex
CREATE UNIQUE INDEX "CompteMatiere_exerciceId_key" ON "public"."CompteMatiere"("exerciceId");

-- CreateIndex
CREATE INDEX "DetailCompteMatiere_compteMatiereId_idx" ON "public"."DetailCompteMatiere"("compteMatiereId");

-- CreateIndex
CREATE INDEX "DetailCompteMatiere_articleId_idx" ON "public"."DetailCompteMatiere"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "DetailCompteMatiere_compteMatiereId_articleId_prixUnitaire_key" ON "public"."DetailCompteMatiere"("compteMatiereId", "articleId", "prixUnitaire");

-- CreateIndex
CREATE INDEX "Mouvement_exerciceId_idx" ON "public"."Mouvement"("exerciceId");

-- CreateIndex
CREATE INDEX "Mouvement_articleId_idx" ON "public"."Mouvement"("articleId");

-- CreateIndex
CREATE INDEX "Mouvement_type_idx" ON "public"."Mouvement"("type");

-- CreateIndex
CREATE INDEX "Mouvement_date_idx" ON "public"."Mouvement"("date");

-- AddForeignKey
ALTER TABLE "public"."Article" ADD CONSTRAINT "Article_nomenclatureId_fkey" FOREIGN KEY ("nomenclatureId") REFERENCES "public"."Nomenclature"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompteMatiere" ADD CONSTRAINT "CompteMatiere_exerciceId_fkey" FOREIGN KEY ("exerciceId") REFERENCES "public"."Exercice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DetailCompteMatiere" ADD CONSTRAINT "DetailCompteMatiere_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "public"."Article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DetailCompteMatiere" ADD CONSTRAINT "DetailCompteMatiere_compteMatiereId_fkey" FOREIGN KEY ("compteMatiereId") REFERENCES "public"."CompteMatiere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Mouvement" ADD CONSTRAINT "Mouvement_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "public"."Article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Mouvement" ADD CONSTRAINT "Mouvement_exerciceId_fkey" FOREIGN KEY ("exerciceId") REFERENCES "public"."Exercice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
