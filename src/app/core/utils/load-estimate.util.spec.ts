import { describe, it, expect } from 'vitest';
import { estimateOneRepMax, loadForReps, bestSet, suggestLoad } from './load-estimate.util';

describe('load-estimate', () => {
  it('stima il massimale con la formula di Epley', () => {
    // 36 kg x 6 -> 36 * (1 + 6/30) = 43,2
    expect(estimateOneRepMax(36, 6)).toBeCloseTo(43.2, 5);
    // Una singola e' gia' il massimale, a meno del millesimo della formula
    expect(estimateOneRepMax(50, 1)).toBeCloseTo(51.67, 1);
  });

  it('scarta le serie da cui non si puo\' stimare nulla', () => {
    expect(estimateOneRepMax(0, 6)).toBe(0);
    expect(estimateOneRepMax(36, 0)).toBe(0);
    expect(estimateOneRepMax(-10, 6)).toBe(0);
    expect(estimateOneRepMax(NaN, 6)).toBe(0);
    // Oltre le 15 ripetizioni la formula mente: meglio nessun numero
    expect(estimateOneRepMax(20, 20)).toBe(0);
  });

  it('il carico cala quando le ripetizioni salgono', () => {
    const orm = estimateOneRepMax(36, 6);
    expect(loadForReps(orm, 6)).toBe(35);
    expect(loadForReps(orm, 10)).toBe(30);
    expect(loadForReps(orm, 12)).toBe(30);
    // Meno ripetizioni, piu' carico
    expect(loadForReps(orm, 3)).toBeGreaterThan(loadForReps(orm, 10));
  });

  it('arrotonda al passo richiesto', () => {
    const orm = estimateOneRepMax(36, 6);
    expect(loadForReps(orm, 10, 2.5) % 2.5).toBe(0);
    expect(loadForReps(orm, 10, 1) % 1).toBe(0);
  });

  it('non suggerisce carichi sotto un passo intero', () => {
    expect(loadForReps(estimateOneRepMax(2, 8), 10, 5)).toBe(0);
  });

  it('la serie di riferimento e\' quella col massimale piu\' alto, non col carico piu\' alto', () => {
    const sets = [
      { load: 36, reps: 6 },   // 43,2
      { load: 40, reps: 3 },   // 44,0  <- vince pur avendo meno volume
      { load: 30, reps: 10 }   // 40,0
    ];
    expect(bestSet(sets)).toEqual({ load: 40, reps: 3 });
  });

  it('il caso dell\'esempio: 36 kg in un 5x6 diventano 30 kg in un 4x10', () => {
    const s = suggestLoad([{ load: 36, reps: 6 }], 10, 5);
    expect(s).not.toBeNull();
    expect(s!.load).toBe(30);
    expect(s!.from).toEqual({ load: 36, reps: 6 });
  });

  it('senza storico utilizzabile non suggerisce niente', () => {
    expect(suggestLoad([], 10)).toBeNull();
    expect(suggestLoad([{ load: 0, reps: 0 }], 10)).toBeNull();
    expect(suggestLoad([{ load: 36, reps: 6 }], 0)).toBeNull();
  });
});
