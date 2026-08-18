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
