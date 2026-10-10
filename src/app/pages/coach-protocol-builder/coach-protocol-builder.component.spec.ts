import { vi } from 'vitest';

// pdfjs-dist tocca API browser (DOMMatrix, canvas) assenti nell'ambiente di test:
// stesso mock gia' usato in pdf-import.service.spec.ts, necessario qui perche'
// il componente importa PdfImportService (che a sua volta importa pdfjs-dist).
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {},
  version: '0.0.0',
  getDocument: () => ({ promise: Promise.resolve({ numPages: 0 }) })
}));

import { CoachProtocolBuilderComponent } from './coach-protocol-builder.component';
import { ProtocolService } from '../../services/protocol.service';
import { WorkoutDataService } from '../../services/workout-data.service';
import { ProtocolBuilderStateService } from '../../services/protocol-builder-state.service';
import { ToastService } from '../../services/toast.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { PdfImportService } from '../../services/pdf-import.service';
import { Protocol } from '../../models/protocol.model';

describe('CoachProtocolBuilderComponent', () => {
  function buildProtocol(): Protocol {
    return {
      id: 'proto1',
      clientId: 'client1',
      coachId: 'coach1',
      name: 'Protocollo test',
      status: 'draft',
      source: 'pdf',
      workout: {
        programStart: '2026-01-01',
        // Aggregato "stale": flat 4x10, come se calcolato all'import PDF
        // prima che il coach correggesse manualmente l'esercizio sotto.
        weekPlan: [
          { sets: 4, reps: 10 },
          { sets: 4, reps: 10 },
          { sets: 4, reps: 10 },
          { sets: 4, reps: 10 }
        ],
        days: [{
          id: 'day1',
          label: 'Gambe',
          rec: '60-90"',
          ex: [{
            name: 'Squat',
            scheme: 'wave',
            sets: 4,
            muscle: 'Gambe',
            reps: ['10'],
            // Dato per-esercizio corretto, gia' sistemato dal coach nel builder:
            // diverge dall'aggregato stale sopra.
            weekPlan: [
              { sets: 4, reps: 10 },
              { sets: 4, reps: 10 },
              { sets: 4, reps: 8 },
              { sets: 4, reps: 8 }
            ]
          }]
        }]
      },
      diet: [],
      infoNote: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    };
  }

  it("save() ricalcola workout.weekPlan dai dati per-esercizio invece di salvare l'aggregato non aggiornato", async () => {
    const updateCalls: any[][] = [];
    const protocolSvc: any = {
      update: (...args: any[]) => { updateCalls.push(args); return Promise.resolve(); },
      get: () => Promise.resolve(buildProtocol()),
      activate: () => Promise.resolve()
    };

    const router: any = { navigate: () => {} };
    const cdr: any = { detectChanges: () => {} };

    const component = new CoachProtocolBuilderComponent(
      {} as any, // ActivatedRoute: non usato, non chiamiamo ngOnInit in questo test
      router,
      protocolSvc,
      new PdfImportService(),
      new WorkoutDataService(),
      cdr,
      new ProtocolBuilderStateService(),
      new ToastService(),
      new ConfirmDialogService()
    );

    component.clientId = 'client1';
    component.protocolId = 'proto1';
    component.protocol = buildProtocol();

    await component.save(false);

    expect(updateCalls.length).toBe(1);
    const savedPatch = updateCalls[0][2];
    expect(savedPatch.workout.weekPlan).toEqual([
      { sets: 4, reps: 10 },
      { sets: 4, reps: 10 },
      { sets: 4, reps: 8 },
      { sets: 4, reps: 8 }
    ]);
  });

  it("save() usa totalWeeks quando non ci sono esercizi wave", async () => {
    // Protocollo senza esercizi wave (tutti 'plain'): attiva il fallback
    const protocolNoWave: Protocol = {
      id: 'proto2',
      clientId: 'client2',
      coachId: 'coach1',
      name: 'Protocollo no-wave',
      status: 'draft',
      source: 'pdf',
      workout: {
        programStart: '2026-01-01',
        // weekPlan stale con lunghezza 4 (deliberatamente != 8, per catturare regressioni)
        weekPlan: [
          { sets: 4, reps: 10 },
          { sets: 4, reps: 10 },
          { sets: 4, reps: 10 },
          { sets: 4, reps: 10 }
        ],
        days: [{
          id: 'day1',
          label: 'Gambe',
          rec: '60-90"',
          ex: [{
            name: 'Leg Press',
            scheme: 'plain',  // NON wave
            sets: 4,
            muscle: 'Gambe',
            reps: ['10']
            // Nessun weekPlan per-esercizio: non avremo wave weekPlans
          }]
        }]
      },
      diet: [],
      infoNote: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    };

    const updateCalls: any[][] = [];
    const protocolSvc: any = {
      update: (...args: any[]) => { updateCalls.push(args); return Promise.resolve(); },
      get: () => Promise.resolve(protocolNoWave),
      activate: () => Promise.resolve()
    };

    const router: any = { navigate: () => {} };
    const cdr: any = { detectChanges: () => {} };

    const component = new CoachProtocolBuilderComponent(
      {} as any,
      router,
      protocolSvc,
      new PdfImportService(),
      new WorkoutDataService(),
      cdr,
      new ProtocolBuilderStateService(),
      new ToastService(),
      new ConfirmDialogService()
    );

    component.clientId = 'client2';
    component.protocolId = 'proto2';
    component.protocol = protocolNoWave;

    await component.save(false);

    expect(updateCalls.length).toBe(1);
    const savedPatch = updateCalls[0][2];

    // Il fallback usa totalWeeks (= length del weekPlan stale = 4) e genera
    // un array di 4 elementi, ognuno { sets: 4, reps: 10 }
    expect(savedPatch.workout.weekPlan.length).toBe(4);
    expect(savedPatch.workout.weekPlan).toEqual([
      { sets: 4, reps: 10 },
      { sets: 4, reps: 10 },
      { sets: 4, reps: 10 },
      { sets: 4, reps: 10 }
    ]);
  });

  /**
   * La scheda del coach mostrava tutti i giorni aperti uno sotto l'altro. Ora
   * fa come la vede il cliente: prima l'elenco, poi dentro il giorno.
   */
  describe('i giorni si aprono uno per volta', () => {
    function montaComponente(protocolSvc: any = { update: () => Promise.resolve(), get: () => Promise.resolve(buildProtocol()), activate: () => Promise.resolve() }) {
      const navigazioni: any[] = [];
      const conferme: boolean[] = [];
      const confirmStub: any = { confirm: () => Promise.resolve(conferme.shift() ?? true) };
      const component = new CoachProtocolBuilderComponent(
        {} as any,
        { navigate: (...a: any[]) => { navigazioni.push(a); } } as any,
        protocolSvc,
        new PdfImportService(),
        new WorkoutDataService(),
        { detectChanges: () => {} } as any,
        new ProtocolBuilderStateService(),
        new ToastService(),
        confirmStub
      );
      component.clientId = 'client1';
      component.protocolId = 'proto1';
      component.protocol = buildProtocol();
      return { component, navigazioni, conferme };
    }

    it('si parte dall\'elenco, non dentro un giorno', () => {
      const { component } = montaComponente();
      expect(component.editingDay).toBeNull();
    });

    /* Chi crea un giorno lo vuole riempire: farlo tornare all'elenco per
       riaprirlo sarebbe un tocco in piu' senza motivo. */
    it('aggiungere un giorno ci porta dentro', () => {
      const { component } = montaComponente();
      component.addDay();
      expect(component.protocol!.workout.days.length).toBe(2);
      expect(component.editingDay?.day.label).toBe('Giorno 2');
      expect(component.editingDay?.index).toBe(1);
    });

    it('chiudere il giorno torna all\'elenco senza toccare niente', () => {
      const { component } = montaComponente();
      component.addDay();
      component.closeDay();
      expect(component.editingDay).toBeNull();
      expect(component.protocol!.workout.days.length).toBe(2);
    });

    /* "Salva giorno" scrive e RESTA nel builder: save() invece chiude e torna
       al cliente, che a meta' scheda butterebbe fuori. */
    it('salvare il giorno scrive e riporta all\'elenco, senza uscire dal builder', async () => {
      const scritture: any[] = [];
      const { component, navigazioni } = montaComponente({
        update: (...a: any[]) => { scritture.push(a); return Promise.resolve(); },
        get: () => Promise.resolve(buildProtocol()),
        activate: () => Promise.resolve()
      });
      component.openDay(component.protocol!.workout.days[0], 0);

      await component.saveDay();

      expect(scritture.length).toBe(1);
      expect(component.editingDay).toBeNull();
      expect(navigazioni.length).toBe(0);
    });

    /* Se la scrittura fallisce si resta nel giorno: chiudere l'elenco
       farebbe credere che sia andata. */
    it('se il salvataggio fallisce il giorno resta aperto', async () => {
      const { component } = montaComponente({
        update: () => Promise.reject(new Error('rete assente')),
        get: () => Promise.resolve(buildProtocol()),
        activate: () => Promise.resolve()
      });
      component.openDay(component.protocol!.workout.days[0], 0);

      await component.saveDay();

      expect(component.editingDay).not.toBeNull();
      expect(component.saveMsg).toContain('rete assente');
    });

    it('rimuovere un giorno chiede conferma, poi lo toglie e chiude', async () => {
      const { component } = montaComponente();
      component.openDay(component.protocol!.workout.days[0], 0);

      await component.removeDay(0);

      expect(component.protocol!.workout.days.length).toBe(0);
      expect(component.editingDay).toBeNull();
    });

    it('rispondendo no il giorno resta dov\'e\'', async () => {
      const { component, conferme } = montaComponente();
      conferme.push(false);
      await component.removeDay(0);
      expect(component.protocol!.workout.days.length).toBe(1);
    });

    it('il conteggio degli esercizi si legge come una frase', () => {
      const { component } = montaComponente();
      const giorno = component.protocol!.workout.days[0];
      expect(component.dayCount(giorno)).toBe('1 esercizio');
      giorno.ex = [];
      expect(component.dayCount(giorno)).toBe('Nessun esercizio');
      giorno.ex = [{} as any, {} as any];
      expect(component.dayCount(giorno)).toBe('2 esercizi');
    });
  });
});
/**
 * Trascinare un alimento.
 *
 * L'ordine di una lista non e' decorativo: il primo e' quello che chi si
 * allena legge per primo, quindi e' quello che compra. E un alimento finito
 * sotto il macro sbagliato - al coach capita, all'import da PDF capita di
 * piu' - prima si poteva solo cancellare e riscrivere.
 *
 * Qui si prova la parte che decide, non il dito: il trascinamento vero lo fa
 * la CDK, e quello che arriva al componente e' sempre questa forma.
 */
describe('CoachProtocolBuilderComponent — spostare un alimento', () => {
  function builder() {
    return new CoachProtocolBuilderComponent(
      {} as any, {} as any, {} as any, new PdfImportService(), new WorkoutDataService(),
      { detectChanges: () => {} } as any,
      new ProtocolBuilderStateService(), new ToastService(), new ConfirmDialogService()
    );
  }

  /** L'evento della CDK, ridotto a quello che il componente legge davvero. */
  function trascinamento<T>(da: T[], a: T[], daIdx: number, aIdx: number): any {
    return {
      previousContainer: { data: da },
      container: { data: a },
      previousIndex: daIdx,
      currentIndex: aIdx
    };
  }

  it('riordina dentro la stessa lista', () => {
    const c = builder();
    const lista = [{ name: 'Riso' }, { name: 'Pane' }, { name: 'Patate' }];
    c.riordina(lista, trascinamento(lista, lista, 2, 0));
    expect(lista.map(i => i.name)).toEqual(['Patate', 'Riso', 'Pane']);
  });

  it('lasciata dov\'era, non tocca niente', () => {
    const c = builder();
    const lista = [{ name: 'Riso' }, { name: 'Pane' }];
    c.riordina(lista, trascinamento(lista, lista, 1, 1));
    expect(lista.map(i => i.name)).toEqual(['Riso', 'Pane']);
  });

  it('sposta un alimento da un macro all\'altro', () => {
    const c = builder();
    const carb = [{ name: 'Riso', qty: '100 g' }, { name: 'Bresaola', qty: '80 g' }];
    const protein: any[] = [{ name: 'Pollo', qty: '150 g' }];

    // La bresaola era finita fra i carboidrati: va fra le proteine, in cima.
    c.spostaAlternativa(trascinamento(carb, protein, 1, 0), 'protein');

    expect(carb.map(i => i.name)).toEqual(['Riso']);
    expect(protein.map(i => i.name)).toEqual(['Bresaola', 'Pollo']);
  });

  it('dentro lo stesso macro si limita a riordinare', () => {
    const c = builder();
    const carb = [{ name: 'Riso' }, { name: 'Pane' }];
    c.spostaAlternativa(trascinamento(carb, carb, 1, 0), 'carb');
    expect(carb.map(i => i.name)).toEqual(['Pane', 'Riso']);
  });

  it('aggiorna il macro scritto nell\'alimento, se c\'era', () => {
    // `category` serve a leggere i protocolli vecchi, dove le alternative
    // erano una lista piatta. Dopo lo spostamento direbbe il falso.
    const c = builder();
    const carb = [{ name: 'Bresaola', qty: '80 g', category: 'carb' as const }];
    const protein: any[] = [];
    c.spostaAlternativa(trascinamento(carb, protein, 0, 0), 'protein');
    expect(protein[0].category).toBe('protein');
  });

  it('non lo aggiunge dove non c\'era', () => {
    const c = builder();
    const carb = [{ name: 'Bresaola', qty: '80 g' }];
    const protein: any[] = [];
    c.spostaAlternativa(trascinamento(carb, protein, 0, 0), 'protein');
    expect('category' in protein[0]).toBe(false);
  });

  it('un macro vuoto riceve lo stesso', () => {
    const c = builder();
    const carb = [{ name: 'Olio EVO' }];
    const fat: any[] = [];
    c.spostaAlternativa(trascinamento(carb, fat, 0, 0), 'fat');
    expect(carb).toEqual([]);
    expect(fat.map(i => i.name)).toEqual(['Olio EVO']);
  });

  it('col dito la presa aspetta un istante, col mouse no', () => {
    // Sul telefono la maniglia sta dentro una pagina che scorre: senza quel
    // ritardo il gesto per scendere diventerebbe a volte un trascinamento.
    expect(builder().ritardoPresa).toEqual({ touch: 150, mouse: 0 });
  });
});
