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

/**
 * La pausa dentro una serie a cluster. Il numero scende fino a zero e li' si
 * ferma: che la pausa del coach sia un minimo lo dice la scritta sotto, non un
 * numero che continua a salire mentre si e' sotto il bilanciere.
 */
describe('SchedaDetailComponent — la pausa dentro il cluster', () => {
  function conCluster(restSec: number) {
    const { component } = makeComponent({ sessionSuQuestoGiorno: true });
    // Il componente delega la formattazione a WorkoutSessionStateService, che
    // qui e' uno stub: gli si presta la stessa funzione del servizio vero,
    // cosi' il testo controllato e' quello che si legge davvero a schermo.
    (component as any).sessionState.formatDuration = (sec: number) =>
      `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;
    const vm = makeVm();
    vm.cluster = { blocks: [8, 8], restSec, end: 'fixed' };
    (component as any).startPause(vm, 0);
    return { component, vm };
  }

  it('parte dal minimo e scende', () => {
    const { component, vm } = conCluster(30);
    expect(component.pauseText(vm)).toBe('0:30');

    vi.advanceTimersByTime(10_000);
    expect(component.pauseText(vm)).toBe('0:20');
  });

  it('arrivata a zero si ferma, e non va sotto', () => {
    const { component, vm } = conCluster(30);

    vi.advanceTimersByTime(30_000);
    expect(component.pauseText(vm)).toBe('0:00');

    // Un minuto dopo e' ancora zero: prima saliva con il "+".
    vi.advanceTimersByTime(60_000);
    expect(component.pauseText(vm)).toBe('0:00');
  });

  /* Il riquadro resta a schermo: la pausa non e' finita, e' passato il minimo. */
  it('a zero la pausa resta aperta e dice che si puo\' ripartire', () => {
    const { component, vm } = conCluster(30);
    vi.advanceTimersByTime(45_000);

    expect(component.isPausing(vm, 0)).toBe(true);
    expect(component.pauseOver(vm)).toBe(true);
  });

  /* Un intervallo che continua a girare per il resto della serie e' solo
     batteria: a zero non c'e' piu' niente da contare. */
  it('a zero il ticker si spegne', () => {
    const { component, vm } = conCluster(30);
    vi.advanceTimersByTime(30_000);
    expect(vi.getTimerCount()).toBe(0);

    // E prima di zero invece gira.
    const secondo = conCluster(30);
    vi.advanceTimersByTime(5_000);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    expect(secondo.component.pauseText(secondo.vm)).toBe('0:25');
  });

  it('prima di arrivare a zero non dice ancora che e\' passata', () => {
    const { component, vm } = conCluster(30);
    vi.advanceTimersByTime(29_000);
    expect(component.pauseOver(vm)).toBe(false);
    expect(component.pauseText(vm)).toBe('0:01');
  });
});

/**
 * Il massimale stimato dentro la sessione. Il numero da solo non vuol dire
 * niente: queste formule presumono una serie tirata vicino al cedimento, e qui
 * il carico lo prescrive il coach, quindi accanto alla stima ci deve sempre
 * essere la serie da cui viene - e' l'unico modo per capire quanto crederci.
 */
describe('SchedaDetailComponent — il massimale stimato per esercizio', () => {
  /** Una sessione con le serie indicate su "Panca piana". */
  function sessione(date: string, sets: any[]) {
    return { id: date, session: { date, exercises: [{ name: 'Panca piana', sets }] } };
  }

  function insightDopo(sessioni: any[]) {
    const { component } = makeComponent({ sessionSuQuestoGiorno: true });
    const vm = makeVm();
    component.exercises = [vm];
    (component as any).loadInsights(sessioni);
    return vm.insight;
  }

  it('mostra la stima dell\'ultima sessione con la serie da cui viene', () => {
    // 80 x 6 con Brzycki: 80 * 36 / (37 - 6) = 92,9 -> 93 kg.
    const insight = insightDopo([sessione('2026-09-24', [{ load: '80', reps: '6' }])]);
    expect(insight.oneRmText).toContain('<b>93 kg</b>');
    expect(insight.oneRmText).toContain('dal tuo 80 × 6');
    expect(insight.oneRmText).toContain('del 24/09');
  });

  it('prende la serie col massimale piu\' alto, non quella col carico piu\' alto', () => {
    // 90 x 3 fa 95,3; 100 x 1 fa 100 esatti - una singola E' il massimale.
    const insight = insightDopo([sessione('2026-09-24', [
      { load: '90', reps: '3' }, { load: '100', reps: '1' }
    ])]);
    expect(insight.oneRmText).toContain('dal tuo 100 × 1');
    expect(insight.oneRmText).toContain('<b>100 kg</b>');
  });

  it('confronta con la sessione precedente e mostra la differenza', () => {
    const insight = insightDopo([
      sessione('2026-09-17', [{ load: '75', reps: '6' }]),   // 87
      sessione('2026-09-24', [{ load: '80', reps: '6' }])    // 93
    ]);
    expect(insight.oneRmText).toContain('+6 kg');
  });

  it('a parita\' di stima non scrive nessuna differenza', () => {
    const insight = insightDopo([
      sessione('2026-09-17', [{ load: '80', reps: '6' }]),
      sessione('2026-09-24', [{ load: '80', reps: '6' }])
    ]);
    expect(insight.oneRmText).not.toContain('kg ·');
  });

  it('ignora le serie a cluster: il loro carico e\' un intervallo, non un numero', () => {
    // "62,5-55" x "5+5+3" letto come numero darebbe 62 x 5, una serie che non
    // e' mai esistita. Deve contare solo la serie dritta.
    const insight = insightDopo([sessione('2026-09-24', [
      { load: '62,5-55', reps: '5+5+3', blocks: [{ load: '62,5' }, { load: '55' }] },
      { load: '70', reps: '5' }
    ])]);
    expect(insight.oneRmText).toContain('dal tuo 70 × 5');
  });

  it('con sole serie a cluster non stima niente', () => {
    const insight = insightDopo([sessione('2026-09-24', [
      { load: '62,5-55', reps: '5+5+3', blocks: [{ load: '62,5' }, { load: '55' }] }
    ])]);
    expect(insight.oneRmText).toBeNull();
  });

  it('oltre le dodici ripetizioni non stima, ma l\'ultima sessione si vede ancora', () => {
    const insight = insightDopo([sessione('2026-09-24', [{ load: '40', reps: '20' }])]);
    expect(insight.oneRmText).toBeNull();
    expect(insight.lastText).toBe('Ultimo (24/09): 40 kg');
  });
});

/**
 * La tabella dei carichi per ripetizione, dentro la sessione. Il massimale da
 * solo non dice che peso mettere sul bilanciere oggi: la tabella traduce.
 */
describe('SchedaDetailComponent — la tabella dei massimali per esercizio', () => {
  function conSessione(sets: any[]) {
    const { component } = makeComponent({ sessionSuQuestoGiorno: true });
    const vm = makeVm();
    component.exercises = [vm];
    (component as any).loadInsights([
      { id: 'a', session: { date: '2026-09-24', exercises: [{ name: 'Panca piana', sets }] } }
    ]);
    return { component, vm };
  }

  it('porta il carico per ogni ripetizione da 1 a 15', () => {
    const { vm } = conSessione([{ load: '80', reps: '6' }]);
    expect(vm.insight.rmRows.length).toBe(15);
    expect(vm.insight.rmRows[0].reps).toBe(1);
    expect(vm.insight.rmRows[14].reps).toBe(15);
  });

  it('la riga di una ripetizione coincide col massimale mostrato sopra', () => {
    const { vm } = conSessione([{ load: '80', reps: '6' }]);
    expect(vm.insight.oneRmText).toContain('<b>93 kg</b>');
    expect(vm.insight.rmRows[0].load).toBe(93);
  });

  it('alla riga delle ripetizioni fatte ritrova il peso sollevato', () => {
    // Chi ha appena fatto 80 x 6 deve leggere 80 alla riga "6 rip", altrimenti
    // la tabella lo smentisce con il bilanciere ancora in mano.
    const { vm } = conSessione([{ load: '80', reps: '6' }]);
    expect(vm.insight.rmRows.find((r: any) => r.reps === 6).load).toBe(80);
  });

  it('senza stima non c\'e\' tabella', () => {
    const { vm } = conSessione([{ load: '40', reps: '20' }]);
    expect(vm.insight.oneRmText).toBeNull();
    expect(vm.insight.rmRows).toBeNull();
  });

  it('nasce chiusa e si apre al tocco', () => {
    const { component, vm } = conSessione([{ load: '80', reps: '6' }]);
    expect(vm.rmOpen).toBeFalsy();
    component.toggleRm(vm);
    expect(vm.rmOpen).toBe(true);
    component.toggleRm(vm);
    expect(vm.rmOpen).toBe(false);
  });
});
