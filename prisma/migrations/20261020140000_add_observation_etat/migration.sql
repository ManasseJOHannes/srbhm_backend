-- État physique de la matière, séparé des pièces justificatives
-- conservées dans la colonne "observation".
ALTER TABLE "public"."DetailCompteMatiere"
ADD COLUMN "observationEtat" TEXT NOT NULL DEFAULT 'Bon état';

-- Les anciennes valeurs qui étaient déjà des états sont déplacées vers
-- la nouvelle colonne pour éviter un doublon dans l'interface.
UPDATE "public"."DetailCompteMatiere"
SET "observationEtat" = TRIM("observation"),
    "observation" = NULL
WHERE TRIM("observation") IN (
  'Bon état',
  'État moyen',
  'Mauvais état',
  'Hors service'
);
