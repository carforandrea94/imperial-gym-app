/**
 * Passare da una scheda all'altra con una passata del pollice.
 *
 * Qui c'e' solo la decisione: se quel movimento e' una passata e, se lo e',
 * dove porta. Chi ascolta il dito sta altrove, e questa parte si puo'
 * provare senza un dito.
 */

/** Quanto deve essere lungo, in px. Sotto, e' un tocco che e' scivolato. */
export const SWIPE_MIN_X = 60;

/**
 * Quanto puo' pendere. Il pollice non fa linee rette: fino a mezza altezza
 * per unita' di larghezza resta una passata laterale, oltre e' la pagina che
 * si sta scorrendo e non va interrotta.
 */
export const SWIPE_MAX_SLOPE = 0.5;

/**
 * Oltre questo tempo non e' piu' una passata ma un trascinamento: spesso e'
 * un dito appoggiato mentre si legge, e cambiare pagina sarebbe un agguato.
 */
export const SWIPE_MAX_MS = 700;

export type SwipeDir = 'prev' | 'next' | null;

export function swipeDirection(dx: number, dy: number, ms: number): SwipeDir {
  if (ms > SWIPE_MAX_MS) return null;
  if (Math.abs(dx) < SWIPE_MIN_X) return null;
  if (Math.abs(dy) > Math.abs(dx) * SWIPE_MAX_SLOPE) return null;
  // Il dito va a sinistra: il contenuto si sposta a sinistra, quindi arriva
  // quello dopo. E' il verso di tutte le tabbar che si sfogliano.
  return dx < 0 ? 'next' : 'prev';
}

/**
 * La scheda dove si arriva, o null se non ce n'e' una.
 *
 * Alla prima e all'ultima ci si ferma: girare dall'ultima alla prima farebbe
 * attraversare tutta l'app con un gesto, e nessuno sa piu' dov'e'.
 */
export function nextTab(tabs: readonly string[], current: string, dir: SwipeDir): string | null {
  if (!dir) return null;
  const i = tabs.indexOf(current);
  if (i === -1) return null;
  const j = dir === 'next' ? i + 1 : i - 1;
  return tabs[j] ?? null;
}

/**
 * Da dove NON deve partire una passata.
 *
 * Dentro un elenco che scorre DI LATO il gesto e' gia' di qualcun altro;
 * sopra un campo o dentro un foglio aperto, cambiare pagina sarebbe un
 * agguato.
 *
 * `.wheel` stava in questo elenco e non ci sta piu'. Ci era finita per la
 * ruota dell'altezza, che pero' vive dentro un .bottomsheet ed e' gia'
 * coperta da quello. Da quando carico e ripetizioni si scelgono con la ruota,
 * ogni serie aperta ne ha due, larghe, in mezzo allo schermo: il pollice
 * partiva quasi sempre da li' e la passata fra le sezioni non partiva mai.
 *
 * Girare la ruota non cambia sezione lo stesso: una rotellata e' quasi tutta
 * verticale, e swipeDirection chiede che lo spostamento di lato sia almeno il
 * doppio di quello in su e in giu'.
 */
export const SWIPE_BLOCKERS = '.exslider, .bottomsheet, input, select, textarea';

export function startsOnBlocker(target: EventTarget | null): boolean {
  const el = target as Element | null;
  return !!el?.closest?.(SWIPE_BLOCKERS);
}
