import {
  ecritureObservationLot,
  normaliserTexteObservation,
  observationOrigineChaine,
  type LotAvecObservation,
} from './observation-stock.helper.js';

function lots(
  entries: Array<{
    id: number;
    lotParentId?: number | null;
    observation?: string | null;
  }>,
) {
  return new Map<number, LotAvecObservation>(
    entries.map((entry) => [
      entry.id,
      {
        id: entry.id,
        lotParentId: entry.lotParentId ?? null,
        observation: entry.observation ?? null,
      },
    ]),
  );
}

describe('observation-stock.helper', () => {
  it('normalise les textes vides vers null sans inventer de valeur', () => {
    expect(normaliserTexteObservation('  Achat initial 2000  ')).toBe('Achat initial 2000');
    expect(normaliserTexteObservation('   ')).toBeNull();
    expect(normaliserTexteObservation(null)).toBeNull();
    expect(normaliserTexteObservation(undefined)).toBeNull();
  });

  it("n'écrit aucune observation quand le texte est vide", () => {
    expect(ecritureObservationLot('   ')).toEqual({});
    expect(ecritureObservationLot('Don reçu en 2026')).toEqual({
      observation: 'Don reçu en 2026',
    });
  });

  it('scénario A : un report conserve l’observation du lot d’origine sur toute la chaîne', () => {
    const stock = lots([
      { id: 1, observation: 'Achat initial 2000' },
      { id: 2, lotParentId: 1 },
      { id: 3, lotParentId: 2 },
      { id: 4, lotParentId: 3 },
    ]);
    expect(observationOrigineChaine(stock, 4)).toBe('Achat initial 2000');
    expect(observationOrigineChaine(stock, 2)).toBe('Achat initial 2000');
  });

  it('ne retient jamais l’observation d’un lot intermédiaire modifié', () => {
    const stock = lots([
      { id: 1, observation: 'Achat initial 2000' },
      { id: 2, lotParentId: 1, observation: 'Mention intermédiaire modifiée' },
      { id: 3, lotParentId: 2 },
    ]);
    expect(observationOrigineChaine(stock, 3)).toBe('Achat initial 2000');
    expect(observationOrigineChaine(stock, 2)).toBe('Achat initial 2000');
  });

  it('retourne null sans emprunter à un autre lot (parent manquant, cycle, racine vide)', () => {
    expect(observationOrigineChaine(lots([{ id: 9, lotParentId: 999 }]), 9)).toBeNull();
    expect(
      observationOrigineChaine(lots([{ id: 7, lotParentId: 8 }, { id: 8, lotParentId: 7 }]), 7),
    ).toBeNull();
    expect(observationOrigineChaine(lots([{ id: 5 }]), 5)).toBeNull();
    expect(observationOrigineChaine(lots([]), 42)).toBeNull();
  });
});
