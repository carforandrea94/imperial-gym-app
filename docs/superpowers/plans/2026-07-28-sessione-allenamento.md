# Sessione di allenamento con cronometro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettere di avviare una sessione di allenamento con cronometro incrementale (card di avvio in cima e card di chiusura in fondo alla pagina allenamento), salvarne la durata nello storico, e rimuovere il tasto salva dall'header.

**Architecture:** Un nuovo `WorkoutSessionStateService` possiede la sessione attiva come `{ dayId, startedAt }` persistito in `AppState` (Firestore + cache `localStorage`); il tempo trascorso si ricalcola sempre da `startedAt`, quindi sopravvive a ricarica dell'app e sospensione JS di iOS. `SchedaDetailComponent` ospita le due card e diventa l'unico punto da cui si salva; tutta la catena del bottone salva in navbar viene rimossa. `WorkoutSession` guadagna `durationSec?: number`, mostrato nello storico.

**Tech Stack:** Angular 21 standalone components, signals, zoneless change detection; Vitest (`npm test`) — **mai** `jasmine.createSpyObj`, si usano mock manuali come negli spec esistenti.

## Global Constraints

- Lavorare sempre sul branch `claude/diet-protocol-template-vh6wi7`, mai su `main`. Test sempre in locale.
- `startedAt` e' un timestamp ISO (`new Date().toISOString()`); il tempo trascorso si ricalcola SEMPRE come differenza da `Date.now()`, mai accumulando tick.
- `durationSec` su `WorkoutSession` e' **opzionale**: le sedute già salvate non lo hanno e devono restare valide. Dove manca, non si mostra nulla (nessun "0:00", nessun placeholder).
- Una sola sessione alla volta (un solo campo `activeWorkoutSession`, non uno per giorno).
- Non si puo' salvare l'allenamento senza una sessione attiva su quel giorno.
- Le due card vivono nel template di `SchedaDetailComponent`, fuori dai blocchi `.exlist` e `.exslider-wrap`, così si vedono in entrambe le viste. Lo storico usa un componente separato (`history-detail`), quindi non le mostra: non serve alcuna condizione aggiuntiva.
- Il timer di **recupero** (`WorkoutStateService.restTimer`) resta indipendente e non va toccato.
- Resta `WorkoutStateService.saveStatus` (ora alimenta la card finale invece dell'icona in navbar).

---

## Task 1: `WorkoutSessionStateService` + campi di modello

**Files:**
- Modify: `src/app/services/app-state.service.ts` (interfaccia `AppState` + `emptyState()`)
- Modify: `src/app/models/workout.model.ts:36-44` (`WorkoutSession`)
- Create: `src/app/services/workout-session-state.service.ts`
- Create: `src/app/services/workout-session-state.service.spec.ts`

**Interfaces:**
- Consumes: `AppStateService.load(): Promise<AppState>`, `AppStateService.patchField(path: string, value: unknown): Promise<void>`, `AppStateService.deleteFieldPath(path: string): Promise<void>`, `AuthService.authReady: Signal<boolean>`, `AuthService.currentUser: Signal<UserProfile | null>` (tutti già esistenti, invariati).
- Produces: `ActiveWorkoutSession` (esportata da `app-state.service.ts`); `WorkoutSessionStateService` con `activeSession: Signal<ActiveWorkoutSession | null>`, `elapsedSec: Signal<number>`, `isActiveForDay(dayId: string): boolean`, `start(dayId: string): void`, `cancel(): void`, `finish(): void`, `formatDuration(seconds: number): string`. `WorkoutSession.durationSec?: number`. Usati dai Task 2, 3 e 4.

- [ ] **Step 1: Aggiungi `ActiveWorkoutSession` e il campo in `AppState`**

In `src/app/services/app-state.service.ts`, dopo l'interfaccia `WorkoutDraftRow` e prima di `export interface AppState`, aggiungi:

```ts
export interface ActiveWorkoutSession {
  dayId: string;
  /** Istante di avvio in ISO. Il tempo trascorso si ricalcola da qui, mai accumulato. */
  startedAt: string;
}
```

Aggiungi il campo all'interfaccia `AppState` (dopo `themeMode: ThemeMode | null;`):

```ts
  activeWorkoutSession: ActiveWorkoutSession | null;
```

E il default in `emptyState()`, aggiungendo `activeWorkoutSession: null` all'oggetto ritornato (accanto a `themeMode: null`).

- [ ] **Step 2: Aggiungi `durationSec` a `WorkoutSession`**

In `src/app/models/workout.model.ts`, l'interfaccia alle righe 36-44 e' oggi:

```ts
export interface WorkoutSession {
  dayId: string;
  dayLabel: string;
  date: string;
  exercises: {
    name: string;
    sets: { load: string | null; reps: string | null; done: boolean }[];
  }[];
}
```

Diventa (campo opzionale in coda):

```ts
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
```

- [ ] **Step 3: Scrivi i test del servizio (falliranno: il file non esiste ancora)**

Crea `src/app/services/workout-session-state.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WorkoutSessionStateService } from './workout-session-state.service';

const CACHE_KEY = 'activeWorkoutSession';

function makeService(opts: {
  appState?: any;
  authReady?: boolean;
  savedSession?: any;
} = {}) {
  const calls: [string, unknown][] = [];
  const deleted: string[] = [];
  const appState = opts.appState ?? {
    load: () => Promise.resolve({ activeWorkoutSession: opts.savedSession ?? null } as any),
    patchField: (path: string, value: unknown) => { calls.push([path, value]); return Promise.resolve(); },
    deleteFieldPath: (path: string) => { deleted.push(path); return Promise.resolve(); }
  };
  const auth = {
    authReady: () => opts.authReady ?? false,
    currentUser: () => (opts.authReady ? { uid: 'u1' } : null)
  } as any;
  const service = TestBed.runInInjectionContext(
    () => new WorkoutSessionStateService(appState as any, auth)
  );
  return { service, calls, deleted };
}

describe('WorkoutSessionStateService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-28T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('senza sessione salvata parte senza sessione attiva e con tempo a zero', () => {
    const { service } = makeService();
    expect(service.activeSession()).toBeNull();
    expect(service.elapsedSec()).toBe(0);
  });

  it('start() imposta la sessione, scrive la cache locale e la persiste sull\'account', () => {
    const { service, calls } = makeService();

    service.start('day0');

    expect(service.activeSession()).toEqual({ dayId: 'day0', startedAt: '2026-07-28T10:00:00.000Z' });
    expect(JSON.parse(localStorage.getItem(CACHE_KEY)!)).toEqual({ dayId: 'day0', startedAt: '2026-07-28T10:00:00.000Z' });
    expect(calls).toEqual([['activeWorkoutSession', { dayId: 'day0', startedAt: '2026-07-28T10:00:00.000Z' }]]);
  });

  it('elapsedSec avanza col passare del tempo mentre l\'app e\' aperta', () => {
    const { service } = makeService();
    service.start('day0');

    vi.advanceTimersByTime(65_000);

    expect(service.elapsedSec()).toBe(65);
  });

  it('app sospesa: al rientro mostra il tempo reale trascorso, non quello congelato', () => {
    const { service } = makeService();
    service.start('day0');

    // iOS sospende l'esecuzione JS: nessun tick per 30 minuti, solo l'orologio avanza.
    vi.setSystemTime(new Date('2026-07-28T10:30:00.000Z'));
    document.dispatchEvent(new Event('visibilitychange'));

    expect(service.elapsedSec()).toBe(1800);
  });

  it('ripristina la sessione dalla cache locale alla creazione del servizio', () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ dayId: 'day2', startedAt: '2026-07-28T09:40:00.000Z' }));

    const { service } = makeService();

    expect(service.activeSession()).toEqual({ dayId: 'day2', startedAt: '2026-07-28T09:40:00.000Z' });
    expect(service.elapsedSec()).toBe(1200);
  });

  it('ignora una cache locale corrotta invece di propagare l\'errore', () => {
    localStorage.setItem(CACHE_KEY, 'non-json');

    const { service } = makeService();

    expect(service.activeSession()).toBeNull();
  });

  it('isActiveForDay distingue il giorno della sessione dagli altri', () => {
    const { service } = makeService();
    service.start('day1');

    expect(service.isActiveForDay('day1')).toBe(true);
    expect(service.isActiveForDay('day0')).toBe(false);
  });

  it('cancel() azzera sessione, cache e campo sull\'account', () => {
    const { service, deleted } = makeService();
    service.start('day0');

    service.cancel();

    expect(service.activeSession()).toBeNull();
    expect(service.elapsedSec()).toBe(0);
    expect(localStorage.getItem(CACHE_KEY)).toBeNull();
    expect(deleted).toEqual(['activeWorkoutSession']);
  });

  it('finish() azzera la sessione (la durata va letta da elapsedSec prima di chiamarlo)', () => {
    const { service, deleted } = makeService();
    service.start('day0');
    vi.advanceTimersByTime(120_000);

    const durata = service.elapsedSec();
    service.finish();

    expect(durata).toBe(120);
    expect(service.activeSession()).toBeNull();
    expect(service.elapsedSec()).toBe(0);
    expect(deleted).toEqual(['activeWorkoutSession']);
  });

  it('sincronizza dall\'account la sessione avviata su un altro dispositivo', async () => {
    let resolveLoad!: (v: any) => void;
    const loadPromise = new Promise<any>(res => { resolveLoad = res; });
    const { service } = makeService({
      appState: {
        load: () => loadPromise,
        patchField: () => Promise.resolve(),
        deleteFieldPath: () => Promise.resolve()
      },
      authReady: true
    });
    TestBed.flushEffects();

    resolveLoad({ activeWorkoutSession: { dayId: 'day3', startedAt: '2026-07-28T09:50:00.000Z' } });
    await loadPromise;

    expect(service.activeSession()).toEqual({ dayId: 'day3', startedAt: '2026-07-28T09:50:00.000Z' });
    expect(service.elapsedSec()).toBe(600);
  });

  it('formatDuration mostra minuti:secondi sotto l\'ora e ore:minuti:secondi sopra', () => {
    const { service } = makeService();

    expect(service.formatDuration(0)).toBe('0:00');
    expect(service.formatDuration(9)).toBe('0:09');
    expect(service.formatDuration(2712)).toBe('45:12');
    expect(service.formatDuration(3930)).toBe('1:05:30');
  });
});
```

- [ ] **Step 4: Esegui i test e verifica che falliscano**

Run: `cd /home/user/imperial-gym-app && npm test`
Expected: FAIL — errore di risoluzione del modulo `./workout-session-state.service` (il file non esiste ancora).

- [ ] **Step 5: Implementa il servizio**

Crea `src/app/services/workout-session-state.service.ts`:

```ts
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

  constructor(private appState: AppStateService, private auth: AuthService) {
    this.refresh();

    // Aspetta che l'autenticazione sia risolta prima di leggere l'account:
    // altrimenti currentUser() e' ancora null (crash) all'avvio dell'app.
    effect(() => {
      if (!this.auth.authReady() || !this.auth.currentUser()) return;
      this.appState.load().then(state => {
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

  isActiveForDay(dayId: string): boolean {
    return this.activeSession()?.dayId === dayId;
  }

  start(dayId: string): void {
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
```

- [ ] **Step 6: Esegui i test e verifica che passino**

Run: `cd /home/user/imperial-gym-app && npm test`
Expected: PASS — tutta la suite, inclusi gli 11 nuovi test.

- [ ] **Step 7: Verifica che il progetto compili**

Run: `cd /home/user/imperial-gym-app && npm run build`
Expected: build completata senza errori.

- [ ] **Step 8: Commit**

```bash
git add src/app/services/app-state.service.ts src/app/models/workout.model.ts src/app/services/workout-session-state.service.ts src/app/services/workout-session-state.service.spec.ts
git commit -m "feat: WorkoutSessionStateService per la sessione di allenamento in corso"
```

---

## Task 2: Card di avvio e chiusura in `SchedaDetailComponent`

**Files:**
- Modify: `src/app/pages/scheda-detail/scheda-detail.component.ts` (costruttore, nuovi metodi/getter, `saveWorkout()` alla riga 380)
- Modify: `src/app/pages/scheda-detail/scheda-detail.component.html` (card in cima e in fondo)
- Modify: `src/styles.css` (stili delle card)

**Interfaces:**
- Consumes (dal Task 1): `WorkoutSessionStateService` con `activeSession: Signal<ActiveWorkoutSession | null>`, `elapsedSec: Signal<number>`, `isActiveForDay(dayId: string): boolean`, `start(dayId: string): void`, `cancel(): void`, `finish(): void`, `formatDuration(seconds: number): string`; `WorkoutSession.durationSec?: number`. Già esistenti e invariati: `WorkoutStateService.saveStatus` (signal `'idle' | 'saving' | 'saved' | 'err'`), `ConfirmDialogService.confirm(message, opts?: { confirmLabel?: string; dangerous?: boolean })`.
- Produces: nessuna interfaccia consumata da altri task (il Task 3 rimuove solo la vecchia catena della navbar).

- [ ] **Step 1: Inietta il servizio e aggiungi getter e metodi nel componente**

In `src/app/pages/scheda-detail/scheda-detail.component.ts`, aggiungi l'import (accanto agli altri import di servizi, dopo la riga che importa `WorkoutSessionsService`):

```ts
import { WorkoutSessionStateService } from '../../services/workout-session-state.service';
```

Nel costruttore (righe 60-71), aggiungi come ultimo parametro:

```ts
    public sessionState: WorkoutSessionStateService
```

(quindi il parametro precedente `private renderer: Renderer2` va seguito da una virgola).

Poi aggiungi questi membri pubblici, subito PRIMA del metodo `saveWorkout()` (attualmente alla riga 380):

```ts
  /** true se esiste una sessione in corso, ma su un giorno diverso da questo. */
  get hasOtherSession(): boolean {
    const s = this.sessionState.activeSession();
    return !!s && s.dayId !== this.day.id;
  }

  /** Indice del giorno su cui e' in corso la sessione, per il link "vai alla sessione".
   *  null se la sessione e' su questo giorno, assente, oppure se il suo dayId non
   *  esiste piu' nel protocollo attuale (protocollo cambiato dopo l'avvio). */
  get otherSessionDayIndex(): number | null {
    const s = this.sessionState.activeSession();
    if (!s || s.dayId === this.day.id) return null;
    const idx = this.workoutData.days.findIndex(d => d.id === s.dayId);
    return idx >= 0 ? idx : null;
  }

  get endButtonLabel(): string {
    switch (this.state.saveStatus()) {
      case 'saving': return 'Salvataggio…';
      case 'saved': return 'Salvato ✓';
      case 'err': return 'Errore, riprova';
      default: return 'Termina e salva';
    }
  }

  startSession(): void {
    this.sessionState.start(this.day.id);
  }

  goToOtherSession(): void {
    const idx = this.otherSessionDayIndex;
    if (idx === null) return;
    this.router.navigate(['/scheda/day', idx]);
  }

  async cancelSession(): Promise<void> {
    const ok = await this.confirm.confirm(
      'Vuoi annullare la sessione in corso? Il tempo verra\' perso e l\'allenamento non verra\' salvato nello storico.',
      { confirmLabel: 'Annulla sessione', dangerous: true }
    );
    if (!ok) return;
    this.sessionState.cancel();
    this.cdr.detectChanges();
  }
```

- [ ] **Step 2: Adatta `saveWorkout()` alla sessione**

In `src/app/pages/scheda-detail/scheda-detail.component.ts`, il metodo `saveWorkout()` (righe 380-416) va modificato in tre punti. Sostituisci il metodo intero con:

```ts
  async saveWorkout(): Promise<void> {
    if (this.state.saveStatus() === 'saving') return; // evita doppio invio mentre e' gia' in corso
    // Il salvataggio esiste solo come chiusura di una sessione avviata su questo giorno.
    if (!this.sessionState.isActiveForDay(this.day.id)) return;
    this.state.saveStatus.set('saving');
    if (this.draftTimer) { clearTimeout(this.draftTimer); this.draftTimer = null; }

    const isoDate = todayLocalISO();
    // Durata letta PRIMA del salvataggio: la sessione viene chiusa solo a
    // salvataggio riuscito, cosi' un errore di rete non la distrugge.
    const durationSec = this.sessionState.elapsedSec();
    const session: WorkoutSession = {
      dayId: this.day.id,
      dayLabel: this.day.label,
      date: isoDate,
      exercises: this.exercises.map(vm => ({
        name: vm.ex.name,
        sets: vm.rows.map(r => ({ load: r.load || null, reps: r.reps || null, done: r.done }))
      })),
      durationSec
    };

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 12000)
    );

    try {
      const ok = await Promise.race([this.sessions.save(session), timeout]);
      if (ok) {
        await this.appState.deleteFieldPath(`workoutDrafts.${this.day.id}`);
        this.sessionState.finish();
        this.state.saveStatus.set('saved');
        this.toast.success('Allenamento salvato ✓');
      } else {
        this.state.saveStatus.set('err');
        this.toast.error('Errore durante il salvataggio. Riprova.');
      }
    } catch (e: any) {
      console.error('Errore salvataggio allenamento:', e);
      this.state.saveStatus.set('err');
      this.toast.error('Errore durante il salvataggio. Riprova.');
    } finally {
      setTimeout(() => this.state.saveStatus.set('idle'), 2000);
    }
  }
```

- [ ] **Step 3: Aggiungi la card di avvio in cima al template**

In `src/app/pages/scheda-detail/scheda-detail.component.html`, subito PRIMA del commento `<!-- Vista elenco (accordion) -->` (riga 61), inserisci:

```html
<!-- Sessione: card di avvio. Vive qui (fuori dai blocchi lista/slider) cosi' e'
     visibile in entrambe le viste; lo storico usa un altro componente e non la mostra. -->
<div class="infocard session-card" *ngIf="day && !loading && !errorMsg">
  <ng-container *ngIf="sessionState.isActiveForDay(day.id)">
    <p class="session-label">Sessione in corso</p>
    <p class="session-timer">{{ sessionState.formatDuration(sessionState.elapsedSec()) }}</p>
  </ng-container>

  <ng-container *ngIf="!sessionState.isActiveForDay(day.id)">
    <button class="savebtn" [disabled]="hasOtherSession" (click)="startSession()">
      Avvia sessione
    </button>
    <p class="session-hint" *ngIf="hasOtherSession">
      <ng-container *ngIf="otherSessionDayIndex !== null">
        C'è già una sessione in corso su Giorno {{ otherSessionDayIndex + 1 }}.
      </ng-container>
      <ng-container *ngIf="otherSessionDayIndex === null">
        C'è già una sessione in corso su un allenamento non più presente nel protocollo.
      </ng-container>
    </p>
    <button class="confirmbtn cancel" style="width:100%;margin-top:10px"
      *ngIf="hasOtherSession && otherSessionDayIndex !== null"
      (click)="goToOtherSession()">
      Vai alla sessione
    </button>
    <button class="confirmbtn cancel" style="width:100%;margin-top:10px"
      *ngIf="hasOtherSession && otherSessionDayIndex === null"
      (click)="cancelSession()">
      Annulla quella sessione
    </button>
  </ng-container>
</div>
```

- [ ] **Step 4: Aggiungi la card di chiusura in fondo al template**

Nello stesso file, subito PRIMA della riga che apre l'overlay del recupero
(`<div class="resttimer-sheet-overlay" #restSheetOverlay ...>`), inserisci:

```html
<!-- Sessione: card di chiusura. "Termina e salva" e' l'unico punto di salvataggio
     dell'allenamento (il tasto in navbar e' stato rimosso). -->
<div class="infocard session-card session-card-end" *ngIf="day && !loading && !errorMsg">
  <button class="savebtn"
    [class.saved]="state.saveStatus() === 'saved'"
    [class.err]="state.saveStatus() === 'err'"
    [disabled]="!sessionState.isActiveForDay(day.id) || state.saveStatus() === 'saving'"
    (click)="saveWorkout()">
    {{ endButtonLabel }}
  </button>

  <button class="confirmbtn cancel" style="width:100%;margin-top:10px"
    *ngIf="sessionState.isActiveForDay(day.id)"
    (click)="cancelSession()">
    Annulla sessione
  </button>

  <p class="session-hint" *ngIf="!sessionState.isActiveForDay(day.id) && !hasOtherSession">
    Avvia la sessione per poter salvare l'allenamento nello storico.
  </p>
</div>
```

- [ ] **Step 5: Aggiungi gli stili delle card**

In `src/styles.css`, subito dopo la riga `.savebtn.err{background:var(--state-danger);color:#fff;}`, inserisci:

```css
/* ===== Card sessione di allenamento (avvio / chiusura) ===== */
.session-card{margin-bottom:14px;}
/* Classe dedicata invece di :last-of-type, che guarda il tipo di elemento (div) e
   non la classe: dopo le card c'e' l'overlay del recupero, anch'esso un div. */
.session-card-end{margin-top:16px;margin-bottom:0;}
.session-label{font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--label-3);text-align:center;}
.session-timer{font-family:'IBM Plex Mono',monospace;font-size:34px;font-weight:600;letter-spacing:.02em;color:var(--accent);text-align:center;margin-top:6px;font-variant-numeric:tabular-nums;}
.session-hint{font-family:'Inter',sans-serif;font-size:12.5px;line-height:1.5;color:var(--label-3);text-align:center;margin-top:10px;}
```

- [ ] **Step 6: Verifica che il progetto compili e i test passino**

Run: `cd /home/user/imperial-gym-app && npm run build`
Expected: build completata senza errori.

Run: `cd /home/user/imperial-gym-app && npm test`
Expected: PASS, nessuna regressione.

- [ ] **Step 7: Commit**

```bash
git add src/app/pages/scheda-detail/scheda-detail.component.ts src/app/pages/scheda-detail/scheda-detail.component.html src/styles.css
git commit -m "feat: card di avvio e chiusura sessione nella pagina allenamento"
```

---

## Task 3: Rimuovi il tasto salva dall'header

**Files:**
- Modify: `src/app/components/navbar/navbar.component.html:12` e `:32-40`
- Modify: `src/app/components/navbar/navbar.component.ts:20-21,36`
- Modify: `src/app/app.html:12-13,27`
- Modify: `src/app/app.ts:39,118,301,407-409`
- Modify: `src/app/services/workout-state.service.ts:38-52`
- Modify: `src/app/pages/scheda-detail/scheda-detail.component.ts:89,137`

**Interfaces:**
- Consumes: nulla di nuovo. La card di chiusura (Task 2) e' già il punto di salvataggio, quindi rimuovere questa catena non lascia l'app senza modo di salvare.
- Produces: nessuna (task di sola rimozione).

- [ ] **Step 1: Rimuovi il bottone dalla navbar**

In `src/app/components/navbar/navbar.component.html`, elimina l'intero blocco alle righe 32-40:

```html
      <button class="navicon saveworkout-icon"
        *ngIf="showSaveWorkout"
        [class.saved]="saveStatus === 'saved'"
        [class.err]="saveStatus === 'err'"
        [disabled]="saveStatus === 'saving'"
        (click)="saveWorkoutClick.emit()"
        aria-label="Completa allenamento" title="Completa allenamento">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
      </button>
```

E nella riga 12 rimuovi `!showSaveWorkout && ` dall'espressione, che diventa:

```html
    <div class="navactions" [class.hide]="!showHistory && !showInfo && !showAnalytics && !showShoppingList && !showViewToggle && !showSettings && !showSaveEdit && !showProtocolSave && !showSaveMeasure">
```

- [ ] **Step 2: Rimuovi input e output dal componente navbar**

In `src/app/components/navbar/navbar.component.ts`, elimina queste tre righe (20, 21 e 36):

```ts
  @Input() showSaveWorkout = false;
  @Input() saveStatus: 'idle' | 'saving' | 'saved' | 'err' = 'idle';
```

```ts
  @Output() saveWorkoutClick = new EventEmitter<void>();
```

- [ ] **Step 3: Rimuovi i binding dallo shell dell'app**

In `src/app/app.html`, elimina queste tre righe (12, 13 e 27):

```html
  [showSaveWorkout]="showSaveWorkout"
  [saveStatus]="workoutState.saveStatus()"
```

```html
  (saveWorkoutClick)="onSaveWorkoutClick()"
```

- [ ] **Step 4: Rimuovi lo stato e l'handler da `app.ts`**

In `src/app/app.ts`:

- Elimina la dichiarazione alla riga 39: `showSaveWorkout = false;`
- Elimina l'assegnazione alla riga 118: `this.showSaveWorkout = false;`
- Elimina l'assegnazione alla riga 301: `this.showSaveWorkout = true;`
- Elimina l'intero metodo alle righe 407-409:

```ts
  onSaveWorkoutClick(): void {
    this.workoutState.requestSave();
  }
```

- [ ] **Step 5: Rimuovi il meccanismo di inoltro da `WorkoutStateService`**

In `src/app/services/workout-state.service.ts`, il blocco alle righe 38-52 e' oggi:

```ts
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
```

Sostituiscilo con (resta solo `saveStatus`, con il commento aggiornato):

```ts
  /**
   * Stato del salvataggio allenamento, mostrato dalla card di chiusura
   * sessione nella pagina allenamento.
   */
  saveStatus = signal<SaveWorkoutStatus>('idle');
```

- [ ] **Step 6: Rimuovi le chiamate residue in `scheda-detail`**

In `src/app/pages/scheda-detail/scheda-detail.component.ts`:

- Elimina la riga 89: `this.state.registerSaveHandler(() => this.saveWorkout());`
- In `ngOnDestroy()`, elimina la riga 137: `this.state.registerSaveHandler(null);`

- [ ] **Step 7: Verifica che non resti alcun riferimento**

Run: `cd /home/user/imperial-gym-app && grep -rn "showSaveWorkout\|registerSaveHandler\|requestSave()\|saveWorkoutClick\|saveworkout-icon" src/`
Expected: **nessun risultato** in `src/app/**` per questi nomi. Unica occorrenza ammessa: la regola CSS `.saveworkout-icon` in `src/styles.css` (stile ora inutilizzato) — rimuovi anche quella regola e le sue varianti (`.saveworkout-icon`, `.saveworkout-icon:active`, `.saveworkout-icon:disabled`, `.saveworkout-icon.saved`, `.saveworkout-icon.err`) così il grep torna completamente vuoto. Attenzione: `historyEditState.requestSave()`, `measureState.requestSave()` e `protocolBuilderState.requestSave*` appartengono ad altre feature e **non** vanno toccati (il grep sopra li intercetta: verifica il nome del servizio prima di rimuovere qualcosa).

- [ ] **Step 8: Verifica che il progetto compili e i test passino**

Run: `cd /home/user/imperial-gym-app && npm run build`
Expected: build completata senza errori.

Run: `cd /home/user/imperial-gym-app && npm test`
Expected: PASS, nessuna regressione.

- [ ] **Step 9: Commit**

```bash
git add src/app/components/navbar/navbar.component.html src/app/components/navbar/navbar.component.ts src/app/app.html src/app/app.ts src/app/services/workout-state.service.ts src/app/pages/scheda-detail/scheda-detail.component.ts src/styles.css
git commit -m "refactor: rimuove il tasto salva allenamento dall'header"
```

---

## Task 4: Durata nello storico

**Files:**
- Modify: `src/app/pages/history-list/history-list.component.ts` (costruttore)
- Modify: `src/app/pages/history-list/history-list.component.html:20`
- Modify: `src/app/pages/history-detail/history-detail.component.ts` (costruttore)
- Modify: `src/app/pages/history-detail/history-detail.component.html:20-23`

**Interfaces:**
- Consumes (dal Task 1): `WorkoutSessionStateService.formatDuration(seconds: number): string`; `WorkoutSession.durationSec?: number`.
- Produces: nessuna (ultimo task).

- [ ] **Step 1: Mostra la durata nell'elenco dello storico**

In `src/app/pages/history-list/history-list.component.ts`, aggiungi l'import:

```ts
import { WorkoutSessionStateService } from '../../services/workout-session-state.service';
```

e aggiungi al costruttore (righe 11-17) un ultimo parametro pubblico, dopo `private cdr: ChangeDetectorRef`:

```ts
    public sessionState: WorkoutSessionStateService
```

In `src/app/pages/history-list/history-list.component.html`, la riga 20 e' oggi:

```html
          <div class="meta">{{ s.displayDate }} &nbsp;·&nbsp; {{ s.completedSets }} serie</div>
```

Sostituiscila con (la durata compare solo se presente):

```html
          <div class="meta">
            {{ s.displayDate }} &nbsp;·&nbsp; {{ s.completedSets }} serie<ng-container *ngIf="s.session.durationSec"> &nbsp;·&nbsp; {{ sessionState.formatDuration(s.session.durationSec) }}</ng-container>
          </div>
```

- [ ] **Step 2: Mostra la durata nel dettaglio della seduta**

In `src/app/pages/history-detail/history-detail.component.ts`, aggiungi l'import:

```ts
import { WorkoutSessionStateService } from '../../services/workout-session-state.service';
```

e aggiungi al costruttore (che inizia alla riga 39) un ultimo parametro pubblico, dopo `private historyEditState: HistoryEditStateService`:

```ts
    public sessionState: WorkoutSessionStateService
```

In `src/app/pages/history-detail/history-detail.component.html`, il blocco alle righe 20-23 e' oggi:

```html
  <div class="daymeta">
    <span>{{ session.dayLabel }}</span>
    <span class="rec">{{ displayDate }}</span>
  </div>
```

Sostituiscilo con:

```html
  <div class="daymeta">
    <span>{{ session.dayLabel }}</span>
    <span class="rec">
      {{ displayDate }}<ng-container *ngIf="session.durationSec"> &nbsp;·&nbsp; ⏱ {{ sessionState.formatDuration(session.durationSec) }}</ng-container>
    </span>
  </div>
```

- [ ] **Step 3: Verifica che il progetto compili e i test passino**

Run: `cd /home/user/imperial-gym-app && npm run build`
Expected: build completata senza errori.

Run: `cd /home/user/imperial-gym-app && npm test`
Expected: PASS, nessuna regressione.

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/history-list/history-list.component.ts src/app/pages/history-list/history-list.component.html src/app/pages/history-detail/history-detail.component.ts src/app/pages/history-detail/history-detail.component.html
git commit -m "feat: mostra la durata della sessione nello storico"
```

---

## Dopo i quattro task

1. Dispatch del final code-reviewer whole-branch (modello più capace disponibile).
2. Verifica manuale in locale (Playwright/Chromium, `npm start`): avvio sessione, ricarica pagina a sessione avviata (il cronometro deve mostrare il tempo reale, non ripartire da zero), tentativo di avvio su un secondo giorno, annullamento con conferma, salvataggio con durata e comparsa nello storico. Attenzione: il login richiede Firebase, che in questo ambiente sandbox **non e' raggiungibile dal browser** (solo da Node/curl): se il login non passa, documentarlo come limite d'ambiente invece di insistere.
3. `superpowers:finishing-a-development-branch`.
