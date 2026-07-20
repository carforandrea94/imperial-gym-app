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
    const protocolSvc: any = {
      update: () => Promise.resolve(),
      get: () => Promise.resolve(buildProtocol()),
      activate: () => Promise.resolve()
    };
    (protocolSvc.update as any).calls = [];
    const originalUpdate = protocolSvc.update;
    protocolSvc.update = (...args: any[]) => { protocolSvc.update.calls.push(args); return originalUpdate(); };
    protocolSvc.update.calls = [];

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
      new ToastService()
    );

    component.clientId = 'client1';
    component.protocolId = 'proto1';
    component.protocol = buildProtocol();

    await component.save(false);

    expect(protocolSvc.update.calls.length).toBe(1);
    const savedPatch = protocolSvc.update.calls[0][2];
    expect(savedPatch.workout.weekPlan).toEqual([
      { sets: 4, reps: 10 },
      { sets: 4, reps: 10 },
      { sets: 4, reps: 8 },
      { sets: 4, reps: 8 }
    ]);
  });
});
