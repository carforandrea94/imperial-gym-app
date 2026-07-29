import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
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

  it('start() locale durante una load() ancora pendente non viene sovrascritto dallo snapshot piu\' vecchio', async () => {
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

    // L'utente avvia una sessione mentre la load() e' ancora in volo.
    service.start('day0');

    // La load(), avviata prima dello start(), si risolve con lo snapshot
    // precedente (nessuna sessione salvata all'epoca della lettura).
    resolveLoad({ activeWorkoutSession: null });
    await loadPromise;

    expect(service.activeSession()).toEqual({ dayId: 'day0', startedAt: '2026-07-28T10:00:00.000Z' });
  });

  it('dopo una mutazione locale conclusa, una sincronizzazione successiva dall\'account viene comunque adottata', async () => {
    let loadCallCount = 0;
    const firstLoad = Promise.resolve({ activeWorkoutSession: null } as any);
    let resolveSecondLoad!: (v: any) => void;
    const secondLoadPromise = new Promise<any>(res => { resolveSecondLoad = res; });

    // currentUser deve essere un signal vero (non una funzione costante): solo
    // cosi' un suo cambiamento fa ripartire l'effect, come accade nella app
    // reale quando onAuthStateChanged riassegna il profilo dopo un refresh token.
    const currentUser = signal<any>({ uid: 'u1' });
    const appState = {
      load: () => {
        loadCallCount++;
        return loadCallCount === 1 ? firstLoad : secondLoadPromise;
      },
      patchField: () => Promise.resolve(),
      deleteFieldPath: () => Promise.resolve()
    };
    const auth = { authReady: () => true, currentUser } as any;

    const service = TestBed.runInInjectionContext(
      () => new WorkoutSessionStateService(appState as any, auth)
    );
    TestBed.flushEffects();
    await firstLoad;

    // Mutazioni locali concluse: avvio e chiusura di una sessione.
    service.start('day0');
    service.finish();

    // Il token si aggiorna (es. refresh Firebase): currentUser cambia oggetto
    // e l'effect riparte per rileggere lo stato sull'account.
    currentUser.set({ uid: 'u1', refreshed: true });
    TestBed.flushEffects();

    // Nel frattempo, su un altro dispositivo, e' stata avviata una sessione.
    resolveSecondLoad({ activeWorkoutSession: { dayId: 'day3', startedAt: '2026-07-28T09:00:00.000Z' } });
    await secondLoadPromise;

    expect(service.activeSession()).toEqual({ dayId: 'day3', startedAt: '2026-07-28T09:00:00.000Z' });
  });

  it('clearLocalCache() rimuove solo la cache locale: signal e Firestore restano intatti', () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ dayId: 'day2', startedAt: '2026-07-28T09:40:00.000Z' }));
    const { service, deleted } = makeService({ savedSession: { dayId: 'day2', startedAt: '2026-07-28T09:40:00.000Z' } });
    const sessionBefore = service.activeSession();

    service.clearLocalCache();

    expect(localStorage.getItem(CACHE_KEY)).toBeNull();
    expect(service.activeSession()).toEqual(sessionBefore);
    expect(deleted).toEqual([]);
  });

  it('formatDuration mostra minuti:secondi sotto l\'ora e ore:minuti:secondi sopra', () => {
    const { service } = makeService();

    expect(service.formatDuration(0)).toBe('0:00');
    expect(service.formatDuration(9)).toBe('0:09');
    expect(service.formatDuration(2712)).toBe('45:12');
    expect(service.formatDuration(3930)).toBe('1:05:30');
  });
});
