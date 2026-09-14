import { describe, it, expect } from 'vitest';
import { normalizeRunGoal, hasRunGoal, emptyRunGoal } from './run.model';

describe('normalizeRunGoal', () => {
  it('tiene i valori validi', () => {
    expect(normalizeRunGoal({ weeklyMinutes: 120, weeklyRuns: 3, note: 'tappeto' }))
      .toEqual({ weeklyMinutes: 120, weeklyRuns: 3, note: 'tappeto' });
  });

  it('un protocollo salvato quando l\'obiettivo era in chilometri riparte da zero minuti', () => {
    // I km non si convertono in minuti senza inventare un passo: il vecchio
    // valore si scarta e il coach reimposta. Le uscite invece si conservano.
    const legacy = { weeklyKm: 30, weeklyRuns: 4, note: 'una lunga la domenica' } as any;

    expect(normalizeRunGoal(legacy)).toEqual({
      weeklyMinutes: 0, weeklyRuns: 4, note: 'una lunga la domenica'
    });
  });

  it('un protocollo senza obiettivo diventa un obiettivo vuoto', () => {
    expect(normalizeRunGoal(undefined)).toEqual(emptyRunGoal());
    expect(normalizeRunGoal(null)).toEqual(emptyRunGoal());
  });

  it('scarta i valori che non sono numeri utili', () => {
    const sporco = { weeklyMinutes: '90', weeklyRuns: -2, note: 7 } as any;
    expect(normalizeRunGoal(sporco)).toEqual({ weeklyMinutes: 0, weeklyRuns: 0, note: '' });
  });
});

describe('hasRunGoal', () => {
  it('basta uno dei due campi perche\' ci sia un obiettivo', () => {
    expect(hasRunGoal({ weeklyMinutes: 120, weeklyRuns: 0 })).toBe(true);
    expect(hasRunGoal({ weeklyMinutes: 0, weeklyRuns: 3 })).toBe(true);
  });

  it('con entrambi a zero la sezione resta un semplice registro', () => {
    expect(hasRunGoal(emptyRunGoal())).toBe(false);
    expect(hasRunGoal(null)).toBe(false);
  });
});
