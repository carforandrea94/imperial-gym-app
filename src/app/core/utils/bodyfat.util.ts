import { Sex } from '../models/user.model';

/**
 * Massa grassa stimata dalle pliche, con Jackson-Pollock a 7 siti e la
 * conversione di Siri.
 *
 * Sette siti sono esattamente quelli che l'app gia' misura: petto, ascellare,
 * tricipite, sottoscapolare, addome, sovrailiaca, gamba. La plica della vita
 * viene raccolta ma non entra in questa formula.
 *
 * Qui il sesso conta davvero — ha due coefficienti diversi — e conta l'eta':
 * sono i due dati per cui il profilo porta `sex` e `birthDate`. Il BMI, che
 * non li usa, resta peso diviso altezza al quadrato per chiunque.
 *
 * Il risultato e' una STIMA su una popolazione di riferimento, non una
 * misura: due plicometristi diversi sullo stesso corpo non danno lo stesso
 * numero. Vale per seguire un andamento, non per un verdetto.
 */

export type Jp7Site =
  | 'petto' | 'ascellare' | 'tricipite' | 'sottoscapolare'
  | 'addome' | 'sovrailiaca' | 'gamba';

export const JP7_SITES: Jp7Site[] = [
  'petto', 'ascellare', 'tricipite', 'sottoscapolare', 'addome', 'sovrailiaca', 'gamba'
];

export const JP7_SITE_LABELS: Record<Jp7Site, string> = {
  petto: 'petto',
  ascellare: 'ascellare',
  tricipite: 'tricipite',
  sottoscapolare: 'sottoscapolare',
  addome: 'addome',
  sovrailiaca: 'sovrailiaca',
  gamba: 'gamba'
};

export type Jp7Sites = Partial<Record<Jp7Site, number | null>>;

export interface BodyFatResult {
  /** Massa grassa in percentuale, arrotondata al decimo. null se manca un dato. */
  pct: number | null;
  /** I siti che non sono stati misurati, in ordine di formula. */
  missing: Jp7Site[];
  /** Cosa manca oltre alle pliche, per dire all'utente dove andare. */
  needsSex: boolean;
  needsAge: boolean;
  /** La somma delle pliche e' fuori dal campo in cui la formula ha senso. */
  outOfRange: boolean;
}

/**
 * Eta' minima per cui questa stima ha senso. Jackson-Pollock e' tarata sugli
 * adulti: sotto, la composizione corporea si muove con lo sviluppo e la
 * formula restituirebbe un numero senza significato invece di un errore.
 */
export const BODYFAT_MIN_AGE = 14;

/**
 * La media dei due lati, o il solo lato misurato. Misurare una plica e' gia'
 * scomodo: chi ne prende una sola non deve perdere l'intera stima.
 */
export function meanSide(sx: number | null, dx: number | null): number | null {
  if (sx !== null && dx !== null) return (sx + dx) / 2;
  return sx !== null ? sx : dx;
}

/**
 * La somma delle pliche oltre cui la formula smette di avere senso.
 *
 * Il polinomio di Jackson-Pollock e' una parabola, e oltre il suo vertice la
 * densita' ricomincia a salire: la stima restituisce MENO grasso man mano che
 * le pliche crescono. A 700 mm dichiara un 13%, che e' il caso peggiore
 * possibile — un numero plausibile che non si distingue da un buon risultato.
 *
 * Il vertice sta dove la derivata si annulla, b/(2c): 395 mm per l'uomo, 419
 * per la donna. Si calcola dai coefficienti invece di scriverlo a mano, cosi'
 * non puo' divergere da loro.
 */
export function jp7SumLimit(sex: Sex): number {
  return sex === 'm'
    ? 0.00043499 / (2 * 0.00000055)
    : 0.00046971 / (2 * 0.00000056);
}

/** Densita' corporea secondo Jackson-Pollock a 7 siti. */
export function bodyDensityJp7(sumMm: number, ageYears: number, sex: Sex): number {
  return sex === 'm'
    ? 1.112 - 0.00043499 * sumMm + 0.00000055 * sumMm * sumMm - 0.00028826 * ageYears
    : 1.097 - 0.00046971 * sumMm + 0.00000056 * sumMm * sumMm - 0.00012828 * ageYears;
}

/** Equazione di Siri: dalla densita' corporea alla percentuale di grasso. */
export function siriBodyFat(density: number): number {
  return 495 / density - 450;
}

/**
 * La stima, oppure l'elenco di cosa le manca.
 *
 * Non restituisce mai un numero parziale: con anche un solo sito mancante la
 * somma sarebbe piu' bassa del vero e la stima direbbe meno grasso di quanto
 * ce n'e'. Meglio dire cosa manca.
 */
export function bodyFatJp7(
  sites: Jp7Sites,
  ageYears: number | null,
  sex: Sex | null | undefined
): BodyFatResult {
  const missing = JP7_SITES.filter(s => {
    const v = sites[s];
    return v === null || v === undefined || !isFinite(v) || v <= 0;
  });
  const needsSex = !sex;
  const needsAge = ageYears === null || ageYears < BODYFAT_MIN_AGE;

  const vuoto = { pct: null, missing, needsSex, needsAge, outOfRange: false };
  if (missing.length || needsSex || needsAge) return vuoto;

  const sum = JP7_SITES.reduce((acc, s) => acc + (sites[s] as number), 0);
  if (sum >= jp7SumLimit(sex as Sex)) return { ...vuoto, outOfRange: true };

  const density = bodyDensityJp7(sum, ageYears as number, sex as Sex);
  if (!isFinite(density) || density <= 0) return { ...vuoto, outOfRange: true };
  // Sotto il vertice la densita' e' troppo alta perche' Siri resti
  // nell'intervallo fisico: un grasso negativo non e' un risultato, e' una
  // somma di pliche che nessun corpo produce.
  const pct = siriBodyFat(density);
  if (!isFinite(pct) || pct <= 0 || pct >= 100) return { ...vuoto, outOfRange: true };

  return { pct: Math.round(pct * 10) / 10, missing, needsSex, needsAge, outOfRange: false };
}

/** La stima come la si scrive in italiano, con la virgola. */
export function formatBodyFat(pct: number): string {
  return (Math.round(pct * 10) / 10).toString().replace('.', ',');
}
