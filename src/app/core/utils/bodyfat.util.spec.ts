import {
  bodyFatJp7, bodyDensityJp7, siriBodyFat, meanSide, formatBodyFat,
  JP7_SITES, BODYFAT_MIN_AGE, Jp7Sites, jp7SumLimit
} from './bodyfat.util';

/** Sette siti che sommano a 100 mm, per avere un caso noto. */
function sites(sum = 100): Jp7Sites {
  const each = sum / JP7_SITES.length;
  return Object.fromEntries(JP7_SITES.map(s => [s, each])) as Jp7Sites;
}

describe('bodyDensityJp7', () => {
  // Valori calcolati a mano dalla formula pubblicata, non ripresi dal codice.
  it('usa il coefficiente maschile', () => {
    expect(bodyDensityJp7(100, 30, 'm')).toBeCloseTo(1.065353, 6);
  });

  it('usa il coefficiente femminile', () => {
    expect(bodyDensityJp7(100, 30, 'f')).toBeCloseTo(1.051781, 6);
  });

  it('la densita\' cala al crescere delle pliche', () => {
    expect(bodyDensityJp7(140, 30, 'm')).toBeLessThan(bodyDensityJp7(70, 30, 'm'));
  });

  it('la densita\' cala al crescere dell\'eta\'', () => {
    expect(bodyDensityJp7(100, 45, 'm')).toBeLessThan(bodyDensityJp7(100, 25, 'm'));
  });
});

describe('siriBodyFat', () => {
  it('converte la densita\' in percentuale', () => {
    expect(siriBodyFat(1.065353)).toBeCloseTo(14.63, 2);
  });
});

describe('bodyFatJp7', () => {
  it('stima il grasso di un uomo', () => {
    expect(bodyFatJp7(sites(100), 30, 'm').pct).toBe(14.6);
    expect(bodyFatJp7(sites(70), 25, 'm').pct).toBe(9.6);
    expect(bodyFatJp7(sites(140), 45, 'm').pct).toBe(21.9);
  });

  it('stima il grasso di una donna', () => {
    expect(bodyFatJp7(sites(100), 30, 'f').pct).toBe(20.6);
    expect(bodyFatJp7(sites(70), 25, 'f').pct).toBe(15.4);
    expect(bodyFatJp7(sites(140), 45, 'f').pct).toBe(27.6);
  });

  // A parita' di pliche ed eta' la stima femminile e' piu' alta: e' la
  // ragione per cui il sesso serve.
  it('a parita\' di tutto, uomo e donna non danno lo stesso numero', () => {
    const uomo = bodyFatJp7(sites(100), 30, 'm').pct!;
    const donna = bodyFatJp7(sites(100), 30, 'f').pct!;
    expect(donna).toBeGreaterThan(uomo);
  });

  it('non stima senza sesso, e lo dice', () => {
    const r = bodyFatJp7(sites(100), 30, null);
    expect(r.pct).toBeNull();
    expect(r.needsSex).toBe(true);
  });

  it('non stima senza eta\', e lo dice', () => {
    const r = bodyFatJp7(sites(100), null, 'm');
    expect(r.pct).toBeNull();
    expect(r.needsAge).toBe(true);
  });

  it('non stima sotto l\'eta\' minima', () => {
    expect(bodyFatJp7(sites(100), BODYFAT_MIN_AGE - 1, 'm').pct).toBeNull();
    expect(bodyFatJp7(sites(100), BODYFAT_MIN_AGE, 'm').pct).not.toBeNull();
  });

  // Il caso che conta: una somma parziale direbbe MENO grasso di quanto ce
  // n'e', e sembrerebbe un buon risultato.
  it('non stima con un sito mancante, e dice quale', () => {
    const parziale = { ...sites(100), gamba: null };
    const r = bodyFatJp7(parziale, 30, 'm');
    expect(r.pct).toBeNull();
    expect(r.missing).toEqual(['gamba']);
  });

  it('elenca i siti mancanti nell\'ordine della formula', () => {
    const r = bodyFatJp7({ petto: 14, addome: 14 }, 30, 'm');
    expect(r.missing).toEqual(['ascellare', 'tricipite', 'sottoscapolare', 'sovrailiaca', 'gamba']);
  });

  it('tratta uno zero come un sito non misurato', () => {
    const r = bodyFatJp7({ ...sites(100), petto: 0 }, 30, 'm');
    expect(r.pct).toBeNull();
    expect(r.missing).toEqual(['petto']);
  });

  // Pliche impossibilmente sottili portano Siri sotto lo zero.
  it('non restituisce una percentuale negativa', () => {
    const r = bodyFatJp7(sites(7), 20, 'm');
    expect(r.pct).toBeNull();
    expect(r.outOfRange).toBe(true);
  });

  /*
   * Il caso peggiore, e la ragione per cui jp7SumLimit esiste: oltre il
   * vertice della parabola la stima SCENDE al crescere delle pliche, e a
   * 700 mm dichiarava un 13% — un numero plausibile da un ingresso assurdo,
   * indistinguibile da un buon risultato.
   */
  it('non stima oltre il vertice della formula', () => {
    (['m', 'f'] as const).forEach(sex => {
      const limite = jp7SumLimit(sex);
      expect(bodyFatJp7(sites(limite - 10), 30, sex).pct).not.toBeNull();
      const oltre = bodyFatJp7(sites(limite + 10), 30, sex);
      expect(oltre.pct).toBeNull();
      expect(oltre.outOfRange).toBe(true);
      expect(bodyFatJp7(sites(700), 60, sex).pct).toBeNull();
    });
  });

  it('dentro il suo campo, piu\' pliche significano piu\' grasso', () => {
    (['m', 'f'] as const).forEach(sex => {
      let prec = 0;
      for (let somma = 40; somma < jp7SumLimit(sex); somma += 20) {
        const pct = bodyFatJp7(sites(somma), 30, sex).pct;
        expect(pct).not.toBeNull();
        expect(pct!).toBeGreaterThan(prec);
        prec = pct!;
      }
    });
  });
});

describe('meanSide', () => {
  it('fa la media dei due lati', () => {
    expect(meanSide(10, 12)).toBe(11);
  });

  it('si accontenta del lato misurato', () => {
    expect(meanSide(10, null)).toBe(10);
    expect(meanSide(null, 12)).toBe(12);
  });

  it('senza nessun lato non c\'e\' valore', () => {
    expect(meanSide(null, null)).toBeNull();
  });
});

describe('formatBodyFat', () => {
  it('scrive con la virgola', () => {
    expect(formatBodyFat(14.6)).toBe('14,6');
  });
});
