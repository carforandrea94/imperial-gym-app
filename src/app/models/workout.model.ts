export interface MuscleInfo {
  color: string;
  dim: string;
}

export interface Exercise {
  name: string;
  scheme: 'wave' | 'plain';
  sets: number;
  muscle: string;
  text?: string;
  reps?: (number | string)[];
  note?: string;
  /** Solo per scheme 'wave': progressione settimanale specifica di questo esercizio. */
  weekPlan?: WeekPlan[];
}

export interface Day {
  id: string;
  label: string;
  rec: string;
  ex: Exercise[];
}

export interface WeekPlan {
  sets: number;
  reps: number;
}

export interface ExerciseState {
  loads: (string | null)[];
  reps: (string | null)[];
  done: boolean[];
}

export interface WorkoutSession {
  dayId: string;
  dayLabel: string;
  date: string;
  exercises: {
    name: string;
    sets: { load: string | null; reps: string | null; done: boolean }[];
  }[];
  /** Durata della sessione in secondi. Assente nelle sedute salvate prima di
   *  questa feature: dove manca, la durata semplicemente non viene mostrata. */
  durationSec?: number;
}

/**
 * Seduta utilizzabile a partire dal documento cosi' com'e' su Firestore.
 *
 * Serve perche' un documento puo' essere incompleto — una scrittura
 * interrotta, un campo aggiunto dopo, un documento finito li' per sbaglio — e
 * chi legge non deve difendersi da ogni singolo campo. Prima non era cosi': un
 * solo documento senza `exercises` faceva esplodere la reduce che conta le
 * serie, e con lei l'INTERO storico, che mostrava "Errore nel caricamento"
 * come se non ci fosse piu' niente.
 *
 * Senza data la seduta non si puo' collocare in nessuna settimana e non si
 * puo' nemmeno mostrare: quella si scarta. Tutto il resto si ricostruisce
 * vuoto, cosi' la seduta compare comunque nell'elenco e la si puo' aprire o
 * cancellare.
 */
export function normalizeSession(raw: any): WorkoutSession | null {
  if (!raw || typeof raw.date !== 'string' || !raw.date) return null;

  const text = (v: unknown) => (typeof v === 'string' ? v : null);
  const exercises = (Array.isArray(raw.exercises) ? raw.exercises : []).map((ex: any) => ({
    name: typeof ex?.name === 'string' ? ex.name : '',
    sets: (Array.isArray(ex?.sets) ? ex.sets : []).map((set: any) => ({
      load: text(set?.load),
      reps: text(set?.reps),
      done: !!set?.done
    }))
  }));

  const session: WorkoutSession = {
    dayId: typeof raw.dayId === 'string' ? raw.dayId : '',
    dayLabel: typeof raw.dayLabel === 'string' ? raw.dayLabel : '',
    date: raw.date,
    exercises
  };
  // Le sedute salvate prima del cronometro non hanno la durata: il campo resta
  // assente invece di diventare uno zero che sembrerebbe una seduta lampo.
  if (typeof raw.durationSec === 'number' && raw.durationSec > 0) session.durationSec = raw.durationSec;
  return session;
}

export interface ExInsight {
  lastText: string;
  suggestion: string | null;
}
