import { Injectable, signal, effect } from '@angular/core';
import { AppStateService, ActiveWorkoutSession } from './app-state.service';
import { AuthService } from '../core/services/auth.service';

const SESSION_CACHE_KEY = 'activeWorkoutSession';
const APP_STATE_FIELD = 'activeWorkoutSession';

/**
 * Sessione di allenamento in corso: un solo allenamento alla volta.
 *
 * Viene salvato l'ISTANTE DI AVVIO, non i secondi trascorsi: il tempo si
 * ricalcola sempre come Date.now() - startedAt. E' lo stesso principio del
 * timer di recupero (restEndAt in WorkoutStateService) ed e' cio' che rende
 * il cronometro corretto quando iOS sospende l'esecuzione JS (schermo
 * bloccato, app in background): al rientro mostra il tempo reale, non quello
 * congelato al momento della sospensione.
 *
 * Separato da WorkoutStateService perche' ha un ciclo di vita diverso: il
 * recupero dura secondi e vive solo in memoria, la sessione dura un'ora ed
 * e' persistita (cache locale per la ripartenza immediata + account per
 * sopravvivere a chiusura app e cambio dispositivo).
 */
@Injectable({ providedIn: 'root' })
export class WorkoutSessionStateService {

  activeSession = signal<ActiveWorkoutSession | null>(this.initialSession());
  elapsedSec = signal(0);

  private ticker: ReturnType<typeof setInterval> | null = null;

  // Incrementato da start()/clear() (quindi anche cancel()/finish()): serve a
  // capire se una load() ancora in volo e' precedente a una mutazione locale
  // e in tal caso non deve sovrascriverla (altrimenti una sessione appena
  // avviata sparirebbe pur esistendo su Firestore). E' un contatore e non un
  // semplice flag perche' la guardia deve valere solo per la singola load()
  // che era in volo al momento della mutazione, non per tutte quelle future:
  // l'effect puo' rieseguirsi piu' volte nella vita di questo singleton (es.
  // refresh del token Firebase), e le sincronizzazioni successive (sessione
  // avviata/chiusa su un altro dispositivo) devono continuare a funzionare.
  private mutationCount = 0;

  constructor(private appState: AppStateService, private auth: AuthService) {
    this.refresh();

    // Aspetta che l'autenticazione sia risolta prima di leggere l'account:
    // altrimenti currentUser() e' ancora null (crash) all'avvio dell'app.
    effect(() => {
      if (!this.auth.authReady() || !this.auth.currentUser()) return;
      const generation = this.mutationCount;
      this.appState.load().then(state => {
        // Una mutazione locale (avvio/annullamento/chiusura) e' avvenuta dopo l'inizio
        // di questa lettura: lo snapshot e' piu' vecchio della mutazione e non deve
        // sovrascriverla. La guardia vale solo per QUESTA lettura, cosi' le
        // sincronizzazioni successive (es. sessione chiusa su un altro dispositivo)
        // continuano a funzionare.
        if (generation !== this.mutationCount) return;
        const saved = state.activeWorkoutSession ?? null;
        if (!this.sameSession(saved, this.activeSession())) {
          this.activeSession.set(saved);
          this.writeCache(saved);
          this.refresh();
        }
      });
    });

    // Il tick puo' essere rimasto fermo per minuti mentre l'app era in
    // background: appena torna visibile ricalcoliamo subito, senza aspettare
    // il prossimo tick.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.syncElapsed();
    });
  }

  /** Rimuove solo la cache locale (usato al logout): la sessione sull'account
   *  resta, cosi' e' ancora ripristinabile su un altro dispositivo. */
  clearLocalCache(): void {
    localStorage.removeItem(SESSION_CACHE_KEY);
  }

  isActiveForDay(dayId: string): boolean {
    return this.activeSession()?.dayId === dayId;
  }

  start(dayId: string): void {
    this.mutationCount++;
    const session: ActiveWorkoutSession = { dayId, startedAt: new Date().toISOString() };
    this.activeSession.set(session);
    this.writeCache(session);
    this.appState.patchField(APP_STATE_FIELD, session);
    this.refresh();
  }

  /** Annulla la sessione in corso senza salvare nulla. */
  cancel(): void {
    this.clear();
  }

  /** Chiude la sessione. La durata va letta da elapsedSec() PRIMA di chiamarlo. */
  finish(): void {
    this.clear();
  }

  formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const mm = h > 0 ? m.toString().padStart(2, '0') : m.toString();
    return h > 0
      ? `${h}:${mm}:${s.toString().padStart(2, '0')}`
      : `${mm}:${s.toString().padStart(2, '0')}`;
  }

  private clear(): void {
    this.mutationCount++;
    this.activeSession.set(null);
    localStorage.removeItem(SESSION_CACHE_KEY);
    this.appState.deleteFieldPath(APP_STATE_FIELD);
    this.refresh();
  }

  /** Riallinea tempo trascorso e ticker allo stato corrente della sessione. */
  private refresh(): void {
    this.syncElapsed();
    const hasSession = !!this.activeSession();
    if (hasSession && !this.ticker) {
      this.ticker = setInterval(() => this.syncElapsed(), 1000);
    } else if (!hasSession && this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }

  private syncElapsed(): void {
    const session = this.activeSession();
    if (!session) { this.elapsedSec.set(0); return; }
    const started = new Date(session.startedAt).getTime();
    this.elapsedSec.set(Math.max(0, Math.floor((Date.now() - started) / 1000)));
  }

  private initialSession(): ActiveWorkoutSession | null {
    // Cache locale letta in modo sincrono: il cronometro riparte subito al
    // caricamento, senza attendere la risposta dell'account.
    const raw = localStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.dayId === 'string' && typeof parsed.startedAt === 'string') {
        return { dayId: parsed.dayId, startedAt: parsed.startedAt };
      }
      return null;
    } catch {
      return null; // cache corrotta: si riparte senza sessione invece di crashare
    }
  }

  private writeCache(session: ActiveWorkoutSession | null): void {
    if (session) localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_CACHE_KEY);
  }

  private sameSession(a: ActiveWorkoutSession | null, b: ActiveWorkoutSession | null): boolean {
    if (a === null || b === null) return a === b;
    return a.dayId === b.dayId && a.startedAt === b.startedAt;
  }
}
