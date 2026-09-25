/**
 * Le serie di un esercizio durante l'allenamento.
 *
 * Quelle del piano ci sono sempre: sono il lavoro che il coach ha scritto e
 * non si tolgono. Quelle aggiunte a mano sono le uniche che si possono
 * togliere, ed e' `extra` a dire quali sono - non la posizione, che cambia
 * appena se ne aggiunge o se ne leva una.
 */
export interface SerieRow {
  reps: string;
  load: string;
  done: boolean;
  ripPlaceholder: string;
  loadPlaceholder: string;
  /** Aggiunta durante l'allenamento, non prevista dal piano. */
  extra: boolean;
}

/** Com'e' fatta una riga nella bozza salvata: i campi possono mancare. */
export interface DraftRow {
  reps?: string | null;
  load?: string | null;
  done?: boolean;
  extra?: boolean;
}

/**
 * Quante serie puo' arrivare ad avere un esercizio. Non e' un limite
 * dell'allenamento ma della bozza: ogni riga viene riscritta su Firestore a
 * ogni tocco, e un tocco ripetuto per sbaglio non deve poter far crescere il
 * documento senza fine.
 */
export const MAX_SETS_PER_EXERCISE = 20;

export function canAddSet(rows: readonly SerieRow[]): boolean {
  return rows.length < MAX_SETS_PER_EXERCISE;
}

/**
 * La serie aggiunta nasce sul modello dell'ultima: stessi suggerimenti di
 * ripetizioni e carico. Una serie in piu' e' quasi sempre "ancora una come
 * quella", e partire da zero vorrebbe dire ridigitare tutto.
 */
export function buildExtraSet(rows: readonly SerieRow[]): SerieRow {
  const last = rows[rows.length - 1];
  return {
    reps: '',
    load: '',
    done: false,
    // Il valore scritto vale piu' del suggerimento: se l'ultima serie e'
    // andata a 80 kg, la prossima parte da li' e non dal consiglio di prima.
    ripPlaceholder: last ? (last.reps || last.ripPlaceholder) : '',
    loadPlaceholder: last ? (last.load || last.loadPlaceholder) : '',
    extra: true
  };
}

/** Si puo' togliere solo quello che si e' aggiunto: il piano non si tocca. */
export function canRemoveSet(rows: readonly SerieRow[], idx: number): boolean {
  return rows[idx]?.extra === true;
}

/**
 * Toglie una serie aggiunta. Su una serie del piano l'elenco torna uguale a
 * prima: la regola sta qui e non solo nel bottone, cosi' non dipende da quali
 * bottoni la pagina ha disegnato.
 */
export function removeSetAt(rows: readonly SerieRow[], idx: number): SerieRow[] {
  if (!canRemoveSet(rows, idx)) return rows.slice();
  return rows.filter((_, i) => i !== idx);
}

/**
 * Riporta la bozza sulle serie del piano.
 *
 * Oltre il piano ci sono solo le serie aggiunte a mano: si ricreano, se no un
 * refresh a meta' allenamento le farebbe sparire col lavoro che c'e' dentro.
 * Le righe in piu' che la bozza non contrassegna vengono da un piano piu'
 * lungo di prima (il coach ha tolto delle serie) e non appartengono piu' a
 * questo esercizio.
 */
export function mergeDraftRows(rows: readonly SerieRow[], draftRows: readonly DraftRow[]): SerieRow[] {
  const out = rows.map(r => ({ ...r }));
  draftRows.forEach((d, j) => {
    let target: SerieRow | undefined = out[j];
    if (!target) {
      if (!d.extra || !canAddSet(out)) return;
      target = buildExtraSet(out);
      out.push(target);
    }
    target.reps = d.reps ?? '';
    target.load = d.load ?? '';
    target.done = d.done ?? false;
  });
  return out;
}
