/**
 * Stima del carico da usare quando cambia il numero di ripetizioni.
 *
 * Il problema: 36 kg per 6 ripetizioni e 36 kg per 10 non sono lo stesso
 * sforzo. Per confrontarli si passa dal massimale teorico (1RM), che e' la
 * moneta comune fra schemi diversi: si stima il 1RM da una serie realmente
 * fatta, poi lo si riconverte nel carico giusto per le ripetizioni previste.
 *
 * Formula di Epley (1985), la piu' diffusa in palestra:
 *
 *     1RM = carico * (1 + ripetizioni / 30)
 *
 * e la sua inversa. E' un'approssimazione lineare: resta attendibile entro le
 * ~12 ripetizioni e sovrastima oltre, dove pero' conta piu' il fiato che la
 * forza. Il carico che restituisce e' quello che permette di completare le
 * ripetizioni chieste arrivando a fine serie in difficolta': e' la definizione
 * stessa di "carico per N ripetizioni", non serve nessun margine aggiuntivo.
 */

/** Serie realmente eseguita, gia' convertita in numeri. */
export interface PerformedSet {
  load: number;
  reps: number;
}

/** Oltre questa soglia la formula perde senso: il limite diventa il fiato, non la forza. */
const MAX_TRUSTED_REPS = 15;

/**
 * Oltre questo numero di ripetizioni il massimale non si MOSTRA.
 *
 * E' una soglia piu' stretta di MAX_TRUSTED_REPS, e la ragione e' che stampare
 * un numero e' una promessa piu' grossa che usarlo per scegliere un carico.
 * Confrontando le sette formule classiche sullo stesso carico, lo scarto fra
 * la piu' alta e la piu' bassa resta sotto il 7% fino a dieci ripetizioni, e
 * poi esplode: 11,8% a dodici, 21,9% a quindici, 45,3% a venti. A quel punto
 * non e' una stima con un margine, e' un'opinione.
 *
 * Dentro le dodici, invece, quale formula si usi conta poco: Epley e Brzycki
 * su una serie da cinque differiscono del 4%, e coincidono esattamente a dieci.
 */
export const MAX_REPS_SHOWN = 12;

/** Massimale teorico stimato da una serie. Restituisce 0 se la serie non e' utilizzabile. */
export function estimateOneRepMax(load: number, reps: number): number {
  if (!isFinite(load) || !isFinite(reps)) return 0;
  if (load <= 0 || reps <= 0 || reps > MAX_TRUSTED_REPS) return 0;
  return load * (1 + reps / 30);
}

/** Carico da usare per un dato numero di ripetizioni, arrotondato al passo indicato. */
export function loadForReps(oneRepMax: number, reps: number, step = 5): number {
  if (oneRepMax <= 0 || reps <= 0 || step <= 0) return 0;
  const raw = oneRepMax / (1 + reps / 30);
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
  const usabili = sets.filter(s => s.reps > 0 && s.reps <= MAX_REPS_SHOWN);
  const from = bestSet(usabili);
  if (!from) return null;
  const value = Math.round(estimateOneRepMax(from.load, from.reps) * 2) / 2;
  return value > 0 ? { value, from } : null;
}
