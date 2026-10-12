/**
 * Sous-ensemble minimal d'un lot pour résoudre son observation d'origine.
 * L'observation est stockée directement sur `LotStock.observation`,
 * uniquement sur les lots d'origine (entrée réelle ou stock initial
 * manuel). Les lots enfants issus des reports annuels gardent ce champ
 * à `null` et héritent par la chaîne `lotParentId` : aucun doublon.
 */
export type LotAvecObservation = {
  id: number;
  lotParentId: number | null;
  observation: string | null;
};

const PROFONDEUR_MAX_CHAINE = 1000;

export function normaliserTexteObservation(
  texte: string | null | undefined,
): string | null {
  const clean = texte?.trim();
  return clean ? clean : null;
}

/**
 * Fragment d'écriture pour la création d'un lot d'origine : la clé
 * `observation` est absente quand le texte est vide (aucune donnée
 * inventée, aucune écriture superflue).
 */
export function ecritureObservationLot(
  texte: string | null | undefined,
): { observation: string } | Record<string, never> {
  const clean = normaliserTexteObservation(texte);
  return clean ? { observation: clean } : {};
}

/**
 * Remonte la chaîne `lotParentId` jusqu'au lot d'origine (racine) et
 * renvoie son observation. L'observation d'un lot intermédiaire modifié
 * n'est jamais retenue : seule la racine fait foi.
 *
 * Retourne `null` si la racine est sans observation, si un parent est
 * introuvable ou si un cycle est détecté : aucune valeur de remplacement
 * n'est empruntée à un autre lot.
 */
export function observationOrigineChaine(
  lots: Map<number, LotAvecObservation>,
  lotId: number,
): string | null {
  const visites = new Set<number>();
  let racine: LotAvecObservation | null = null;
  let courant: number | null = lotId;
  let garde = 0;
  while (
    courant !== null &&
    !visites.has(courant) &&
    garde < PROFONDEUR_MAX_CHAINE
  ) {
    garde += 1;
    visites.add(courant);
    const lot = lots.get(courant);
    if (!lot) {
      racine = null;
      break;
    }
    racine = lot;
    courant = lot.lotParentId;
  }
  if (courant !== null) return null;
  return normaliserTexteObservation(racine?.observation);
}
