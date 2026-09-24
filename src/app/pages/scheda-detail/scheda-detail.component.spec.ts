import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SchedaDetailComponent } from './scheda-detail.component';

/**
 * Copre una regola sola: la scheda si compila solo a sessione avviata.
 *
 * Il componente si costruisce a mano con stub (come coach-protocol-builder)
 * invece di montarlo: qui interessa la regola, non il rendering. Serve pero'
 * un contesto di iniezione, perche' il costruttore registra un effect().
 */
function makeComponent(opts: { sessionSuQuestoGiorno: boolean; inPausa?: boolean }) {
  const startRestTimer = vi.fn();
  const patchField = vi.fn(() => Promise.resolve());

  const sessionState = {
    matchesDay: () => opts.sessionSuQuestoGiorno,
    isPaused: () => opts.inPausa ?? false,
    activeSession: () => (opts.sessionSuQuestoGiorno ? { dayId: 'day1' } : null)
  } as any;

  const state = { viewMode: () => 'list', saveStatus: () => 'idle', startRestTimer } as any;

  const component = TestBed.runInInjectionContext(() => new SchedaDetailComponent(
    {} as any,                       // ActivatedRoute: ngOnInit non viene chiamato
    {} as any,                       // Router
    {} as any,                       // WorkoutDataService
    state,
    { patchField } as any,           // AppStateService
    {} as any,                       // WorkoutSessionsService
    {} as any,                       // ConfirmDialogService
    { detectChanges: () => {} } as any,
    {} as any,                       // ToastService
    {} as any,                       // Renderer2
    sessionState
  ));

  component.day = { id: 'day1', label: 'Petto', rec: '90"', ex: [] } as any;
  return { component, startRestTimer, patchField };
}

function makeVm() {
  return {
    ex: { name: 'Panca piana', muscle: 'Petto', scheme: 'fisso' },
    rows: [{ reps: '', load: '', done: false, ripPlaceholder: '10', loadPlaceholder: '36' }],
    open: true, insightVisible: false, insight: null, restSeconds: 90, isFirst: true, warmup: null
  } as any;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('SchedaDetailComponent — scheda bloccata finche\' la sessione non parte', () => {

  it('senza sessione avviata i campi sono bloccati', () => {
    const { component } = makeComponent({ sessionSuQuestoGiorno: false });
    expect(component.setsLocked).toBe(true);
  });

  it('con la sessione avviata su questo giorno i campi si sbloccano', () => {
    const { component } = makeComponent({ sessionSuQuestoGiorno: true });
    expect(component.setsLocked).toBe(false);
  });

  it('in pausa restano sbloccati: una sessione in pausa e\' comunque avviata', () => {
    const { component } = makeComponent({ sessionSuQuestoGiorno: true, inPausa: true });
    expect(component.setsLocked).toBe(false);
  });

  it('una sessione aperta su un ALTRO giorno non sblocca questo', () => {
    // matchesDay risponde false: quei numeri appartengono all'altro allenamento.
    const { component } = makeComponent({ sessionSuQuestoGiorno: false });
    expect(component.setsLocked).toBe(true);
  });

  it('a scheda bloccata spuntare una serie non fa niente', () => {
    const { component, startRestTimer, patchField } = makeComponent({ sessionSuQuestoGiorno: false });
    const vm = makeVm();

    component.onSetCheck(vm, 0);
    vi.runAllTimers();

    // Ne' la spunta, ne' i valori suggeriti, ne' il recupero, ne' la bozza.
    expect(vm.rows[0].done).toBe(false);
    expect(vm.rows[0].reps).toBe('');
    expect(vm.rows[0].load).toBe('');
    expect(startRestTimer).not.toHaveBeenCalled();
    expect(patchField).not.toHaveBeenCalled();
  });

  it('a scheda sbloccata spuntare una serie funziona come prima', () => {
    const { component, startRestTimer, patchField } = makeComponent({ sessionSuQuestoGiorno: true });
    const vm = makeVm();

    component.onSetCheck(vm, 0);
    vi.runAllTimers();

    expect(vm.rows[0].done).toBe(true);
    // I suggerimenti del protocollo diventano valori veri solo alla spunta.
    expect(vm.rows[0].reps).toBe('10');
    expect(vm.rows[0].load).toBe('36');
    // Nome ed esercizio viaggiano separati: il nome lo mostra la fascia del
    // recupero, il giorno le serve per spegnersi quando si cambia allenamento.
    expect(startRestTimer).toHaveBeenCalledWith(90, 'Panca piana', 'day1');
    expect(patchField).toHaveBeenCalled();
  });
});
