/**
 * Forbice plausibile per l'altezza di un adulto, in centimetri.
 *
 * Serve soprattutto a intercettare l'unita' sbagliata: chi scrive "1,80"
 * intende metri, e senza un limite inferiore finirebbe in archivio come una
 * persona alta un centimetro e mezzo. Invece di indovinare cosa intendeva —
 * reinterpretare in silenzio un numero che l'utente ha scritto e' peggio che
 * rifiutarlo — il valore viene respinto e il messaggio dice l'unita'.
 */
export const HEIGHT_MIN_CM = 100;
export const HEIGHT_MAX_CM = 250;

export type HeightParse =
  | { ok: true; value: number | null }
  | { ok: false; reason: 'nan' | 'range' };

/**
 * Legge l'altezza digitata. Il campo vuoto e' un esito valido e vale "non
 * impostata": e' cosi' che si cancella un valore inserito per sbaglio.
 *
 * La virgola italiana e' il separatore che la gente usa davvero, e parseFloat
 * da sola si ferma al primo carattere non numerico perdendo il decimale.
 */
export function parseHeightCm(raw: string | null | undefined): HeightParse {
  const text = (raw ?? '').trim();
  if (!text) return { ok: true, value: null };
  const n = parseFloat(text.replace(',', '.'));
  if (!isFinite(n)) return { ok: false, reason: 'nan' };
  const cm = Math.round(n * 10) / 10;
  if (cm < HEIGHT_MIN_CM || cm > HEIGHT_MAX_CM) return { ok: false, reason: 'range' };
  return { ok: true, value: cm };
}

/** Riporta l'altezza nella forma in cui la gente la scrive, con la virgola. */
export function formatHeightCm(cm: number | null | undefined): string {
  if (cm === null || cm === undefined) return '';
  return (Math.round(cm * 10) / 10).toString().replace('.', ',');
}
