/** États physiques proposés dans le recensement. */
export const ETATS_MATIERE = [
  'Bon état',
  'État moyen',
  'Mauvais état',
  'Hors service',
] as const;

export type EtatMatiere = (typeof ETATS_MATIERE)[number];

export const ETAT_MATIERE_DEFAUT: EtatMatiere = 'Bon état';

export function estEtatMatiere(value: unknown): value is EtatMatiere {
  return (
    typeof value === 'string' &&
    (ETATS_MATIERE as readonly string[]).includes(value)
  );
}
