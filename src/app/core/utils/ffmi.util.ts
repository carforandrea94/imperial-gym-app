import { Sex } from '../models/user.model';

/**
 * FFMI — indice di massa magra.
 *
 * E' il BMI che il muscolo lo vede: stesso rapporto sull'altezza al quadrato,
 * ma calcolato sulla sola massa magra invece che sul peso intero. Due persone
 * con lo stesso BMI possono avere corpi opposti; due persone con lo stesso
 * FFMI hanno davvero costruito la stessa quantita' di muscolo.
 *
 * Serve la percentuale di grasso, quindi arriva in fondo alla catena: pliche,
 * sesso ed eta' danno il grasso, il grasso col peso da' la massa magra, la
 * massa magra con l'altezza da' l'FFMI. Senza uno qualsiasi di quei pezzi non
 * c'e' numero.
 */

/**
 * L'FFMI grezzo penalizza i bassi e premia gli alti, perche' la massa magra
 * non scala col quadrato dell'altezza. La correzione riporta tutti all'altezza
 * di riferimento di 1,80 m.
 *
 * Coefficiente e altezza vengono da Kouri et al. (1995), lo studio da cui
 * arrivano anche le fasce: "a correction of 6.3 x (1.80 m - height) is added
 * to normalize these values to the height of a 1.8-m man".
 */
export const FFMI_REF_HEIGHT_M = 1.80;
export const FFMI_NORM_COEFF = 6.3;

export type FfmiClass = 'sotto' | 'media' | 'buona' | 'molta' | 'fuoriscala';

export const FFMI_CLASS_LABELS: Record<FfmiClass, string> = {
  sotto: 'sotto la media',
  media: 'nella media',
  buona: 'buona muscolatura',
  molta: 'molto muscoloso',
  fuoriscala: 'fuori dalla scala comune'
};

/**
 * Le soglie, in FFMI normalizzato.
 *
 * Uomini — Kouri et al. 1995 su 157 atleti: i non dopati stavano a 21,8 ± 1,8
 * e nessuno superava 25,0.
 *
 * Donne — la scala e' tutt'altra e va presa da altrove: Schutz e Kyle
 * (percentili su caucasici 18-98 anni) danno 14,6-16,8 per le donne di BMI
 * normale e 15,4 di mediana fra i 18 e i 34 anni; le atlete universitarie
 * stanno a 16,9 ± 1,7. Usare le soglie maschili le metterebbe tutte "sotto la
 * media", che e' il classico errore di una scala presa in prestito.
 */
const THRESHOLDS: Record<Sex, [number, number, number, number]> = {
  m: [18, 20, 22, 25],
  f: [14.5, 16.5, 18, 20]
};

/**
 * I chili che non sono grasso, senza arrotondare: e' il valore che entra nel
 * calcolo. Arrotondare qui e poi di nuovo sull'FFMI farebbe scivolare il
 * risultato di un decimo per via di un numero che l'utente non vede nemmeno.
 */
function leanRaw(
  weightKg: number | null | undefined,
  bodyFatPct: number | null | undefined
): number | null {
  if (!weightKg || !isFinite(weightKg) || weightKg <= 0) return null;
  if (bodyFatPct === null || bodyFatPct === undefined || !isFinite(bodyFatPct)) return null;
  if (bodyFatPct < 0 || bodyFatPct >= 100) return null;
  return weightKg * (1 - bodyFatPct / 100);
}

/** I chili che non sono grasso, come si mostrano. */
export function leanMassKg(
  weightKg: number | null | undefined,
  bodyFatPct: number | null | undefined
): number | null {
  const lean = leanRaw(weightKg, bodyFatPct);
  return lean === null ? null : Math.round(lean * 10) / 10;
}

/**
 * L'FFMI gia' normalizzato all'altezza di riferimento, arrotondato al decimo.
 * Non esiste una versione grezza esposta: le fasce valgono per il
 * normalizzato, e avere in giro due numeri quasi uguali con significati
 * diversi e' un invito a confonderli.
 */
export function ffmi(
  weightKg: number | null | undefined,
  heightCm: number | null | undefined,
  bodyFatPct: number | null | undefined
): number | null {
  const lean = leanRaw(weightKg, bodyFatPct);
  if (lean === null) return null;
  if (!heightCm || !isFinite(heightCm) || heightCm <= 0) return null;
  const m = heightCm / 100;
  const raw = lean / (m * m);
  const normalized = raw + FFMI_NORM_COEFF * (FFMI_REF_HEIGHT_M - m);
  if (!isFinite(normalized) || normalized <= 0) return null;
  return Math.round(normalized * 10) / 10;
}

/** La fascia, sulla scala del proprio sesso. */
export function ffmiClass(normalized: number, sex: Sex): FfmiClass {
  const [a, b, c, d] = THRESHOLDS[sex];
  if (normalized < a) return 'sotto';
  if (normalized < b) return 'media';
  if (normalized < c) return 'buona';
  if (normalized < d) return 'molta';
  return 'fuoriscala';
}

/** L'FFMI come lo si scrive in italiano, con la virgola. */
export function formatFfmi(value: number): string {
  return (Math.round(value * 10) / 10).toString().replace('.', ',');
}
