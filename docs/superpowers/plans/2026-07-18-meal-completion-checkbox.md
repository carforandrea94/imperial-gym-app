# Checkbox "pasto completato" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere una checkbox rotonda "pasto completato" nella card della vista slider di `dieta-detail`, con reset giornaliero basato sulla data di calendario, e far partire lo slider dal primo pasto non completato invece che dal pasto della fascia oraria corrente.

**Architecture:** Un nuovo campo `mealsCompletion: { date: string; done: Record<string, boolean> } | null` in `AppState` (stesso documento Firestore già usato per bozze allenamento/override recupero) persiste i pasti completati per la giornata odierna. Una nuova funzione pura `firstUncompletedIndex` (in un nuovo file util, con test unitari) sostituisce `findCurrentMealIndex` per decidere l'indice iniziale dello slider. La UI aggiunge una checkbox dedicata (`.meal-check`, 18px) solo nella card slider.

**Tech Stack:** Angular 21 standalone component, Firebase Firestore (via `AppStateService` esistente), Vitest.

## Global Constraints

- La checkbox compare **solo nella vista slider** di `dieta-detail`; la vista lista (accordion) non viene toccata.
- Il reset è "pigro" e lato client: nessuna scrittura automatica al cambio di giorno. Solo quando l'utente tocca una checkbox, si confronta la data salvata con `todayLocalISO()`; se diversa, si riparte da una mappa `done` vuota per oggi (i valori del giorno precedente vengono scartati, non riportati).
- `meal.id` è già globalmente univoco (generato con `newId('meal')`); la mappa `done` usa `meal.id` come chiave, senza bisogno di qualificarla con l'id del piano dieta.
- `firstUncompletedIndex` sostituisce interamente `findCurrentMealIndex`: quest'ultimo, insieme al file `src/app/core/utils/meal-time.util.ts` e al suo spec `meal-time.util.spec.ts`, va **eliminato** (nessun altro consumer nel codebase).
- La nuova checkbox usa una classe CSS dedicata `.meal-check` (18px) — **non modifica** `.set-check` (usata da scheda-detail per le serie di allenamento), che resta invariata.
- `AppStateService.patchField('mealsCompletion', { date, done })` sovrascrive per intero il campo ad ogni toggle (mai un merge parziale via dot-notation su singole chiavi di `done`), cosi' il reset "scarta" davvero i valori vecchi invece di accumularli.
- Il toggle della checkbox è una mutazione sincrona dentro un handler `(click)` — non serve `this.cdr.detectChanges()` (l'app è zoneless ma i binding `(click)` ottengono già un ciclo di change detection automatico; `cdr.detectChanges()` serve solo per mutazioni DOPO un `await`, pattern già stabilito nel resto della codebase).

---

## File Structure

- `src/app/core/utils/meal-completion.util.ts` — nuovo, funzione pura `firstUncompletedIndex`.
- `src/app/core/utils/meal-completion.util.spec.ts` — nuovo, test unitari.
- `src/app/core/utils/meal-time.util.ts` — **eliminato** (Task 2).
- `src/app/core/utils/meal-time.util.spec.ts` — **eliminato** (Task 2).
- `src/app/services/app-state.service.ts` — nuovo campo `mealsCompletion` in `AppState` e `emptyState()`.
- `src/app/pages/dieta-detail/dieta-detail.component.ts` — `MealVM.completed`, `ngOnInit` asincrono, `toggleMealCompleted`, uso di `firstUncompletedIndex` al posto di `findCurrentMealIndex`.
- `src/app/pages/dieta-detail/dieta-detail.component.html` — checkbox nella card slider.
- `src/styles.css` — nuova classe `.meal-check`.

---

### Task 1: Funzione `firstUncompletedIndex` + campo `AppState.mealsCompletion`

**Files:**
- Create: `src/app/core/utils/meal-completion.util.ts`
- Create: `src/app/core/utils/meal-completion.util.spec.ts`
- Modify: `src/app/services/app-state.service.ts`

**Interfaces:**
- Produces: `firstUncompletedIndex(meals: { completed: boolean }[]): number` — usata da Task 2.
- Produces: `AppState.mealsCompletion: { date: string; done: Record<string, boolean> } | null` — usata da Task 2.

- [ ] **Step 1: Scrivi il test che fallisce**

Crea `src/app/core/utils/meal-completion.util.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { firstUncompletedIndex } from './meal-completion.util';

describe('firstUncompletedIndex', () => {
  it('con array vuoto restituisce 0', () => {
    expect(firstUncompletedIndex([])).toBe(0);
  });

  it('se nessun pasto e completato restituisce 0', () => {
    const meals = [{ completed: false }, { completed: false }, { completed: false }];
    expect(firstUncompletedIndex(meals)).toBe(0);
  });

  it('restituisce il primo indice non completato', () => {
    const meals = [{ completed: true }, { completed: true }, { completed: false }, { completed: false }];
    expect(firstUncompletedIndex(meals)).toBe(2);
  });

  it('se tutti i pasti sono completati restituisce l\'ultimo indice', () => {
    const meals = [{ completed: true }, { completed: true }, { completed: true }];
    expect(firstUncompletedIndex(meals)).toBe(2);
  });

  it('con un solo pasto completato restituisce 0', () => {
    expect(firstUncompletedIndex([{ completed: true }])).toBe(0);
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npx ng test --watch=false --include='**/meal-completion.util.spec.ts'`
Expected: FAIL — `Cannot find module './meal-completion.util'` (il file non esiste ancora).

- [ ] **Step 3: Implementa la funzione**

Crea `src/app/core/utils/meal-completion.util.ts`:

```ts
/**
 * Trova l'indice del primo pasto non ancora completato. Se tutti i pasti
 * sono completati, restituisce l'ultimo indice (utile per rivedere cosa e
 * stato consumato). Con un array vuoto restituisce 0.
 */
export function firstUncompletedIndex(meals: { completed: boolean }[]): number {
  if (meals.length === 0) return 0;
  const idx = meals.findIndex(m => !m.completed);
  return idx === -1 ? meals.length - 1 : idx;
}
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npx ng test --watch=false --include='**/meal-completion.util.spec.ts'`
Expected: PASS — 5/5 test.

- [ ] **Step 5: Aggiungi il campo `mealsCompletion` ad `AppState`**

In `src/app/services/app-state.service.ts`, trova:

```ts
export interface AppState {
  workoutDrafts: Record<string, { rows: WorkoutDraftRow[] }[]>;
  restOverrides: Record<string, number>;
  measureDraft: Record<string, Record<string, string | null>> | null;
  shoppingChecked: Record<string, boolean>;
  workoutViewMode: 'list' | 'slider';
  dietViewMode: 'list' | 'slider';
}

function emptyState(): AppState {
  return { workoutDrafts: {}, restOverrides: {}, measureDraft: null, shoppingChecked: {}, workoutViewMode: 'list', dietViewMode: 'list' };
}
```

Sostituisci con:

```ts
export interface AppState {
  workoutDrafts: Record<string, { rows: WorkoutDraftRow[] }[]>;
  restOverrides: Record<string, number>;
  measureDraft: Record<string, Record<string, string | null>> | null;
  shoppingChecked: Record<string, boolean>;
  workoutViewMode: 'list' | 'slider';
  dietViewMode: 'list' | 'slider';
  mealsCompletion: { date: string; done: Record<string, boolean> } | null;
}

function emptyState(): AppState {
  return { workoutDrafts: {}, restOverrides: {}, measureDraft: null, shoppingChecked: {}, workoutViewMode: 'list', dietViewMode: 'list', mealsCompletion: null };
}
```

- [ ] **Step 6: Verifica che il progetto compili e i test passino**

Run: `npx ng build`
Expected: nessun errore.

Run: `npx ng test --watch=false`
Expected: tutti i test passano (nessuna regressione, il nuovo campo è additivo).

- [ ] **Step 7: Commit**

```bash
git add src/app/core/utils/meal-completion.util.ts src/app/core/utils/meal-completion.util.spec.ts src/app/services/app-state.service.ts
git commit -m "Aggiunge firstUncompletedIndex e campo AppState.mealsCompletion"
```

---

### Task 2: Logica del componente `DietaDetailComponent`

**Files:**
- Modify: `src/app/pages/dieta-detail/dieta-detail.component.ts`
- Delete: `src/app/core/utils/meal-time.util.ts`
- Delete: `src/app/core/utils/meal-time.util.spec.ts`

**Interfaces:**
- Consumes: `firstUncompletedIndex` e `AppState.mealsCompletion` da Task 1 (import da `../../core/utils/meal-completion.util` e uso di `this.appState: AppStateService` gia' iniettabile come negli altri componenti pagina, es. `scheda-detail.component.ts`).
- Produces: `MealVM.completed: boolean`, metodo `toggleMealCompleted(vm: MealVM): void` — usati da Task 3 nel template.

- [ ] **Step 1: Aggiorna gli import e l'interfaccia `MealVM`**

In `src/app/pages/dieta-detail/dieta-detail.component.ts`, trova:

```ts
import { Component, OnInit, ChangeDetectorRef, ElementRef, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DietDataService } from '../../services/diet-data.service';
import { DietStateService } from '../../services/diet-state.service';
import { findClosestSlideIndex, scrollToSlide } from '../../core/utils/horizontal-slider.util';
import { findCurrentMealIndex } from '../../core/utils/meal-time.util';
import { DietPlan, NamedMeal, MealCombination, FoodItem, FoodCategory, FOOD_CATEGORIES, FOOD_CATEGORY_LABELS } from '../../models/diet.model';

interface MealVM {
  meal: NamedMeal;
  open: boolean;
  selectedComboId: string;
}
```

Sostituisci con:

```ts
import { Component, OnInit, ChangeDetectorRef, ElementRef, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DietDataService } from '../../services/diet-data.service';
import { DietStateService } from '../../services/diet-state.service';
import { AppStateService } from '../../services/app-state.service';
import { findClosestSlideIndex, scrollToSlide } from '../../core/utils/horizontal-slider.util';
import { firstUncompletedIndex } from '../../core/utils/meal-completion.util';
import { todayLocalISO } from '../../core/utils/date.util';
import { DietPlan, NamedMeal, MealCombination, FoodItem, FoodCategory, FOOD_CATEGORIES, FOOD_CATEGORY_LABELS } from '../../models/diet.model';

interface MealVM {
  meal: NamedMeal;
  open: boolean;
  selectedComboId: string;
  completed: boolean;
}
```

- [ ] **Step 2: Inietta `AppStateService` nel costruttore e aggiorna l'`effect`**

Trova:

```ts
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public dietData: DietDataService,
    public state: DietStateService,
    private cdr: ChangeDetectorRef
  ) {
    // Il toggle vive nella navbar (fuori da questa pagina): quando si passa
    // a "slider" da un'altra vista/pagina, riparte dal pasto della fascia
    // oraria corrente (findCurrentMealIndex), non sempre dalla prima card.
    effect(() => {
      if (this.state.viewMode() === 'slider') {
        this.sliderIndex = findCurrentMealIndex(this.plan?.meals ?? []);
        setTimeout(() => this.scrollToIndex(this.sliderIndex), 0);
      }
    });
  }
```

Sostituisci con:

```ts
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public dietData: DietDataService,
    public state: DietStateService,
    private appState: AppStateService,
    private cdr: ChangeDetectorRef
  ) {
    // Il toggle vive nella navbar (fuori da questa pagina): quando si passa
    // a "slider" da un'altra vista/pagina, riparte dal primo pasto non
    // ancora completato oggi (firstUncompletedIndex), non sempre dalla
    // prima card e non piu' in base alla fascia oraria corrente.
    effect(() => {
      if (this.state.viewMode() === 'slider') {
        this.sliderIndex = firstUncompletedIndex(this.meals);
        setTimeout(() => this.scrollToIndex(this.sliderIndex), 0);
      }
    });
  }
```

- [ ] **Step 3: Rendi `ngOnInit` asincrono e applica lo stato di completamento**

Trova:

```ts
  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('mode') ?? ''; // param storico 'mode', ora contiene l'id del piano
    this.plan = this.dietData.getPlan(id);
    if (!this.plan) { this.router.navigate(['/dieta']); return; }

    this.meals = this.plan.meals.map(meal => ({
      meal,
      open: true,
      selectedComboId: meal.combinations[0]?.id ?? ''
    }));
  }
```

Sostituisci con:

```ts
  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('mode') ?? ''; // param storico 'mode', ora contiene l'id del piano
    this.plan = this.dietData.getPlan(id);
    if (!this.plan) { this.router.navigate(['/dieta']); return; }

    this.meals = this.plan.meals.map(meal => ({
      meal,
      open: true,
      selectedComboId: meal.combinations[0]?.id ?? '',
      completed: false
    }));

    const appState = await this.appState.load();
    const completion = appState.mealsCompletion;
    if (completion && completion.date === todayLocalISO()) {
      this.meals.forEach(vm => { vm.completed = !!completion.done[vm.meal.id]; });
    }

    this.sliderIndex = firstUncompletedIndex(this.meals);
    this.scrollToIndex(this.sliderIndex);
    this.cdr.detectChanges();
  }
```

Nota: il ricalcolo di `sliderIndex` a fine `ngOnInit` (dopo l'`await`) e' autoritativo. Se l'app parte gia' in modalita' slider, l'`effect` del costruttore potrebbe scattare prima che `appState.load()` sia risolto (userebbe `completed: false` per tutti, indice 0) — ma questo ricalcolo successivo sovrascrive `sliderIndex` e la posizione dello slider non appena i dati reali sono disponibili.

- [ ] **Step 4: Aggiungi il metodo `toggleMealCompleted`**

Aggiungi come nuovo metodo pubblico, subito dopo `scrollToIndex` (fine del file, prima della chiusura della classe):

```ts
  toggleMealCompleted(vm: MealVM): void {
    vm.completed = !vm.completed;
    const done: Record<string, boolean> = {};
    this.meals.forEach(m => { done[m.meal.id] = m.completed; });
    this.appState.patchField('mealsCompletion', { date: todayLocalISO(), done });
  }
```

Non serve `this.cdr.detectChanges()`: `vm.completed` viene mutato in modo sincrono dentro l'handler `(click)` che chiamera' questo metodo (Task 3), e i binding `(click)` ottengono gia' un ciclo di change detection automatico in questa app zoneless. `patchField` non viene atteso (fire-and-forget, stesso pattern gia' usato per il salvataggio della bozza allenamento in `scheda-detail.component.ts`): non c'e' nessuna azione UI che debba aspettare che la scrittura su Firestore sia completata.

- [ ] **Step 5: Elimina `meal-time.util.ts` e il suo test**

```bash
git rm src/app/core/utils/meal-time.util.ts src/app/core/utils/meal-time.util.spec.ts
```

- [ ] **Step 6: Verifica che il progetto compili e i test passino**

Run: `npx ng build`
Expected: nessun errore (nessun riferimento residuo a `findCurrentMealIndex`/`meal-time.util`).

Run: `npx ng test --watch=false`
Expected: tutti i test passano. Il numero totale di test diminuisce di 8 (i test di `meal-time.util.spec.ts` rimossi) e aumenta di 5 (quelli di `meal-completion.util.spec.ts` da Task 1) rispetto alla base pre-Task-1.

- [ ] **Step 7: Commit**

```bash
git add src/app/pages/dieta-detail/dieta-detail.component.ts
git commit -m "Aggiunge stato completamento pasto e sostituisce findCurrentMealIndex"
```

---

### Task 3: Checkbox nella card slider (template + CSS)

**Files:**
- Modify: `src/app/pages/dieta-detail/dieta-detail.component.html`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `MealVM.completed` e `toggleMealCompleted(vm)` da Task 2.

- [ ] **Step 1: Aggiungi la checkbox nella card slider**

In `src/app/pages/dieta-detail/dieta-detail.component.html`, trova (blocco vista slider):

```html
    <div class="meal mealslide exslide" *ngFor="let vm of meals">
      <div class="meal-summary noclick">
        <span>{{ vm.meal.name }}</span>
      </div>
```

Sostituisci con:

```html
    <div class="meal mealslide exslide" *ngFor="let vm of meals">
      <div class="meal-summary noclick">
        <span>{{ vm.meal.name }}</span>
        <div class="meal-check" [class.done]="vm.completed" (click)="toggleMealCompleted(vm)"></div>
      </div>
```

`.meal-summary` e' gia' `display:flex;justify-content:space-between` (`src/styles.css:377`): con un solo figlio (lo `<span>` del nome) oggi non ha effetto visibile, aggiungendo il secondo figlio (la checkbox) verra' spinto automaticamente sul bordo destro senza bisogno di altre modifiche di layout. La vista lista (accordion, blocco separato piu' in alto nello stesso file) non va toccata.

- [ ] **Step 2: Aggiungi lo stile `.meal-check`**

In `src/styles.css`, subito dopo la riga con `.set-check.done{background:var(--accent);border-color:var(--accent);color:#000;}` (riga 207), aggiungi:

```css
.meal-check{width:18px;height:18px;border-radius:50%;border:2px solid var(--label-3);background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;color:transparent;font-size:9px;font-weight:700;transition:background .18s ease,border-color .18s ease;flex-shrink:0;}
.meal-check.done{background:var(--accent);border-color:var(--accent);color:#000;}
```

Questa e' una classe dedicata, variante piu' piccola (18px invece di 28px) dello stesso linguaggio visivo di `.set-check` — non modifica `.set-check` ne' alcuna sua regola esistente.

- [ ] **Step 3: Verifica che il progetto compili e i test passino**

Run: `npx ng build`
Expected: nessun errore.

Run: `npx ng test --watch=false`
Expected: tutti i test passano (nessuna modifica di logica in questo task, solo template/CSS).

- [ ] **Step 4: Verifica visiva manuale**

Avvia l'app (`npx ng serve`), apri "Piano alimentare" in vista slider:
- La checkbox (18px, cerchio) compare in alto a destra di ogni card, accanto al nome del pasto.
- Al tap si riempie (`--accent` + spunta), al tap successivo torna vuota.
- Ricaricando la pagina, lo stato spuntato persiste (letto da Firestore).
- Aprendo la pagina, lo slider parte dal primo pasto non completato; se tutti sono completati, parte dall'ultimo.
- La vista lista (accordion) non mostra alcuna checkbox e resta invariata.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/dieta-detail/dieta-detail.component.html src/styles.css
git commit -m "Aggiunge checkbox pasto completato nella vista slider dieta"
```

---

## Self-Review Notes

- **Spec coverage:** checkbox solo in vista slider (Task 3) ✅, reset su data di calendario indipendente dal piano (Task 1 campo + Task 2 `todayLocalISO()` check) ✅, slider su primo non completato / ultimo se tutti completati (Task 1 `firstUncompletedIndex` + Task 2 doppio punto di chiamata) ✅, rimozione `findCurrentMealIndex`/`meal-time.util.ts` (Task 2 Step 5) ✅, `.meal-check` dedicata invece di modificare `.set-check` (Task 3) ✅, `mealsCompletion` overwrite completo non merge parziale (Task 2 Step 4, `patchField` con oggetto intero) ✅.
- **Placeholder scan:** nessun TBD/TODO; ogni step mostra il codice esatto prima/dopo.
- **Type consistency:** `MealVM.completed: boolean` (Task 2 Step 1) usato identicamente in `firstUncompletedIndex` (Task 1, tipo strutturale `{completed: boolean}[]`), nel template (Task 3, `[class.done]="vm.completed"`) e nel metodo di toggle (Task 2 Step 4). `AppState.mealsCompletion` (Task 1 Step 5) ha la stessa forma esatta ovunque venga letto/scritto (Task 2 Step 3 e Step 4).
- **Scope:** 3 task, ciascuno con una superficie di test/verifica indipendente (unit test puri, poi logica di componente con build+test, poi presentazione con verifica visiva) — coerente con la dimensione delle feature CSS/UI precedenti in questo stesso branch.
