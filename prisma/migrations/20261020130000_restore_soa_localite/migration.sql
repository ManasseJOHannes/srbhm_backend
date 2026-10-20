-- Restauration de la localité du SOA, utilisée par l'en-tête officiel
-- de l'inventaire (« Hôtel du (2) »).
ALTER TABLE "public"."soas" ADD COLUMN "localite" TEXT;
