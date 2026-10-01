import { describe, it, expect } from 'vitest';
import {
  wheelValues, wheelIndexAt, wheelOffsetOfIndex, wheelIndexOf, snapToStep
} from './wheel.util';

const KG = { min: 0, max: 200, step: 0.5 };
const RIP = { min: 1, max: 40, step: 1 };

describe('wheelValues', () => {
  it('copre la forbice col passo chiesto', () => {
    const v = wheelValues(KG);
    expect(v[0]).toBe(0);
    expect(v[1]).toBe(0.5);
    expect(v[v.length - 1]).toBe(200);
    expect(v.length).toBe(401);
  });

  it('non accumula errore sommando mezzi chili', () => {
    // Sommando 0,5 duecento volte si arriva a 99,99999999999: qui si conta
    // per indici, quindi il 100 e' 100.
    const v = wheelValues(KG);
    expect(v.includes(100)).toBe(true);
    expect(v.includes(37.5)).toBe(true);
    expect(v.some(x => x.toString().length > 5)).toBe(false);
  });

  it('le ripetizioni partono da uno e vanno di uno', () => {
    const v = wheelValues(RIP);
    expect(v[0]).toBe(1);
    expect(v.length).toBe(40);
  });

  it('un valore scritto a mano fuori griglia entra al posto suo', () => {
    const v = wheelValues(KG, 32.3);
    const i = v.indexOf(32.3);
    expect(i).toBeGreaterThan(-1);
    expect(v[i - 1]).toBe(32);
    expect(v[i + 1]).toBe(32.5);
  });

  it('se il valore e\' gia\' una tacca non lo raddoppia', () => {
    const v = wheelValues(KG, 32.5);
    expect(v.filter(x => x === 32.5).length).toBe(1);
  });

  it('un valore fuori forbice non entra', () => {
    expect(wheelValues(KG, 500).includes(500)).toBe(false);
    expect(wheelValues(KG, -3).includes(-3)).toBe(false);
  });

  it('una forbice impossibile non da\' tacche', () => {
    expect(wheelValues({ min: 10, max: 0, step: 1 })).toEqual([]);
    expect(wheelValues({ min: 0, max: 10, step: 0 })).toEqual([]);
  });
});

describe('scorrimento e tacche', () => {
  it('lo scorrimento diventa la tacca al centro', () => {
    expect(wheelIndexAt(0, 36, 10)).toBe(0);
    expect(wheelIndexAt(36, 36, 10)).toBe(1);
    expect(wheelIndexAt(54, 36, 10)).toBe(2);   // oltre meta' tacca, si arrotonda
    expect(wheelIndexAt(53, 36, 10)).toBe(1);
  });

  it('non esce dall\'elenco nemmeno scorrendo oltre', () => {
    expect(wheelIndexAt(-100, 36, 10)).toBe(0);
    expect(wheelIndexAt(99999, 36, 10)).toBe(9);
  });

  it('andata e ritorno tornano allo stesso punto', () => {
    const off = wheelOffsetOfIndex(7, 36);
    expect(off).toBe(252);
    expect(wheelIndexAt(off, 36, 20)).toBe(7);
  });
});

describe('wheelIndexOf', () => {
  it('trova la tacca esatta', () => {
    expect(wheelIndexOf(wheelValues(KG), 30)).toBe(60);
  });

  it('senza tacca esatta prende la piu\' vicina', () => {
    const v = wheelValues(KG);
    expect(v[wheelIndexOf(v, 32.3)]).toBe(32.5);
    expect(v[wheelIndexOf(v, 32.2)]).toBe(32);
  });

  it('senza valore o senza elenco non indica niente', () => {
    expect(wheelIndexOf([], 10)).toBe(-1);
    expect(wheelIndexOf([1, 2], null)).toBe(-1);
    expect(wheelIndexOf([1, 2], NaN)).toBe(-1);
  });
});

describe('snapToStep', () => {
  it('riporta sulla griglia', () => {
    expect(snapToStep(32.3, KG)).toBe(32.5);
    expect(snapToStep(32.2, KG)).toBe(32);
    expect(snapToStep(12.6, RIP)).toBe(13);
  });

  it('taglia agli estremi', () => {
    expect(snapToStep(-5, KG)).toBe(0);
    expect(snapToStep(9999, KG)).toBe(200);
    expect(snapToStep(0, RIP)).toBe(1);
  });
});
