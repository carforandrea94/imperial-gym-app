import {
  leanMassKg, ffmi, ffmiClass, formatFfmi,
  FFMI_CLASS_LABELS, FFMI_REF_HEIGHT_M, FFMI_NORM_COEFF
} from './ffmi.util';

describe('leanMassKg', () => {
  it('toglie il grasso dal peso', () => {
    expect(leanMassKg(78.4, 14.6)).toBe(67);
  });

  it('a grasso zero la massa magra e\' tutto il peso', () => {
    expect(leanMassKg(80, 0)).toBe(80);
  });

  it('senza peso o senza grasso non c\'e\' massa magra', () => {
    expect(leanMassKg(null, 14.6)).toBeNull();
    expect(leanMassKg(78.4, null)).toBeNull();
    expect(leanMassKg(78.4, undefined)).toBeNull();
  });

  it('rifiuta valori impossibili', () => {
    expect(leanMassKg(0, 14.6)).toBeNull();
    expect(leanMassKg(-70, 14.6)).toBeNull();
    expect(leanMassKg(78.4, -1)).toBeNull();
    expect(leanMassKg(78.4, 100)).toBeNull();
    expect(leanMassKg(78.4, NaN)).toBeNull();
  });
});

describe('ffmi', () => {
  // All'altezza di riferimento la correzione vale zero: 66,95 / 1,80² = 20,7.
  it('a 1,80 m non corregge niente', () => {
    expect(ffmi(78.4, 180, 14.6)).toBe(20.7);
  });

  it('alza chi e\' piu\' basso del riferimento', () => {
    const basso = ffmi(70, 170, 12)!;
    const m = 1.70;
    const grezzo = leanMassKg(70, 12)! / (m * m);
    expect(basso).toBeGreaterThan(Math.round(grezzo * 10) / 10);
    expect(basso).toBeCloseTo(grezzo + FFMI_NORM_COEFF * (FFMI_REF_HEIGHT_M - m), 1);
  });

  it('abbassa chi e\' piu\' alto del riferimento', () => {
    const m = 1.90;
    const grezzo = leanMassKg(88, 10)! / (m * m);
    expect(ffmi(88, 190, 10)!).toBeLessThan(Math.round(grezzo * 10) / 10);
  });

  /*
   * La correzione e' esattamente quella pubblicata da Kouri: un coefficiente
   * per lo scarto dall'altezza di riferimento, niente di piu'. Non promette
   * che due corpi proporzionali cadano sullo stesso numero — e' un aggiustamento
   * empirico, non una legge di scala.
   */
  it('corregge della quantita\' esatta della formula', () => {
    [160, 170, 180, 190, 200].forEach(cm => {
      const m = cm / 100;
      const grezzo = leanMassKg(70, 14)! / (m * m);
      const atteso = grezzo + FFMI_NORM_COEFF * (FFMI_REF_HEIGHT_M - m);
      expect(ffmi(70, cm, 14)!).toBeCloseTo(atteso, 1);
    });
  });

  it('senza uno dei tre ingressi non c\'e\' FFMI', () => {
    expect(ffmi(null, 180, 14.6)).toBeNull();
    expect(ffmi(78.4, null, 14.6)).toBeNull();
    expect(ffmi(78.4, 180, null)).toBeNull();
  });

  it('non divide per zero', () => {
    expect(ffmi(78.4, 0, 14.6)).toBeNull();
  });
});

describe('ffmiClass', () => {
  it('riconosce le fasce maschili', () => {
    expect(ffmiClass(17, 'm')).toBe('sotto');
    expect(ffmiClass(19, 'm')).toBe('media');
    expect(ffmiClass(21, 'm')).toBe('buona');
    expect(ffmiClass(23.5, 'm')).toBe('molta');
    expect(ffmiClass(26, 'm')).toBe('fuoriscala');
  });

  it('riconosce le fasce femminili', () => {
    expect(ffmiClass(14, 'f')).toBe('sotto');
    expect(ffmiClass(15.5, 'f')).toBe('media');
    expect(ffmiClass(17, 'f')).toBe('buona');
    expect(ffmiClass(19, 'f')).toBe('molta');
    expect(ffmiClass(21, 'f')).toBe('fuoriscala');
  });

  /*
   * Il caso per cui le due scale esistono: a 16 una donna e' nella media,
   * un uomo e' sotto. Con una scala sola tutte le donne finirebbero in fondo.
   */
  it('lo stesso numero non vale lo stesso per i due sessi', () => {
    expect(ffmiClass(16, 'f')).toBe('media');
    expect(ffmiClass(16, 'm')).toBe('sotto');
  });

  it('gli estremi appartengono alla fascia piu\' alta', () => {
    expect(ffmiClass(18, 'm')).toBe('media');
    expect(ffmiClass(25, 'm')).toBe('fuoriscala');
    expect(ffmiClass(14.5, 'f')).toBe('media');
    expect(ffmiClass(20, 'f')).toBe('fuoriscala');
  });

  it('ha un\'etichetta per ogni fascia', () => {
    (['sotto', 'media', 'buona', 'molta', 'fuoriscala'] as const)
      .forEach(k => expect(FFMI_CLASS_LABELS[k]).toBeTruthy());
  });
});

describe('formatFfmi', () => {
  it('scrive con la virgola', () => {
    expect(formatFfmi(20.6)).toBe('20,6');
  });
});
