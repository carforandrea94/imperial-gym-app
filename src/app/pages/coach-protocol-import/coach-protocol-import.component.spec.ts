import { vi } from 'vitest';

// pdfjs-dist tocca API browser assenti nell'ambiente di test: stesso mock gia' usato
// in pdf-import.service.spec.ts e in coach-protocol-builder.component.spec.ts.
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {},
  version: '0.0.0',
  getDocument: () => ({ promise: Promise.resolve({ numPages: 0 }) })
}));

import { CoachProtocolImportComponent } from './coach-protocol-import.component';
import { PdfImportService, ParsedSupplements } from '../../services/pdf-import.service';
import { ProtocolService } from '../../services/protocol.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { AuthService } from '../../core/services/auth.service';
import { Diet } from '../../models/diet.model';

describe('CoachProtocolImportComponent', () => {
  function emptyAlternatives() {
    return { carb: [], protein: [], fat: [] };
  }

  function buildDiet(): Diet {
    return [
      {
        id: 'plan-on', name: 'Giorno ON', meals: [
          { id: 'm1', name: 'Colazione', combinations: [], alternatives: emptyAlternatives() },
          { id: 'm2', name: 'Cena', combinations: [], alternatives: emptyAlternatives() }
        ]
      },
      {
        id: 'plan-off', name: 'Giorno OFF', meals: [
          { id: 'm3', name: 'Colazione', combinations: [], alternatives: emptyAlternatives() },
          { id: 'm4', name: 'Cena', combinations: [], alternatives: emptyAlternatives() }
        ]
      }
    ];
  }

  function buildComponent(): CoachProtocolImportComponent {
    return new CoachProtocolImportComponent(
      {} as any, // ActivatedRoute: non usato, non chiamiamo ngOnInit
      {} as any, // Router
      new PdfImportService(),
      {} as any, // ProtocolService
      {} as any, // ConfirmDialogService
      {} as any, // AuthService
      { detectChanges: () => {} } as any // ChangeDetectorRef
    );
  }

  it('applica "always" a tutti i piani e "onlyOn" (con creazione pasto mancante) solo ai piani con "on" nel nome', () => {
    const component = buildComponent();
    const diet = buildDiet();
    const parsed: ParsedSupplements = {
      always: {
        Colazione: [{ name: 'Vitamina C+B', qty: '1 dose' }],
        Cena: [{ name: 'Magnesio', qty: '400 mg' }]
      },
      onlyOn: {
        Cena: [{ name: 'Creatina', qty: '5 g' }],
        'Intra-Workout': [{ name: 'Intra-workout', qty: '10 g' }]
      }
    };

    (component as any).applyParsedSupplements(diet, parsed);

    const onPlan = diet.find(p => p.name === 'Giorno ON')!;
    const offPlan = diet.find(p => p.name === 'Giorno OFF')!;

    expect(onPlan.meals.find(m => m.name === 'Colazione')!.supplements)
      .toEqual([{ name: 'Vitamina C+B', qty: '1 dose' }]);
    // Cena nel piano ON: Magnesio (always) + Creatina (onlyOn) insieme, non sostituiti.
    expect(onPlan.meals.find(m => m.name === 'Cena')!.supplements)
      .toEqual([{ name: 'Magnesio', qty: '400 mg' }, { name: 'Creatina', qty: '5 g' }]);
    // Pasto mancante creato solo per Intra-Workout, solo nel piano ON.
    const intraWorkout = onPlan.meals.find(m => m.name === 'Intra-Workout');
    expect(intraWorkout).toBeTruthy();
    expect(intraWorkout!.supplements).toEqual([{ name: 'Intra-workout', qty: '10 g' }]);

    // Piano OFF: solo le voci "always", nessuna Creatina, nessun pasto Intra-Workout creato.
    expect(offPlan.meals.find(m => m.name === 'Colazione')!.supplements)
      .toEqual([{ name: 'Vitamina C+B', qty: '1 dose' }]);
    expect(offPlan.meals.find(m => m.name === 'Cena')!.supplements)
      .toEqual([{ name: 'Magnesio', qty: '400 mg' }]);
    expect(offPlan.meals.find(m => m.name === 'Intra-Workout')).toBeUndefined();
  });
});
