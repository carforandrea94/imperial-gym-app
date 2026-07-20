# Fix weekPlan protocollo desincronizzato — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Far sì che `Protocol.workout.weekPlan` (l'aggregato di progressione usato dalla pagina Info e dal riepilogo "Settimana X di N") resti sempre sincronizzato con la progressione reale degli esercizi, anche quando il coach modifica manualmente un esercizio wave nel builder dopo l'import PDF.

**Architecture:** `CoachProtocolBuilderComponent.save()` ricalcola `workout.weekPlan` chiamando `PdfImportService.detectProtocolWeekPlan(days, totalWeeks)` (già esistente e testato, oggi usato solo da `coach-protocol-import`) immediatamente prima di costruire il payload da salvare. Nessuna nuova astrazione: si tratta di aggiungere una dipendenza già pubblica e chiamarla al momento giusto.

**Tech Stack:** Angular 21 standalone components, Jasmine/Karma (`ng test`).

## Global Constraints

- Il ricalcolo usa `this.protocol.workout.weekPlan.length` come `totalWeeks` (NON un valore fisso come 8): preserva la durata del programma per protocolli non a 8 settimane.
- `PdfImportService.detectProtocolWeekPlan(days: Day[], totalWeeks: number): WeekPlan[]` è già definito e testato in `src/app/services/pdf-import.service.ts` — non va modificato.
- Nessuna modifica al modello `Protocol`/`WorkoutProtocol` (`src/app/models/protocol.model.ts`).
- Il componente `CoachProtocolBuilderComponent` non ha oggi un file di test: il test aggiunto in questo piano istanzia la classe direttamente con `new` (mock semplici per costruttore), senza `TestBed` — evita di introdurre per la prima volta in questo progetto machinery Angular di test (compilazione template, DI) per un metodo che non tocca il DOM.

---

### Task 1: Ricalcolare `workout.weekPlan` in `save()` + test dedicato

**Files:**
- Modify: `src/app/pages/coach-protocol-builder/coach-protocol-builder.component.ts` (import, costruttore, metodo `save()`)
- Create: `src/app/pages/coach-protocol-builder/coach-protocol-builder.component.spec.ts`

**Interfaces:**
- Consumes: `PdfImportService.detectProtocolWeekPlan(days: Day[], totalWeeks: number): WeekPlan[]` (già esistente, `src/app/services/pdf-import.service.ts`), `Protocol`/`WorkoutProtocol` da `src/app/models/protocol.model.ts`, `WeekPlan`/`Day`/`Exercise` da `src/app/models/workout.model.ts`.
- Produces: nessuna nuova interfaccia pubblica — comportamento interno di `save()`.

- [ ] **Step 1: Scrivi il test (che deve fallire) in un nuovo file**

Crea `src/app/pages/coach-protocol-builder/coach-protocol-builder.component.spec.ts`:

```ts
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
    const protocolSvc = jasmine.createSpyObj('ProtocolService', ['update', 'get', 'activate']);
    protocolSvc.update.and.returnValue(Promise.resolve());
    protocolSvc.get.and.returnValue(Promise.resolve(buildProtocol()));

    const router = jasmine.createSpyObj('Router', ['navigate']);
    const cdr = jasmine.createSpyObj('ChangeDetectorRef', ['detectChanges']);

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

    expect(protocolSvc.update).toHaveBeenCalled();
    const savedPatch = protocolSvc.update.calls.mostRecent().args[2];
    expect(savedPatch.workout.weekPlan).toEqual([
      { sets: 4, reps: 10 },
      { sets: 4, reps: 10 },
      { sets: 4, reps: 8 },
      { sets: 4, reps: 8 }
    ]);
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npx ng test --watch=false --include='**/coach-protocol-builder.component.spec.ts'`
Expected: FAIL — `savedPatch.workout.weekPlan` risulta `[{sets:4,reps:10},{sets:4,reps:10},{sets:4,reps:10},{sets:4,reps:10}]` (l'aggregato stale non ricalcolato), diverso da quello atteso `[...,{sets:4,reps:8},{sets:4,reps:8}]`.

- [ ] **Step 3: Implementa il fix minimo**

In `src/app/pages/coach-protocol-builder/coach-protocol-builder.component.ts`, aggiungi l'import (accanto agli altri import di servizi, riga ~11):

```ts
import { PdfImportService } from '../../services/pdf-import.service';
```

Modifica il costruttore (righe 56-64) aggiungendo `pdfSvc` subito dopo `protocolSvc`:

```ts
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private protocolSvc: ProtocolService,
    private pdfSvc: PdfImportService,
    public workoutData: WorkoutDataService,
    private cdr: ChangeDetectorRef,
    private protocolBuilderState: ProtocolBuilderStateService,
    private toast: ToastService
  ) {}
```

Modifica `save()` (righe 385-397) aggiungendo il ricalcolo subito dopo `this.protocolBuilderState.saving.set(true);` e prima di costruire `toSave`:

```ts
  async save(activateAfter: boolean): Promise<void> {
    if (!this.protocol) return;
    this.saving = true;
    this.saveMsg = '';
    this.protocolBuilderState.saving.set(true);
    try {
      // L'aggregato di progressione (usato da Info/riepilogo settimane) va
      // ricalcolato ad ogni salvataggio: se il coach ha modificato a mano la
      // progressione di un esercizio wave, questo lo tiene sincronizzato
      // invece di lasciarlo congelato al valore calcolato al momento
      // dell'import PDF.
      this.protocol.workout.weekPlan = this.pdfSvc.detectProtocolWeekPlan(
        this.protocol.workout.days,
        this.protocol.workout.weekPlan.length
      );

      const toSave = {
        name: this.protocol.name,
        workout: this.protocol.workout,
        diet: this.protocol.diet,
        infoNote: this.protocol.infoNote
      };
      await this.protocolSvc.update(this.clientId, this.protocolId, toSave);
```

(il resto del metodo, dalla riga `// Verifica reale...` in poi, resta invariato)

- [ ] **Step 4: Esegui di nuovo il test e verifica che passi**

Run: `npx ng test --watch=false --include='**/coach-protocol-builder.component.spec.ts'`
Expected: PASS

- [ ] **Step 5: Esegui l'intera suite per verificare che non ci siano regressioni**

Run: `npx ng test --watch=false`
Expected: PASS (tutti i test esistenti, incluso il nuovo, verdi — nessuna modifica ad altri file)

- [ ] **Step 6: Build di produzione**

Run: `npx ng build --configuration production`
Expected: build pulita, nessun errore TypeScript (il nuovo parametro del costruttore è usato correttamente)

- [ ] **Step 7: Commit**

```bash
git add src/app/pages/coach-protocol-builder/coach-protocol-builder.component.ts src/app/pages/coach-protocol-builder/coach-protocol-builder.component.spec.ts
git commit -m "fix: ricalcola workout.weekPlan del protocollo ad ogni salvataggio dal builder"
```

---

## Verifica manuale (non automatizzabile in questo piano)

Dopo l'implementazione, verificare in browser (coach): aprire un protocollo con almeno un esercizio wave, modificare la progressione settimanale di un esercizio nell'editor, salvare (bozza o attiva) — poi, lato cliente, controllare che la pagina Info ("Onda di carico") rifletta subito la nuova progressione invece di restare sul valore calcolato all'import.
