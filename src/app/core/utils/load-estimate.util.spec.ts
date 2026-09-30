import { describe, it, expect } from 'vitest';
import {
  estimateOneRepMax, loadAtReps, loadForReps, bestSet, suggestLoad,
  oneRepMaxOf, rmTable, RM_TABLE_MAX_REPS
} from './load-estimate.util';

describe('load-estimate', () => {
  it('stima il massimale con la formula di Brzycki', () => {
    // 36 kg x 6 -> 36 * 36 / (37 - 6) = 41,81
    expect(estimateOneRepMax(36, 6)).toBeCloseTo(41.806, 3);
  });

  it('una singola E\' il massimale, senza correzioni', () => {
    // Il punto per cui questa formula e' stata scelta al posto di Epley, che
    // qui restituirebbe 51,67 kg e poi, chiedendole il carico per una
    // ripetizione, tornerebbe a 50.
    expect(estimateOneRepMax(50, 1)).toBe(50);
  });

  it('scarta le serie da cui non si puo\' stimare nulla', () => {
    expect(estimateOneRepMax(0, 6)).toBe(0);
    expect(estimateOneRepMax(36, 0)).toBe(0);
    expect(estimateOneRepMax(-10, 6)).toBe(0);
    expect(estimateOneRepMax(NaN, 6)).toBe(0);
    // Oltre le 12 ripetizioni la formula mente: meglio nessun numero
    expect(estimateOneRepMax(20, 13)).toBe(0);
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
      { load: 36, reps: 6 },   // 41,8
      { load: 40, reps: 3 },   // 42,4  <- vince pur avendo meno volume
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

/**
 * Le sette formule classiche (Epley, Brzycki, Lander, Lombardi, O'Conner,
 * Mayhew, Wathen) concordano entro il 7% fino a dieci ripetizioni e divergono
 * dopo: 11,8% a dodici, 21,9% a quindici. Il numero si stima solo dentro la
 * finestra in cui quale formula si usi non cambia la sostanza.
 */
describe('oneRepMaxOf', () => {
  it('prende la serie che esprime il massimale piu\' alto, non il carico piu\' alto', () => {
    // 40x3 vale 42,35, 36x6 vale 41,81: vince il primo anche se pesa meno.
    const r = oneRepMaxOf([{ load: 36, reps: 6 }, { load: 40, reps: 3 }])!;
    expect(r.from).toEqual({ load: 40, reps: 3 });
    expect(r.value).toBe(42.5);
  });

  it('arrotonda al mezzo chilo', () => {
    // 80 * 36 / 31 = 92,903 -> 93
    expect(oneRepMaxOf([{ load: 80, reps: 6 }])!.value).toBe(93);
  });

  it('dodici ripetizioni si stimano ancora', () => {
    // 50 * 36 / 25 = 72
    expect(oneRepMaxOf([{ load: 50, reps: 12 }])!.value).toBe(72);
  });

  /* A quindici lo scarto fra le formule e' del 22%: non e' piu' una stima. */
  it('oltre le dodici non si stima niente', () => {
    expect(oneRepMaxOf([{ load: 50, reps: 13 }])).toBeNull();
    expect(oneRepMaxOf([{ load: 50, reps: 20 }])).toBeNull();
  });

  it('una serie lunga non nasconde una corta utilizzabile', () => {
    const r = oneRepMaxOf([{ load: 30, reps: 20 }, { load: 60, reps: 5 }])!;
    expect(r.from).toEqual({ load: 60, reps: 5 });
  });

  it('senza niente di valido non inventa un numero', () => {
    expect(oneRepMaxOf([])).toBeNull();
    expect(oneRepMaxOf([{ load: 0, reps: 5 }])).toBeNull();
    expect(oneRepMaxOf([{ load: 50, reps: 0 }])).toBeNull();
  });
});

/**
 * La tabella dei massimali. Le percentuali che ne escono - 100, 97, 94, 92,
 * 89, 86, 83, 81, 78, 75, 72, 69, 67, 64, 61 - sono quelle della tabella
 * appesa al muro in palestra: e' la stessa formula.
 */
describe('rmTable', () => {
  it('copre tutte le ripetizioni da 1 a 15', () => {
    const t = rmTable(100);
    expect(t.length).toBe(RM_TABLE_MAX_REPS);
    expect(t[0].reps).toBe(1);
    expect(t[t.length - 1].reps).toBe(15);
  });

  it('la riga di una ripetizione E\' il massimale', () => {
    expect(rmTable(93)[0].load).toBe(93);
    expect(rmTable(93)[0].percent).toBe(100);
  });

  it('da\' le percentuali classiche del massimale', () => {
    const t = rmTable(100);
    expect(t.map(r => r.percent)).toEqual(
      [100, 97, 94, 92, 89, 86, 83, 81, 78, 75, 72, 69, 67, 64, 61]
    );
    expect(t[9].load).toBe(75);    // 10 ripetizioni: 75% di 100
    expect(t[14].load).toBe(61);   // 15 ripetizioni: 61%
  });

  it('riproduce la serie da cui il massimale e\' stato stimato', () => {
    // Chi ha fatto 80 x 6 deve trovare 80 alla riga "6": una tabella che gli
    // dicesse un altro numero sarebbe smentita dal peso che ha in mano.
    const stima = oneRepMaxOf([{ load: 80, reps: 6 }])!;
    const riga = rmTable(stima.value).find(r => r.reps === 6)!;
    expect(riga.load).toBe(80);
  });

  it('il carico scende monotono al crescere delle ripetizioni', () => {
    const t = rmTable(120);
    for (let i = 1; i < t.length; i++) expect(t[i].load).toBeLessThan(t[i - 1].load);
  });

  it('arrotonda al mezzo chilo', () => {
    rmTable(97.5).forEach(r => expect(r.load * 2 % 1).toBe(0));
  });

  it('senza massimale non c\'e\' tabella', () => {
    expect(rmTable(0)).toEqual([]);
    expect(rmTable(-10)).toEqual([]);
    expect(rmTable(NaN)).toEqual([]);
  });

  it('loadAtReps non arrotonda al bilanciere, resta al mezzo chilo', () => {
    expect(loadAtReps(100, 5)).toBe(89);       // 100 * 32/36 = 88,89
    expect(loadAtReps(100, 0)).toBe(0);
    expect(loadAtReps(0, 5)).toBe(0);
  });
});
