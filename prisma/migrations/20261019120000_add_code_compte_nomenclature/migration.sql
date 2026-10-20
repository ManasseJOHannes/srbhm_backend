-- AlterTable
ALTER TABLE "public"."soas" ADD COLUMN "localite" TEXT;

-- CreateTable
CREATE TABLE "public"."ArticleCodeCompte" (
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,

    CONSTRAINT "ArticleCodeCompte_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "public"."CodeCompte" (
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "articleCode" TEXT NOT NULL,

    CONSTRAINT "CodeCompte_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "public"."NomenclatureCodeCompte" (
    "nomenclatureId" INTEGER NOT NULL,
    "codeCompteCode" TEXT NOT NULL,

    CONSTRAINT "NomenclatureCodeCompte_pkey" PRIMARY KEY ("nomenclatureId","codeCompteCode")
);

-- CreateIndex
CREATE INDEX "CodeCompte_articleCode_idx" ON "public"."CodeCompte"("articleCode");

-- Seed : articles budgétaires du chapitre 21
INSERT INTO "public"."ArticleCodeCompte" ("code", "libelle") VALUES
('211', 'Terrains'),
('212', 'Aménagement'),
('213', 'Construction ou Réhabilitation : Bâtiments'),
('214', 'Construction ou Réhabilitation : Voies'),
('215', 'Construction ou Réhabilitation : Réseaux'),
('216', 'Matériels et outillages'),
('217', 'Matériel de transport'),
('218', 'Autres immobilisations corporelles');

-- Seed : codes compte (paragraphes) officiels du chapitre 21
INSERT INTO "public"."CodeCompte" ("code", "libelle", "articleCode") VALUES
('2111', 'Terrains nus', '211'),
('2112', 'Terrains bâtis', '211'),
('2113', 'Terrains de gisement', '211'),
('2114', 'Terrains de chantiers', '211'),
('2115', 'Terrains de voiries', '211'),
('2116', 'Cimetières', '211'),
('2117', 'Bois et forêts', '211'),
('2118', 'Autres', '211'),
('2121', 'Aménagement de terrain', '212'),
('2122', 'Aménagement des aérodromes', '212'),
('2123', 'Aménagement des Ports', '212'),
('2124', 'Travaux d''irrigation', '212'),
('2125', 'Travaux d''urbanisme', '212'),
('2128', 'Autres aménagements', '212'),
('2131', 'Bâtiments administratifs', '213'),
('2132', 'Bâtiments scolaires', '213'),
('2133', 'Bâtiments de centres de soins de santé', '213'),
('2134', 'Autres bâtiments techniques', '213'),
('2137', 'Installations, agencements et aménagements - Bâtiments', '213'),
('2138', 'Autres constructions ou réhabilitations - Bâtiments', '213'),
('2141', 'Routes', '214'),
('2142', 'Voies ferrées', '214'),
('2143', 'Voies d''eau', '214'),
('2144', 'Pistes d''aérodrome', '214'),
('2147', 'Installations, agencements et aménagements - Voies', '214'),
('2148', 'Autres constructions ou réhabilitations - Voies', '214'),
('2151', 'Réseau d''adduction d''eau', '215'),
('2152', 'Réseau d''assainissement', '215'),
('2153', 'Réseau téléphonique', '215'),
('2154', 'Réseau de communication', '215'),
('2155', 'Réseau d''électricité', '215'),
('2156', 'Réseau d''irrigation', '215'),
('2157', 'Installations, agencements et aménagements - Réseaux', '215'),
('2158', 'Autres constructions ou réhabilitations - Réseaux', '215'),
('2161', 'Matériels techniques', '216'),
('2162', 'Matériels agricoles', '216'),
('2163', 'Matériels informatiques', '216'),
('2164', 'Matériels et mobiliers de bureau', '216'),
('2165', 'Matériels et mobiliers de logement', '216'),
('2166', 'Matériels et mobiliers scolaires', '216'),
('2167', 'Outillages', '216'),
('2168', 'Autres matériels et outillages', '216'),
('2171', 'Renouvellement des véhicules du parc administratif', '217'),
('2172', 'Matériel automobile', '217'),
('2173', 'Matériel fluvial', '217'),
('2174', 'Matériel ferroviaire', '217'),
('2175', 'Matériel naval', '217'),
('2176', 'Matériel aérien', '217'),
('2178', 'Autres moyens de locomotion', '217'),
('2181', 'Cheptel', '218'),
('2182', 'Emballages récupérables', '218'),
('2183', 'Installations complexes spécialisées', '218'),
('2188', 'Autres immobilisations corporelles', '218');

-- AlterTable : code compte obligatoire sur les articles existants,
-- valeur provisoire 2164 (les 4 articles de mobilier), supprimée ensuite.
ALTER TABLE "public"."Article" ADD COLUMN "codeCompteCode" TEXT NOT NULL DEFAULT '2164';
ALTER TABLE "public"."Article" ALTER COLUMN "codeCompteCode" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Article_codeCompteCode_idx" ON "public"."Article"("codeCompteCode");

-- Association par défaut : nomenclature 03 Mobilier de bureau → 2164
INSERT INTO "public"."NomenclatureCodeCompte" ("nomenclatureId", "codeCompteCode")
SELECT n."id", c."code"
FROM "public"."Nomenclature" n
CROSS JOIN "public"."CodeCompte" c
WHERE n."code" = '03' AND c."code" = '2164'
ON CONFLICT DO NOTHING;

-- AddForeignKey
ALTER TABLE "public"."CodeCompte" ADD CONSTRAINT "CodeCompte_articleCode_fkey" FOREIGN KEY ("articleCode") REFERENCES "public"."ArticleCodeCompte"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NomenclatureCodeCompte" ADD CONSTRAINT "NomenclatureCodeCompte_nomenclatureId_fkey" FOREIGN KEY ("nomenclatureId") REFERENCES "public"."Nomenclature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NomenclatureCodeCompte" ADD CONSTRAINT "NomenclatureCodeCompte_codeCompteCode_fkey" FOREIGN KEY ("codeCompteCode") REFERENCES "public"."CodeCompte"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Article" ADD CONSTRAINT "Article_codeCompteCode_fkey" FOREIGN KEY ("codeCompteCode") REFERENCES "public"."CodeCompte"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Nettoyage : suppression des 3 articles consommables de la base de recette
-- (4 essence, 6 Parcetamol, 7 Vitamin) et de leur historique de stock
-- (15+1+1 détails, 3+0+1 mouvements, aucune ligne d'inventaire).
DELETE FROM "public"."DetailCompteMatiere" WHERE "articleId" IN (4, 6, 7);
DELETE FROM "public"."Mouvement" WHERE "articleId" IN (4, 6, 7);
DELETE FROM "public"."LigneInventaire" WHERE "articleId" IN (4, 6, 7);
DELETE FROM "public"."Article" WHERE "id" IN (4, 6, 7);

-- Recalcul des comptes matière (mêmes formules que recalculerValeursCompte()).
UPDATE "public"."CompteMatiere" cm
SET "valeurExistanteDebut" = COALESCE((SELECT SUM(d."existantDebut" * d."prixUnitaire") FROM "public"."DetailCompteMatiere" d WHERE d."compteMatiereId" = cm."id"), 0),
    "valeurEntrees" = COALESCE((SELECT SUM(d."entrees" * d."prixUnitaire") FROM "public"."DetailCompteMatiere" d WHERE d."compteMatiereId" = cm."id"), 0),
    "valeurSorties" = COALESCE((SELECT SUM(d."sorties" * d."prixUnitaire") FROM "public"."DetailCompteMatiere" d WHERE d."compteMatiereId" = cm."id"), 0);

UPDATE "public"."CompteMatiere"
SET "valeurRestante" = "valeurExistanteDebut" + "valeurEntrees" - "valeurSorties";
