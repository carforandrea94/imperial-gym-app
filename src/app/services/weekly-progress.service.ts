import { Injectable, signal } from '@angular/core';
import { WorkoutSessionsService } from './workout-sessions.service';
import { WorkoutStateService } from './workout-state.service';

/**
 * Quali allenamenti sono gia' stati fatti nella settimana di protocollo in corso.
 *
 * Vive in un servizio e non dentro la pagina per due motivi, entrambi visti
 * accadere: la pagina viene ricreata a ogni ritorno sulla scheda e a ogni
 * rinnovo del token Firebase (onAuthStateChanged riassegna currentUser), e una
 * nuova istanza ripartirebbe senza spunte finche' la sua lettura non risponde
 * — o per sempre, se quella lettura fallisce. Qui il valore gia' noto resta,
 * e un aggiornamento fallito non lo cancella.
 *
 * E' un signal e non un campo semplice perche' l'app e' zoneless: e' il signal
 * a garantire il ridisegno quando il valore arriva dopo il primo render.
 *
 * Nessuno stato viene salvato: l'insieme e' DERIVATO dalla data delle sedute
 * confrontata con la settimana corrente, quindi al cambio di settimana si
 * svuota da solo, senza niente da azzerare.
 */
@Injectable({ providedIn: 'root' })
export class WeeklyProgressService {

  /** Id dei giorni con almeno una seduta salvata in questa settimana. */
  doneDayIds = signal<ReadonlySet<string>>(new Set());

  private inFlight: Promise<void> | null = null;

  constructor(private sessions: WorkoutSessionsService, private state: WorkoutStateService) {}

  /**
   * Rilegge le sedute e ricalcola le spunte. Chiamate ravvicinate condividono
   * la stessa lettura invece di moltiplicarla (la pagina puo' essere ricreata
   * piu' volte di seguito). In caso di errore l'ultimo valore noto resta:
   * meglio una spunta vecchia di qualche minuto che una lista che si svuota.
   */
  refresh(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.sessions.listAll()
      .then(saved => {
        const week = this.state.currentWeek;
        const start = this.state.DEFAULT_PROGRAM_START;
        const done = new Set<string>();
        for (const { session } of saved) {
          if (!session?.date || !session?.dayId) continue;
          if (this.state.weekNumberForDate(session.date, start) === week) done.add(session.dayId);
        }
        this.doneDayIds.set(done);
      })
      .catch(e => {
        console.error('Lettura delle sedute per le spunte settimanali fallita:', e);
      })
      .finally(() => { this.inFlight = null; });
    return this.inFlight;
  }


  isDone(dayId: string): boolean {
    return this.doneDayIds().has(dayId);
  }

}
