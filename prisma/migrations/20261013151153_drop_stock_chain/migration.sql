-- DropForeignKey
ALTER TABLE "public"."AffectationSortie" DROP CONSTRAINT "AffectationSortie_lotStockId_fkey";

-- DropForeignKey
ALTER TABLE "public"."AffectationSortie" DROP CONSTRAINT "AffectationSortie_mouvementSortieId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Article" DROP CONSTRAINT "Article_nomenclatureId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CompteMatiere" DROP CONSTRAINT "CompteMatiere_exerciceId_fkey";

-- DropForeignKey
ALTER TABLE "public"."DetailCompteMatiere" DROP CONSTRAINT "DetailCompteMatiere_articleId_fkey";

-- DropForeignKey
ALTER TABLE "public"."DetailCompteMatiere" DROP CONSTRAINT "DetailCompteMatiere_compteMatiereId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Inventaire" DROP CONSTRAINT "Inventaire_exerciceId_fkey";

-- DropForeignKey
ALTER TABLE "public"."LigneInventaire" DROP CONSTRAINT "LigneInventaire_articleId_fkey";

-- DropForeignKey
ALTER TABLE "public"."LigneInventaire" DROP CONSTRAINT "LigneInventaire_inventaireId_fkey";

-- DropForeignKey
ALTER TABLE "public"."LotStock" DROP CONSTRAINT "LotStock_articleId_fkey";

-- DropForeignKey
ALTER TABLE "public"."LotStock" DROP CONSTRAINT "LotStock_detailCompteMatiereId_fkey";

-- DropForeignKey
ALTER TABLE "public"."LotStock" DROP CONSTRAINT "LotStock_exerciceId_fkey";

-- DropForeignKey
ALTER TABLE "public"."LotStock" DROP CONSTRAINT "LotStock_lotParentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."LotStock" DROP CONSTRAINT "LotStock_mouvementEntreeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Mouvement" DROP CONSTRAINT "Mouvement_articleId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Mouvement" DROP CONSTRAINT "Mouvement_exerciceId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ObservationStock" DROP CONSTRAINT "ObservationStock_lotStockId_fkey";

-- DropTable
DROP TABLE "public"."AffectationSortie";

-- DropTable
DROP TABLE "public"."Article";

-- DropTable
DROP TABLE "public"."CompteMatiere";

-- DropTable
DROP TABLE "public"."DetailCompteMatiere";

-- DropTable
DROP TABLE "public"."Inventaire";

-- DropTable
DROP TABLE "public"."LigneInventaire";

-- DropTable
DROP TABLE "public"."LotStock";

-- DropTable
DROP TABLE "public"."Mouvement";

-- DropTable
DROP TABLE "public"."Nomenclature";

-- DropTable
DROP TABLE "public"."ObservationStock";

-- DropEnum
DROP TYPE "public"."TypeMouvement";

-- DropEnum
DROP TYPE "public"."TypeOrigineLot";
