import { parseHeightCm, formatHeightCm, HEIGHT_MIN_CM, HEIGHT_MAX_CM } from './height.util';

describe('parseHeightCm', () => {
  it('legge un intero', () => {
    expect(parseHeightCm('180')).toEqual({ ok: true, value: 180 });
  });

  it('legge la virgola italiana senza perdere il decimale', () => {
    expect(parseHeightCm('180,5')).toEqual({ ok: true, value: 180.5 });
  });

  it('accetta anche il punto', () => {
    expect(parseHeightCm('180.5')).toEqual({ ok: true, value: 180.5 });
  });

  it('ignora gli spazi intorno', () => {
    expect(parseHeightCm('  178  ')).toEqual({ ok: true, value: 178 });
  });

  it('tratta il campo vuoto come "non impostata", non come errore', () => {
    expect(parseHeightCm('')).toEqual({ ok: true, value: null });
    expect(parseHeightCm('   ')).toEqual({ ok: true, value: null });
    expect(parseHeightCm(null)).toEqual({ ok: true, value: null });
    expect(parseHeightCm(undefined)).toEqual({ ok: true, value: null });
  });

  it('rifiuta cio\' che non e\' un numero', () => {
    expect(parseHeightCm('alto')).toEqual({ ok: false, reason: 'nan' });
  });

  // Il caso che la forbice esiste per prendere: chi scrive i metri.
  it('rifiuta i metri invece dei centimetri', () => {
    expect(parseHeightCm('1,80')).toEqual({ ok: false, reason: 'range' });
  });

  it('rifiuta i valori fuori dalla forbice', () => {
    expect(parseHeightCm('99')).toEqual({ ok: false, reason: 'range' });
    expect(parseHeightCm('251')).toEqual({ ok: false, reason: 'range' });
  });

  it('accetta gli estremi della forbice', () => {
    expect(parseHeightCm(String(HEIGHT_MIN_CM))).toEqual({ ok: true, value: HEIGHT_MIN_CM });
    expect(parseHeightCm(String(HEIGHT_MAX_CM))).toEqual({ ok: true, value: HEIGHT_MAX_CM });
  });

  it('arrotonda al decimo', () => {
    expect(parseHeightCm('180,44')).toEqual({ ok: true, value: 180.4 });
  });
});

describe('formatHeightCm', () => {
  it('scrive con la virgola', () => {
    expect(formatHeightCm(180.5)).toBe('180,5');
  });

  it('non mette decimali dove non servono', () => {
    expect(formatHeightCm(180)).toBe('180');
  });

  it('rende il vuoto per un\'altezza non impostata', () => {
    expect(formatHeightCm(null)).toBe('');
    expect(formatHeightCm(undefined)).toBe('');
  });

  it('torna indietro da quello che parseHeightCm ha letto', () => {
    const parsed = parseHeightCm('180,5');
    expect(parsed.ok && formatHeightCm(parsed.value)).toBe('180,5');
  });
});
