-- ============================================================================
-- Nouvelle hiérarchie des codes compte : Chapitre -> CodeArticle -> Paragraphe.
-- Remplace l'ancien schéma à plat (ArticleCodeCompte / CodeCompte /
-- NomenclatureCodeCompte) et rattache chaque article à un paragraphe.
-- ============================================================================

-- CreateTable
CREATE TABLE "public"."Chapitre" (
    "id" SERIAL NOT NULL,
    "chapitre" TEXT NOT NULL,

    CONSTRAINT "Chapitre_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Chapitre_chapitre_key" ON "public"."Chapitre"("chapitre");

-- CreateTable
CREATE TABLE "public"."CodeArticle" (
    "id" SERIAL NOT NULL,
    "chapitreId" INTEGER NOT NULL,
    "article" TEXT NOT NULL,
    "libelle" TEXT,

    CONSTRAINT "CodeArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Paragraphe" (
    "id" SERIAL NOT NULL,
    "articleId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "nomenclatureId" INTEGER,

    CONSTRAINT "Paragraphe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CodeArticle_chapitreId_article_key" ON "public"."CodeArticle"("chapitreId", "article");
CREATE INDEX "CodeArticle_chapitreId_idx" ON "public"."CodeArticle"("chapitreId");
CREATE UNIQUE INDEX "Paragraphe_code_key" ON "public"."Paragraphe"("code");
CREATE INDEX "Paragraphe_articleId_idx" ON "public"."Paragraphe"("articleId");
CREATE INDEX "Paragraphe_nomenclatureId_idx" ON "public"."Paragraphe"("nomenclatureId");

-- Seed : chapitre 21 (les codes compte officiels du mobilier)
INSERT INTO "public"."Chapitre" ("chapitre") VALUES ('21');

-- Copie des articles budgétaires existants (211 à 218)
INSERT INTO "public"."CodeArticle" ("chapitreId", "article", "libelle")
SELECT ch."id", a."code", a."libelle"
FROM "public"."ArticleCodeCompte" a
CROSS JOIN "public"."Chapitre" ch
WHERE ch."chapitre" = '21';

-- Copie des codes compte (paragraphes) et de leur association nomenclature
INSERT INTO "public"."Paragraphe" ("articleId", "code", "libelle", "nomenclatureId")
SELECT ca."id", cc."code", cc."libelle",
    (SELECT n."id"
     FROM "public"."NomenclatureCodeCompte" ncc
     JOIN "public"."Nomenclature" n ON n."id" = ncc."nomenclatureId"
     WHERE ncc."codeCompteCode" = cc."code"
     LIMIT 1)
FROM "public"."CodeCompte" cc
JOIN "public"."CodeArticle" ca ON ca."article" = cc."articleCode"
JOIN "public"."Chapitre" ch ON ch."id" = ca."chapitreId" AND ch."chapitre" = '21';

-- Remplacement de Article.codeCompteCode par Article.paragrapheId
ALTER TABLE "public"."Article" ADD COLUMN "paragrapheId" INTEGER;

UPDATE "public"."Article" a
SET "paragrapheId" = p."id"
FROM "public"."Paragraphe" p
WHERE p."code" = a."codeCompteCode";

ALTER TABLE "public"."Article" ALTER COLUMN "paragrapheId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Article_paragrapheId_idx" ON "public"."Article"("paragrapheId");

-- AddForeignKey
ALTER TABLE "public"."CodeArticle" ADD CONSTRAINT "CodeArticle_chapitreId_fkey" FOREIGN KEY ("chapitreId") REFERENCES "public"."Chapitre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Paragraphe" ADD CONSTRAINT "Paragraphe_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "public"."CodeArticle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Paragraphe" ADD CONSTRAINT "Paragraphe_nomenclatureId_fkey" FOREIGN KEY ("nomenclatureId") REFERENCES "public"."Nomenclature"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Article" ADD CONSTRAINT "Article_paragrapheId_fkey" FOREIGN KEY ("paragrapheId") REFERENCES "public"."Paragraphe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Retrait de l'ancien schéma
ALTER TABLE "public"."Article" DROP CONSTRAINT "Article_codeCompteCode_fkey";
DROP INDEX "public"."Article_codeCompteCode_idx";
ALTER TABLE "public"."Article" DROP COLUMN "codeCompteCode";

DROP TABLE "public"."NomenclatureCodeCompte";
DROP TABLE "public"."CodeCompte";
DROP TABLE "public"."ArticleCodeCompte";

-- Retrait de SOA.localite
ALTER TABLE "public"."soas" DROP COLUMN "localite";
