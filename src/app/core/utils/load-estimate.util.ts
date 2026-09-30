/**
 * Massimale, e carico da usare per un dato numero di ripetizioni.
 *
 * Il problema: 36 kg per 6 ripetizioni e 36 kg per 10 non sono lo stesso
 * sforzo. Per confrontarli si passa dal massimale teorico (1RM), che e' la
 * moneta comune fra schemi diversi: si stima il massimale da una serie
 * realmente fatta, poi lo si riconverte nel carico giusto per le ripetizioni
 * previste.
 *
 * Formula di Brzycki (1993), nelle due direzioni:
 *
 *     1RM     = carico * 36 / (37 - ripetizioni)
 *     carico  = 1RM * (37 - ripetizioni) / 36
 *
 * Perche' questa e non Epley, che sta in ogni app: perche' qui il massimale
 * non si mostra da solo, si mostra insieme al carico per ogni numero di
 * ripetizioni, e in quella tabella Epley si contraddice. Epley dice
 * 1RM = carico * (1 + rip/30), che a una ripetizione sola da' 1RM = 1,033 *
 * carico: la sua inversa, richiesta per una ripetizione, restituisce il 96,8%
 * del massimale. Una tabella che alla riga "1" scrive un numero piu' basso del
 * massimale che ha appena dichiarato non e' difendibile.
 *
 * Brzycki invece vale esattamente 1 a una ripetizione, quindi la riga "1" e'
 * il massimale, e la sua inversa restituisce (37 - rip) / 36: 100%, 97%, 94%,
 * 92%, 89%, 86%, 83%, 81%, 78%, 75%, 72%, 69%, 67%, 64%, 61%. E' la tabella
 * delle percentuali del massimale appesa al muro di qualsiasi palestra - non
 * una variante, la stessa. La formula riproduce anche la serie di partenza:
 * chi ha fatto 80 x 6 trova 80 alla riga "6", ed e' l'unico modo perche' la
 * tabella non sembri sbagliata a chi quel peso l'ha appena sollevato.
 *
 * Il prezzo, dichiarato: sopra le dodici ripetizioni Brzycki e' la piu'
 * generosa delle sette formule classiche (a venti stima il 212% del carico,
 * dove Epley si ferma al 167%). Per questo la SERIE da cui si stima non puo'
 * superare le dodici ripetizioni - vedi MAX_TRUSTED_REPS. E' un limite su cio'
 * che si legge, non su cio' che si proietta: la tabella scende fino a quindici
 * ripetizioni, perche' in quella direzione il numero e' una percentuale del
 * massimale e non una stima fatta su una serie sfiancante.
 */

/** Serie realmente eseguita, gia' convertita in numeri. */
export interface PerformedSet {
  load: number;
  reps: number;
}

/**
 * Oltre questo numero di ripetizioni non si stima piu' niente da una serie.
 *
 * Confrontando le sette formule classiche (Epley, Brzycki, Lander, Lombardi,
 * O'Conner, Mayhew, Wathen) sullo stesso carico, lo scarto fra la piu' alta e
 * la piu' bassa resta sotto il 7% fino a dieci ripetizioni, e poi esplode:
 * 11,8% a dodici, 21,9% a quindici, 45,3% a venti. Oltre le dodici non e' una
 * stima con un margine, e' un'opinione - e a quel punto il limite di chi si
 * allena e' il fiato, non la forza.
 */
export const MAX_TRUSTED_REPS = 12;

/** Fino a quante ripetizioni scende la tabella dei massimali. */
export const RM_TABLE_MAX_REPS = 15;

/** Massimale teorico stimato da una serie. Restituisce 0 se la serie non e' utilizzabile. */
export function estimateOneRepMax(load: number, reps: number): number {
  if (!isFinite(load) || !isFinite(reps)) return 0;
  if (load <= 0 || reps <= 0 || reps > MAX_TRUSTED_REPS) return 0;
  return load * 36 / (37 - reps);
}

/**
 * Carico che corrisponde a un dato numero di ripetizioni, senza arrotondamenti
 * da bilanciere: e' la percentuale del massimale, al mezzo chilo. 0 quando i
 * numeri in ingresso non dicono niente.
 */
export function loadAtReps(oneRepMax: number, reps: number): number {
  if (!isFinite(oneRepMax) || !isFinite(reps)) return 0;
  if (oneRepMax <= 0 || reps <= 0 || reps > 36) return 0;
  return Math.round(oneRepMax * (37 - reps) / 36 * 2) / 2;
}

/** Carico da usare per un dato numero di ripetizioni, arrotondato al passo indicato. */
export function loadForReps(oneRepMax: number, reps: number, step = 5): number {
  if (oneRepMax <= 0 || reps <= 0 || step <= 0) return 0;
  const raw = loadAtReps(oneRepMax, reps);
  const rounded = Math.round(raw / step) * step;
  // Sotto un passo intero non c'e' niente da suggerire: meglio nessun numero
  // che un "0 kg" o un carico piu' pesante di quanto la stima dica.
  return rounded >= step ? rounded : 0;
}

/**
 * Serie di riferimento fra quelle gia' fatte: quella che esprime il massimale
 * piu' alto, non quella col carico piu' alto. Un 40 kg x 3 vale piu' di un
 * 36 kg x 6, e senza questo confronto il primo verrebbe ignorato.
 */
export function bestSet(sets: PerformedSet[]): PerformedSet | null {
  let best: PerformedSet | null = null;
  let bestOrm = 0;
  for (const s of sets) {
    const orm = estimateOneRepMax(s.load, s.reps);
    if (orm > bestOrm) { bestOrm = orm; best = s; }
  }
  return best;
}

export interface LoadSuggestion {
  /** Carico consigliato per `targetReps`, arrotondato. */
  load: number;
  /** Serie da cui e' stato ricavato, per poterlo spiegare a chi legge. */
  from: PerformedSet;
}

/**
 * Carico consigliato per `targetReps`, ricavato dalla migliore serie mai fatta
 * su quell'esercizio. `null` quando lo storico non contiene niente di
 * utilizzabile o quando l'arrotondamento non lascia un numero sensato.
 */
export function suggestLoad(sets: PerformedSet[], targetReps: number, step = 5): LoadSuggestion | null {
  const from = bestSet(sets);
  if (!from || targetReps <= 0) return null;
  const load = loadForReps(estimateOneRepMax(from.load, from.reps), targetReps, step);
  return load > 0 ? { load, from } : null;
}

/** Una riga della tabella: con questo carico si fanno queste ripetizioni. */
export interface RmRow {
  reps: number;
  load: number;
  /** Percentuale del massimale, arrotondata all'unita': serve a leggere la riga. */
  percent: number;
}

/**
 * La tabella dei massimali: per ogni numero di ripetizioni da 1 a
 * RM_TABLE_MAX_REPS, il carico corrispondente. La riga 1 e' il massimale
 * stesso (Brzycki vale esattamente 1 a una ripetizione).
 */
export function rmTable(oneRepMax: number, maxReps = RM_TABLE_MAX_REPS): RmRow[] {
  if (!isFinite(oneRepMax) || oneRepMax <= 0) return [];
  const rows: RmRow[] = [];
  for (let reps = 1; reps <= maxReps; reps++) {
    const load = loadAtReps(oneRepMax, reps);
    if (load > 0) rows.push({ reps, load, percent: Math.round((37 - reps) / 36 * 100) });
  }
  return rows;
}

export interface OneRepMaxEstimate {
  /** Massimale stimato, arrotondato al mezzo chilo. */
  value: number;
  /** La serie da cui viene: senza, il numero non si puo' giudicare. */
  from: PerformedSet;
}

/**
 * Il massimale stimato da un gruppo di serie - tipicamente quelle di una
 * sessione sola - preso dalla migliore, cioe' quella che esprime il massimale
 * piu' alto, non quella col carico piu' alto.
 *
 * Restituisce null quando non c'e' niente di mostrabile: nessuna serie dentro
 * le ripetizioni attendibili, o un carico che non e' un numero.
 *
 * Quello che questa funzione NON puo' sapere: se la serie e' stata portata
 * vicino al cedimento. Tutte queste formule lo danno per scontato, e in
 * un'app dove il carico lo prescrive il coach spesso non e' vero - un 4x10
 * comodo stima un massimale piu' basso del vero. Per questo chi mostra il
 * numero deve mostrare anche da dove viene: e' l'unico modo che ha chi legge
 * per capire quanto crederci.
 */
export function oneRepMaxOf(sets: PerformedSet[]): OneRepMaxEstimate | null {
  const from = bestSet(sets);
  if (!from) return null;
  const value = Math.round(estimateOneRepMax(from.load, from.reps) * 2) / 2;
  return value > 0 ? { value, from } : null;
}
