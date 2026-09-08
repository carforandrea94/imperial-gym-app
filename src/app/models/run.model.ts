/** Tipo di uscita: e' il vocabolario che un coach usa gia' a voce. */
export type RunType = 'lento' | 'medio' | 'ripetute';

/** Come e' andata, dal punto di vista di chi corre. */
export type RunEffort = 'facile' | 'giusta' | 'dura';

export interface Run {
  /** ISO yyyy-mm-dd, giorno dell'uscita. */
  date: string;
  distanceKm: number;
  durationSec: number;
  type: RunType;
  effort: RunEffort;
  note?: string;
}

export const RUN_TYPE_LABELS: Record<RunType, string> = {
  lento: 'Lento',
  medio: 'Medio',
  ripetute: 'Ripetute'
};

export const RUN_EFFORT_LABELS: Record<RunEffort, string> = {
  facile: 'Facile',
  giusta: 'Giusta',
  dura: 'Dura'
};

/**
 * Obiettivo settimanale di corsa deciso dal coach. Vive nel protocollo, come
 * la scheda e la dieta: e' il coach a stabilirlo e il cliente lo trova gia'
 * impostato, senza doverlo copiare a mano.
 *
 * Entrambi i campi sono facoltativi nel senso che 0 significa "non impostato":
 * un coach puo' dare solo i chilometri, solo il numero di uscite, o entrambi.
 */
export interface RunGoal {
  /** Chilometri da coprire in una settimana. 0 = nessun obiettivo di distanza. */
  weeklyKm: number;
  /** Numero di uscite in una settimana. 0 = nessun obiettivo di frequenza. */
  weeklyRuns: number;
  /** Indicazione libera del coach ("una lunga la domenica", "ripetute il martedi'"). */
  note?: string;
}

export function emptyRunGoal(): RunGoal {
  return { weeklyKm: 0, weeklyRuns: 0, note: '' };
}

/** true se il coach ha davvero impostato qualcosa: senza, la sezione non mostra obiettivi. */
export function hasRunGoal(goal: RunGoal | null | undefined): boolean {
  return !!goal && (goal.weeklyKm > 0 || goal.weeklyRuns > 0);
}
