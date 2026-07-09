import { Injectable, signal, effect } from '@angular/core';
import { AppStateService } from './app-state.service';
import { AuthService } from '../core/services/auth.service';

export interface RestTimerState {
  show: boolean;
  remaining: number;
  finished: boolean;
  fillPct: number;
}

export type WorkoutViewMode = 'list' | 'slider';
export type SaveWorkoutStatus = 'idle' | 'saving' | 'saved' | 'err';

const REST_DURATION = 90;
const VIEW_MODE_CACHE_KEY = 'schedaViewMode';

@Injectable({ providedIn: 'root' })
export class WorkoutStateService {

  DEFAULT_PROGRAM_START = '2026-07-05';
  currentWeek: number;

  restTimer = signal<RestTimerState>({
    show: false, remaining: REST_DURATION, finished: false, fillPct: 100
  });

  /**
   * Vista lista/slider della scheda giornaliera: inizializzata dalla cache
   * locale per evitare un flash alla vista di default prima che l'account
   * (Firestore) risponda, poi allineata al valore salvato sull'account.
   */
  viewMode = signal<WorkoutViewMode>(
    localStorage.getItem(VIEW_MODE_CACHE_KEY) === 'slider' ? 'slider' : 'list'
  );

  /**
   * Stato del salvataggio allenamento, mostrato dall'icona di conferma
   * nell'header. Il bottone vive nella navbar (fuori dalla pagina scheda),
   * quindi il click viene inoltrato alla pagina tramite registerSaveHandler.
   */
  saveStatus = signal<SaveWorkoutStatus>('idle');
  private saveHandler: (() => void) | null = null;

  registerSaveHandler(handler: (() => void) | null): void {
    this.saveHandler = handler;
  }

  requestSave(): void {
    this.saveHandler?.();
  }

  private ticker: ReturnType<typeof setInterval> | null = null;
  private closeTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(private appState: AppStateService, private auth: AuthService) {
    this.currentWeek = this.computeAutoWeek(this.DEFAULT_PROGRAM_START);

    // Aspetta che l'autenticazione sia risolta prima di leggere l'account:
    // altrimenti currentUser() e' ancora null (crash) all'avvio dell'app.
    effect(() => {
      if (!this.auth.authReady() || !this.auth.currentUser()) return;
      this.appState.load().then(state => {
        if (state.workoutViewMode && state.workoutViewMode !== this.viewMode()) {
          this.viewMode.set(state.workoutViewMode);
          localStorage.setItem(VIEW_MODE_CACHE_KEY, state.workoutViewMode);
        }
      });
    });
  }

  setViewMode(mode: WorkoutViewMode): void {
    if (this.viewMode() === mode) return;
    this.viewMode.set(mode);
    localStorage.setItem(VIEW_MODE_CACHE_KEY, mode);
    this.appState.patchField('workoutViewMode', mode);
  }

  /** Ricalcola la settimana corrente in base a un nuovo inizio programma (dal protocollo attivo). */
  recomputeWeek(programStart: string, maxWeeks = 8): void {
    this.DEFAULT_PROGRAM_START = programStart;
    this.currentWeek = this.computeAutoWeek(programStart, maxWeeks);
  }

  private computeAutoWeek(startISO: string, maxWeeks = 8): number {
    const start = new Date(startISO + 'T00:00:00');
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((now.getTime() - start.getTime()) / 86400000);
    const week = Math.floor(diffDays / 7) + 1;
    return Math.min(Math.max(week, 1), maxWeeks);
  }

  startRestTimer(durationSeconds?: number): void {
    this.stopRestTimer();
    const duration = durationSeconds && durationSeconds > 0 ? durationSeconds : REST_DURATION;
    let remaining = duration;

    this.restTimer.set({ show: true, remaining, finished: false, fillPct: 100 });

    this.ticker = setInterval(() => {
      remaining--;
      const fillPct = (remaining / duration) * 100;
      this.restTimer.set({ show: true, remaining, finished: remaining <= 0, fillPct: Math.max(fillPct, 0) });

      if (remaining <= 0) {
        if (this.ticker) { clearInterval(this.ticker); this.ticker = null; }
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        this.closeTimeout = setTimeout(() => this.stopRestTimer(), 4000);
      }
    }, 1000);
  }

  stopRestTimer(): void {
    if (this.ticker) { clearInterval(this.ticker); this.ticker = null; }
    if (this.closeTimeout) {
      clearTimeout(this.closeTimeout);
      this.closeTimeout = null;
    }
    this.restTimer.set({ show: false, remaining: REST_DURATION, finished: false, fillPct: 100 });
  }

  formatTime(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }
}
