import { Injectable, signal, effect } from '@angular/core';
import { AppStateService } from './app-state.service';
import { AuthService } from '../core/services/auth.service';
import { isIosSafariNotStandalone } from '../core/utils/platform.util';

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
  private restEndAt = 0;
  private restDuration = REST_DURATION;
  private restFinishedHandled = false;

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

    // iOS sospende l'esecuzione JS quando l'app va in background: il
    // setInterval del timer di recupero puo' restare fermo per minuti. Il
    // conto alla rovescia e' calcolato da un timestamp reale (non da tick
    // contati), cosi' al rientro in app lo stato e' subito corretto; questo
    // listener forza il ricalcolo immediato invece di aspettare il prossimo
    // tick, cosi' vibrazione/banner scattano appena riapri l'app.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.ticker) this.restTick();
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

  /**
   * Numero di settimana del protocollo per una data qualsiasi (non solo oggi),
   * stessa formula di computeAutoWeek ma senza clamp: un risultato <= 0 indica
   * una data precedente all'inizio del programma attuale, un risultato oltre
   * maxWeeks e' legittimo (nessun tetto superiore). Usato per raggruppare lo
   * storico sedute per settimana.
   */
  weekNumberForDate(dateISO: string, programStart: string): number {
    const start = new Date(programStart + 'T00:00:00');
    const date = new Date(dateISO + 'T00:00:00');
    const diffDays = Math.floor((date.getTime() - start.getTime()) / 86400000);
    return Math.floor(diffDays / 7) + 1;
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
    this.requestNotificationPermission();
    this.restDuration = durationSeconds && durationSeconds > 0 ? durationSeconds : REST_DURATION;
    this.restEndAt = Date.now() + this.restDuration * 1000;
    this.restFinishedHandled = false;

    this.restTick();
    this.ticker = setInterval(() => this.restTick(), 1000);
  }

  private restTick(): void {
    const remaining = Math.max(0, Math.ceil((this.restEndAt - Date.now()) / 1000));
    const fillPct = Math.max((remaining / this.restDuration) * 100, 0);
    this.restTimer.set({ show: true, remaining, finished: remaining <= 0, fillPct });

    if (remaining <= 0 && !this.restFinishedHandled) {
      this.restFinishedHandled = true;
      if (this.ticker) { clearInterval(this.ticker); this.ticker = null; }
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      this.notifyRestFinished();
      this.closeTimeout = setTimeout(() => this.stopRestTimer(), 4000);
    }
  }

  /** Richiede il permesso di notifica alla prima partenza del timer di recupero; e' un no-op se gia' concesso/negato. */
  private requestNotificationPermission(): void {
    if (!('Notification' in window) || Notification.permission !== 'default') return;
    // Su iOS da scheda Safari (non installata in Home Screen) il permesso non
    // verrebbe comunque mai concesso davvero: evita di chiederlo a vuoto.
    if (isIosSafariNotStandalone()) return;
    Notification.requestPermission().catch(() => { /* l'utente puo' sempre negare/ignorare il prompt */ });
  }

  /**
   * Notifica di sistema a fine recupero, utile quando l'utente ha messo l'app
   * in background (schermo bloccato, altra app in primo piano): se l'app e'
   * gia' visibile basta il banner interno, non serve raddoppiare l'avviso.
   */
  private notifyRestFinished(): void {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (document.visibilityState === 'visible') return;

    const title = 'Recupero finito!';
    const options: NotificationOptions = {
      body: 'Torna al tuo allenamento 💪',
      icon: '/icons/icon-192x192.png',
      tag: 'rest-timer'
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then(reg => reg.showNotification(title, options))
        .catch(() => new Notification(title, options));
    } else {
      new Notification(title, options);
    }
  }

  stopRestTimer(): void {
    if (this.ticker) { clearInterval(this.ticker); this.ticker = null; }
    if (this.closeTimeout) {
      clearTimeout(this.closeTimeout);
      this.closeTimeout = null;
    }
    this.restFinishedHandled = false;
    this.restTimer.set({ show: false, remaining: REST_DURATION, finished: false, fillPct: 100 });
  }

  formatTime(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }
}
