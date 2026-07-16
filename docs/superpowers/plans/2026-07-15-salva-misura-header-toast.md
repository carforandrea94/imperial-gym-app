# Bottone Salva di Misura-Categoria nell'Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Spostare il bottone "Salva" di `MisuraCategoriaComponent` (route `/misure/:categoria`, usata sia per registrare una nuova misurazione sia per modificarne una passata) nell'header come icona, con l'esito comunicato dal `ToastService` gia' esistente.

**Architecture:** Nuovo `MeasureCategoryStateService` (root, stesso pattern di `HistoryEditStateService`/`ProtocolBuilderStateService`: `saving` signal + `registerSaveHandler`/`requestSave()`). A differenza di history-detail, la visibilita' dell'icona dipende solo dalla route (nessun sotto-stato "edit mode" della pagina): un nuovo flag `showSaveMeasure` in `app.ts`, vero solo quando la route combacia con `/misure/(peso|centimetri|pliche)`.

**Tech Stack:** Angular 21 standalone components/signals, CSS puro, Vitest (`npx ng test --watch=false`).

## Global Constraints

- Testo esatto dei toast: nuova misurazione, successo → `'Misurazione salvata ✓'`; nuova misurazione, errore → `'Errore durante il salvataggio. Riprova.'`; modifica, successo → `'Misurazione aggiornata ✓'`; modifica, collisione → `'Esiste gia\' una misurazione di questo tipo in questa data.'`; modifica, errore generico → `'Errore durante il salvataggio. Riprova.'`.
- `errorMsg` (messaggio di data futura/collisione mostrato inline) resta invariato — il toast si aggiunge, non sostituisce.
- Il campo `saveStatus: 'idle'|'err'` e i metodi `getSaveBtnClass()`/`getSaveBtnText()` vengono rimossi insieme al bottone in fondo pagina (nessun altro consumatore).
- L'icona nell'header usa lo stesso checkmark SVG gia' riusato per `showSaveEdit` (`src/app/components/navbar/navbar.component.html:43-48`).
- Nessuna modifica a `ToastService`, alle altre pagine gia' migrate, o al comportamento delle route diverse da `/misure/:categoria`.

---

### Task 1: `MeasureCategoryStateService`

**Files:**
- Create: `src/app/services/measure-category-state.service.ts`
- Test: `src/app/services/measure-category-state.service.spec.ts`

**Interfaces:**
- Produces: `MeasureCategoryStateService.saving: Signal<boolean>`, `.registerSaveHandler(handler: (() => void) | null): void`, `.requestSave(): void`.

- [ ] **Step 1: Scrivi il test che fallisce**

```ts
// src/app/services/measure-category-state.service.spec.ts
import { MeasureCategoryStateService } from './measure-category-state.service';

describe('MeasureCategoryStateService', () => {
  let service: MeasureCategoryStateService;

  beforeEach(() => {
    service = new MeasureCategoryStateService();
  });

  it('saving parte a false', () => {
    expect(service.saving()).toBe(false);
  });

  it('requestSave() senza handler registrato non lancia', () => {
    expect(() => service.requestSave()).not.toThrow();
  });

  it('requestSave() invoca l\'handler registrato', () => {
    const handler = vi.fn();
    service.registerSaveHandler(handler);
    service.requestSave();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('registerSaveHandler(null) rimuove l\'handler', () => {
    const handler = vi.fn();
    service.registerSaveHandler(handler);
    service.registerSaveHandler(null);
    service.requestSave();
    expect(handler).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npx ng test --watch=false --include='**/measure-category-state.service.spec.ts'`
Expected: FAIL — `Cannot find module './measure-category-state.service'`

- [ ] **Step 3: Implementa `MeasureCategoryStateService`**

```ts
// src/app/services/measure-category-state.service.ts
import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class MeasureCategoryStateService {
  saving = signal(false);
  private saveHandler: (() => void) | null = null;

  registerSaveHandler(handler: (() => void) | null): void {
    this.saveHandler = handler;
  }

  requestSave(): void {
    this.saveHandler?.();
  }
}
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npx ng test --watch=false --include='**/measure-category-state.service.spec.ts'`
Expected: PASS — 4/4 test verdi

- [ ] **Step 5: Commit**

```bash
git add src/app/services/measure-category-state.service.ts src/app/services/measure-category-state.service.spec.ts
git commit -m "feat: aggiungi MeasureCategoryStateService per il salvataggio da header"
```

---

### Task 2: `MisuraCategoriaComponent` — usa `MeasureCategoryStateService` + toast, rimuovi il bottone in fondo pagina

**Files:**
- Modify: `src/app/pages/misura-categoria/misura-categoria.component.ts` (import, costruttore, campo `saveStatus`, metodi `getSaveBtnClass`/`getSaveBtnText`, `ngOnInit`, `ngOnDestroy`, `save()`)
- Modify: `src/app/pages/misura-categoria/misura-categoria.component.html:32-36` (rimozione del blocco `.savebar`)

**Interfaces:**
- Consumes: `MeasureCategoryStateService` (Task 1), `ToastService.success`/`.error` (gia' esistente in `src/app/services/toast.service.ts`).
- Produces: nessuna nuova interfaccia esterna.

Nessun nuovo `.spec.ts` dedicato (nessun test esistente per questo componente in questo progetto, comportamento verificato manualmente — stessa convenzione gia' seguita per history-detail/coach-protocol-builder nella feature precedente).

- [ ] **Step 1: Import dei servizi**

In `src/app/pages/misura-categoria/misura-categoria.component.ts:8` (ultima riga import esistente), aggiungi subito dopo:

```ts
import { MeasureCategoryStateService } from '../../services/measure-category-state.service';
import { ToastService } from '../../services/toast.service';
```

- [ ] **Step 2: Rimuovi `saveStatus` e i 2 metodi che lo consumavano**

Le righe attuali (righe 30, 107-113):

```ts
  saveStatus: 'idle' | 'err' = 'idle';
```

e

```ts
  getSaveBtnClass(): string {
    return this.saveStatus === 'err' ? 'savebtn err' : 'savebtn';
  }

  getSaveBtnText(): string {
    return this.saveStatus === 'err' ? '✕ Errore salvataggio' : 'Salva';
  }
```

vanno rimosse interamente (nessun altro codice in questo file o nel template le usa dopo lo Step 7 di questo task, che rimuove il bottone che le consumava).

- [ ] **Step 3: Aggiungi i 2 servizi al costruttore**

Il costruttore attuale (righe 37-42):

```ts
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private data: MeasurementDataService,
    private cdr: ChangeDetectorRef
  ) {}
```

diventa:

```ts
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private data: MeasurementDataService,
    private cdr: ChangeDetectorRef,
    private measureState: MeasureCategoryStateService,
    private toast: ToastService
  ) {}
```

- [ ] **Step 4: Registra/deregistra l'handler in `ngOnInit`/`ngOnDestroy`**

`ngOnInit` attuale (righe 44-55):

```ts
  ngOnInit(): void {
    this.paramSub = this.route.paramMap.subscribe(params => {
      this.category = params.get('categoria') as MeasureCategory;
      if (!CATEGORY_FIELDS[this.category]) {
        this.router.navigate(['/misure']);
        return;
      }
      this.fields = CATEGORY_FIELDS[this.category];
      this.title = CATEGORY_LABELS[this.category];
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.paramSub?.unsubscribe();
    if (this.draftTimer) clearTimeout(this.draftTimer);
  }
```

diventa:

```ts
  ngOnInit(): void {
    this.measureState.registerSaveHandler(() => this.save());
    this.paramSub = this.route.paramMap.subscribe(params => {
      this.category = params.get('categoria') as MeasureCategory;
      if (!CATEGORY_FIELDS[this.category]) {
        this.router.navigate(['/misure']);
        return;
      }
      this.fields = CATEGORY_FIELDS[this.category];
      this.title = CATEGORY_LABELS[this.category];
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.paramSub?.unsubscribe();
    if (this.draftTimer) clearTimeout(this.draftTimer);
    this.measureState.registerSaveHandler(null);
  }
```

- [ ] **Step 5: Aggiorna `save()`**

Il metodo attuale (righe 115-149):

```ts
  async save(): Promise<void> {
    if (!this.hasAnyValue()) return;
    if (this.dateValue > this.maxDate) {
      this.errorMsg = 'Non puoi registrare una misurazione in una data futura.';
      this.cdr.detectChanges();
      return;
    }
    if (this.draftTimer) { clearTimeout(this.draftTimer); this.draftTimer = null; }
    this.errorMsg = '';

    if (!this.isEdit) {
      const ok = await this.data.saveCategoryToday(this.category, this.values);
      if (ok) {
        await this.data.clearDraft(this.category);
        this.router.navigate(['/misure']);
      } else {
        this.saveStatus = 'err';
        this.cdr.detectChanges();
        setTimeout(() => { this.saveStatus = 'idle'; this.cdr.detectChanges(); }, 2000);
      }
      return;
    }

    const result = await this.data.moveCategoryEntry(this.category, this.originalDate, this.dateValue, this.values);
    if (result === 'ok') {
      this.router.navigate(['/misure/storico', this.dateValue]);
    } else if (result === 'collision') {
      this.errorMsg = 'Esiste gia\' una misurazione di questo tipo in questa data.';
      this.cdr.detectChanges();
    } else {
      this.saveStatus = 'err';
      this.cdr.detectChanges();
      setTimeout(() => { this.saveStatus = 'idle'; this.cdr.detectChanges(); }, 2000);
    }
  }
```

diventa:

```ts
  async save(): Promise<void> {
    if (!this.hasAnyValue()) return;
    if (this.dateValue > this.maxDate) {
      this.errorMsg = 'Non puoi registrare una misurazione in una data futura.';
      this.cdr.detectChanges();
      return;
    }
    if (this.draftTimer) { clearTimeout(this.draftTimer); this.draftTimer = null; }
    this.errorMsg = '';
    this.measureState.saving.set(true);

    if (!this.isEdit) {
      const ok = await this.data.saveCategoryToday(this.category, this.values);
      this.measureState.saving.set(false);
      if (ok) {
        await this.data.clearDraft(this.category);
        this.toast.success('Misurazione salvata ✓');
        this.router.navigate(['/misure']);
      } else {
        this.toast.error('Errore durante il salvataggio. Riprova.');
      }
      return;
    }

    const result = await this.data.moveCategoryEntry(this.category, this.originalDate, this.dateValue, this.values);
    this.measureState.saving.set(false);
    if (result === 'ok') {
      this.toast.success('Misurazione aggiornata ✓');
      this.router.navigate(['/misure/storico', this.dateValue]);
    } else if (result === 'collision') {
      this.errorMsg = 'Esiste gia\' una misurazione di questo tipo in questa data.';
      this.cdr.detectChanges();
      this.toast.error('Esiste gia\' una misurazione di questo tipo in questa data.');
    } else {
      this.toast.error('Errore durante il salvataggio. Riprova.');
    }
  }
```

- [ ] **Step 6: Verifica che `MeasurementDataService`/`CATEGORY_FIELDS` etc. restino usati correttamente**

Nessuna modifica ad altri metodi del file (`load()`, `emptyValues()`, `onInput()`, `hasAnyValue()`) — non toccarli.

- [ ] **Step 7: Rimuovi il bottone "Salva" dal template**

In `src/app/pages/misura-categoria/misura-categoria.component.html:32-36`, attuale:

```html
  <div class="savebar">
    <button [class]="getSaveBtnClass()" (click)="save()">
      {{ getSaveBtnText() }}
    </button>
  </div>
```

va rimosso interamente (nessuna riga sostitutiva — il salvataggio ora avviene solo dall'header).

- [ ] **Step 8: Verifica compilazione e test invariati**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx ng test --watch=false && npx ng build`
Expected: nessun errore; stesso numero di test verdi di prima + i 4 di Task 1; build completata senza errori.

- [ ] **Step 9: Commit**

```bash
git add src/app/pages/misura-categoria/misura-categoria.component.ts src/app/pages/misura-categoria/misura-categoria.component.html
git commit -m "feat: sposta il salvataggio di misura-categoria su MeasureCategoryStateService + toast"
```

---

### Task 3: icona "Salva" di misura-categoria nell'header

**Files:**
- Modify: `src/app/components/navbar/navbar.component.ts` (nuovi `@Input`/`@Output`)
- Modify: `src/app/components/navbar/navbar.component.html:12` (condizione `.hide`), dopo il bottone `showSaveEdit` (righe 43-48) (nuovo bottone icona)
- Modify: `src/app/app.ts` (import servizio, iniezione, campo `showSaveMeasure`, reset in `updateNav()`, impostazione nel blocco `categoriaMatch`)
- Modify: `src/app/app.html` (nuovi binding su `<app-navbar>`)

**Interfaces:**
- Consumes: `MeasureCategoryStateService.saving`, `.requestSave()` (Task 1).
- Produces: `NavbarComponent.showSaveMeasure: boolean` (Input), `NavbarComponent.measureSaving: boolean` (Input), `NavbarComponent.saveMeasureClick: EventEmitter<void>` (Output).

- [ ] **Step 1: Aggiungi `@Input`/`@Output` a `NavbarComponent`**

In `src/app/components/navbar/navbar.component.ts:25-26`, attuale:

```ts
  @Input() showProtocolSave = false;
  @Input() protocolSaving = false;
```

diventa:

```ts
  @Input() showProtocolSave = false;
  @Input() protocolSaving = false;
  @Input() showSaveMeasure = false;
  @Input() measureSaving = false;
```

In `src/app/components/navbar/navbar.component.ts:37-38`, attuale:

```ts
  @Output() saveDraftClick = new EventEmitter<void>();
  @Output() saveActivateClick = new EventEmitter<void>();
```

diventa:

```ts
  @Output() saveDraftClick = new EventEmitter<void>();
  @Output() saveActivateClick = new EventEmitter<void>();
  @Output() saveMeasureClick = new EventEmitter<void>();
```

- [ ] **Step 2: Aggiungi il bottone icona in `navbar.component.html`**

In `src/app/components/navbar/navbar.component.html:12`, attuale:

```html
    <div class="navactions" [class.hide]="!showHistory && !showInfo && !showAnalytics && !showShoppingList && !showViewToggle && !showSaveWorkout && !showSettings && !showSaveEdit && !showProtocolSave">
```

diventa (aggiunto `&& !showSaveMeasure`):

```html
    <div class="navactions" [class.hide]="!showHistory && !showInfo && !showAnalytics && !showShoppingList && !showViewToggle && !showSaveWorkout && !showSettings && !showSaveEdit && !showProtocolSave && !showSaveMeasure">
```

Subito dopo il bottone `showSaveEdit` (righe 43-48) e prima del blocco `.protocolsave` (riga 49), aggiungi:

```html
      <button class="navicon" *ngIf="showSaveMeasure" [disabled]="measureSaving"
        (click)="saveMeasureClick.emit()" aria-label="Salva misurazione" title="Salva misurazione">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
      </button>
```

- [ ] **Step 3: Inietta `MeasureCategoryStateService` in `app.ts`, aggiungi il campo, resettalo e impostalo sulla route giusta**

In `src/app/app.ts:17-18` (ultime import esistenti), aggiungi subito dopo:

```ts
import { MeasureCategoryStateService } from './services/measure-category-state.service';
```

Il campo `showSettings`/`showChrome` attuale (`src/app/app.ts:38-39`):

```ts
  showSettings = false;
  showChrome = false;
```

diventa:

```ts
  showSettings = false;
  showSaveMeasure = false;
  showChrome = false;
```

Il costruttore attuale (righe 47-56):

```ts
  constructor(
    private router: Router,
    private workoutData: WorkoutDataService,
    public workoutState: WorkoutStateService,
    public dietState: DietStateService,
    public auth: AuthService,
    private swUpdate: SwUpdate,
    public historyEditState: HistoryEditStateService,
    public protocolBuilderState: ProtocolBuilderStateService
  ) {}
```

diventa:

```ts
  constructor(
    private router: Router,
    private workoutData: WorkoutDataService,
    public workoutState: WorkoutStateService,
    public dietState: DietStateService,
    public auth: AuthService,
    private swUpdate: SwUpdate,
    public historyEditState: HistoryEditStateService,
    public protocolBuilderState: ProtocolBuilderStateService,
    public measureState: MeasureCategoryStateService
  ) {}
```

Il reset dei flag all'inizio di `updateNav()` (righe 110-114), attuale:

```ts
    this.showChrome = true;
    this.showShoppingList = false;
    this.showViewToggle = false;
    this.showSaveWorkout = false;
    this.showSettings = false;
```

diventa:

```ts
    this.showChrome = true;
    this.showShoppingList = false;
    this.showViewToggle = false;
    this.showSaveWorkout = false;
    this.showSettings = false;
    this.showSaveMeasure = false;
```

Il blocco `categoriaMatch` (righe 250-260), attuale:

```ts
    const categoriaMatch = u.match(/^\/misure\/(peso|centimetri|pliche)$/);
    if (categoriaMatch) {
      const isEdit = /[?&]date=/.test(url);
      this.navTitle = CATEGORY_LABELS[categoriaMatch[1] as MeasureCategory];
      this.navSubtitle = isEdit ? 'Modifica misurazione' : 'Nuova misurazione';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      return;
    }
```

diventa:

```ts
    const categoriaMatch = u.match(/^\/misure\/(peso|centimetri|pliche)$/);
    if (categoriaMatch) {
      const isEdit = /[?&]date=/.test(url);
      this.navTitle = CATEGORY_LABELS[categoriaMatch[1] as MeasureCategory];
      this.navSubtitle = isEdit ? 'Modifica misurazione' : 'Nuova misurazione';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      this.showSaveMeasure = true;
      return;
    }
```

- [ ] **Step 4: Aggiungi i binding in `app.html`**

Il blocco `<app-navbar>` attuale (`src/app/app.html:1-30`), righe 17-18:

```html
  [showProtocolSave]="showProtocolSave"
  [protocolSaving]="protocolBuilderState.saving()"
```

diventa:

```html
  [showProtocolSave]="showProtocolSave"
  [protocolSaving]="protocolBuilderState.saving()"
  [showSaveMeasure]="showSaveMeasure"
  [measureSaving]="measureState.saving()"
```

e righe 28-29:

```html
  (saveDraftClick)="protocolBuilderState.requestSaveDraft()"
  (saveActivateClick)="protocolBuilderState.requestSaveActivate()">
```

diventano:

```html
  (saveDraftClick)="protocolBuilderState.requestSaveDraft()"
  (saveActivateClick)="protocolBuilderState.requestSaveActivate()"
  (saveMeasureClick)="measureState.requestSave()">
```

- [ ] **Step 5: Verifica compilazione e test invariati**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx ng test --watch=false && npx ng build`
Expected: nessun errore; stesso numero di test verdi di prima; build completata senza errori.

- [ ] **Step 6: Verifica manuale**

Run: `npx ng serve`, apri "Registra misurazione" (peso/pliche/centimetri) da `/misure`: deve comparire l'icona di salvataggio nell'header (non il vecchio bottone in fondo pagina); inserisci un valore e premi l'icona: la misurazione si salva, compare il toast verde "Misurazione salvata ✓", si torna a `/misure`. Apri una misurazione passata da modificare (da `/misure/storico`): la stessa icona compare, salvare mostra "Misurazione aggiornata ✓" e torna allo storico.

- [ ] **Step 7: Commit**

```bash
git add src/app/components/navbar/navbar.component.ts src/app/components/navbar/navbar.component.html src/app/app.ts src/app/app.html
git commit -m "feat: icona di salvataggio di misura-categoria nell'header"
```

---

## Self-Review Notes

- **Spec coverage:** `MeasureCategoryStateService` → Task 1; rewiring di `MisuraCategoriaComponent` (rimozione `saveStatus`/`getSaveBtnClass`/`getSaveBtnText`, toast su tutti e 5 gli esiti, rimozione bottone) → Task 2; icona header + flag di route `showSaveMeasure` (nessun sotto-stato di pagina, a differenza di history-detail) → Task 3. Tutti i testi esatti dei toast sono ripetuti nei Global Constraints e nel Task 2. Nessun gap.
- **Placeholder scan:** nessun TBD/TODO; ogni step ha codice completo con path esatti.
- **Type consistency:** `MeasureCategoryStateService.saving: Signal<boolean>`, `.registerSaveHandler`/`.requestSave()` usati identici in Task 2/3. `NavbarComponent` nuovi Input/Output (`showSaveMeasure`, `measureSaving`, `saveMeasureClick`) hanno lo stesso nome in Task 3 e nei binding di `app.html`.
