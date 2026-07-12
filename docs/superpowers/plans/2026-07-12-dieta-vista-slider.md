# Vista slider/lista per la schermata Dieta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La schermata di dettaglio piano dieta (`/dieta/:mode`) ottiene lo stesso toggle lista/slider gia' presente nella schermata di dettaglio giorno di allenamento (`/scheda/day/:idx`), con una preferenza persistita indipendente da quella della scheda.

**Architecture:** Nuovo `DietStateService` (mirror di `WorkoutStateService`, stessa separazione dati/stato gia' esistente tra `DietDataService`/`WorkoutDataService` e i rispettivi state service) con un signal `viewMode`, persistito in `localStorage` + Firestore (`AppStateService.dietViewMode`, stesso trattamento di `workoutViewMode`). La navbar generica esistente (`showViewToggle`/`viewMode`/`viewModeChange`) viene abilitata anche per la route dieta. L'algoritmo di sincronizzazione scroll↔pallino gia' presente in `scheda-detail.component.ts` viene estratto in un helper condiviso in `core/utils/`, usato da entrambe le pagine.

**Tech Stack:** Angular 21 standalone components, signal, CSS scroll-snap (nessuna libreria slider esterna, stesso approccio gia' usato per la scheda).

## Global Constraints

- App zoneless (nessun zone.js): ogni cambio di stato che avviene dentro un evento non gia' tracciato da Angular (scroll handler, rAF callback) deve chiamare esplicitamente `ChangeDetectorRef.detectChanges()` — stesso trattamento gia' presente in `scheda-detail.component.ts`'s `onSliderScroll()`.
- Nessuna nuova classe CSS oltre alle 2 esplicitamente elencate nel Task 5 (`.meal.mealslide`, `.meal-summary.noclick`): tutto il resto della vista slider riusa le classi CSS gia' esistenti per lo slider degli esercizi (`.exslider-wrap`, `.exslider-counter`, `.exslider`, `.exslider-dots`, `.exslider-dot`), che sono generiche (flex/scroll-snap) nonostante il nome.
- Copy italiana, coerente con lo stile esistente.
- Convenzione di test del progetto: nessun nuovo test automatico per questo lavoro di UI/interazione (stessa convenzione gia' confermata con l'utente per la feature analoga della scheda e per il resto del progetto) — verifica tramite `npx tsc --noEmit -p tsconfig.app.json`, `npx ng test --watch=false` (33/33 attesi, invariato), `npx ng build`.
- Preferenza vista dieta indipendente da quella della scheda: chiavi `localStorage` (`dietaViewMode` vs `schedaViewMode`) e campi Firestore (`dietViewMode` vs `workoutViewMode`) separati.

---

### Task 1: campo `dietViewMode` in AppStateService

**Files:**
- Modify: `src/app/services/app-state.service.ts:14-24`

**Interfaces:**
- Produces: `AppState.dietViewMode: 'list' | 'slider'` (usato dal Task 3).

- [ ] **Step 1: Aggiungi il campo al modello e al default**

In `src/app/services/app-state.service.ts`, l'interfaccia `AppState` e `emptyState()` sono:

```ts
export interface AppState {
  workoutDrafts: Record<string, { rows: WorkoutDraftRow[] }[]>;
  restOverrides: Record<string, number>;
  measureDraft: Record<string, Record<string, string | null>> | null;
  shoppingChecked: Record<string, boolean>;
  workoutViewMode: 'list' | 'slider';
}

function emptyState(): AppState {
  return { workoutDrafts: {}, restOverrides: {}, measureDraft: null, shoppingChecked: {}, workoutViewMode: 'list' };
}
```

Sostituiscile con (aggiunto `dietViewMode`, stesso trattamento di `workoutViewMode`):

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

- [ ] **Step 2: Verifica**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add src/app/services/app-state.service.ts
git commit -m "feat: aggiunge dietViewMode allo stato applicazione, mirror di workoutViewMode"
```

---

### Task 2: estrai l'algoritmo di sincronizzazione scroll↔slider in un helper condiviso

**Files:**
- Create: `src/app/core/utils/horizontal-slider.util.ts`
- Modify: `src/app/pages/scheda-detail/scheda-detail.component.ts:238-263`

**Interfaces:**
- Produces: `findClosestSlideIndex(container: HTMLElement): number`, `scrollToSlide(container: HTMLElement | undefined, idx: number): void` — usati sia da `scheda-detail.component.ts` (questo task) sia da `dieta-detail.component.ts` (Task 5).
- Consumes: nessuna dipendenza da task precedenti.

Questo task e' un refactor a comportamento invariato: nessuna modifica visibile, verificata a mano (l'app non ha test di componente per `scheda-detail`).

- [ ] **Step 1: Crea l'helper condiviso**

Crea `src/app/core/utils/horizontal-slider.util.ts`:

```ts
/**
 * Trova l'indice della card visibile piu' vicina alla posizione di scroll
 * corrente, per uno slider orizzontale con scroll-snap (una card = un
 * figlio diretto del container). Usato per sincronizzare l'indicatore
 * (pallini/contatore) con lo scroll reale dell'utente.
 */
export function findClosestSlideIndex(container: HTMLElement): number {
  const children = Array.from(container.children) as HTMLElement[];
  let closest = 0;
  let minDist = Infinity;
  children.forEach((child, idx) => {
    const dist = Math.abs(child.offsetLeft - container.scrollLeft);
    if (dist < minDist) { minDist = dist; closest = idx; }
  });
  return closest;
}

/** Scorre lo slider fino a portare la card all'indice dato nella vista (usato dal tap su un pallino). */
export function scrollToSlide(container: HTMLElement | undefined, idx: number): void {
  const child = container?.children[idx] as HTMLElement | undefined;
  child?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}
```

- [ ] **Step 2: Aggiorna scheda-detail.component.ts per usare l'helper**

In `src/app/pages/scheda-detail/scheda-detail.component.ts`, aggiungi l'import in cima al file (accanto agli altri import):

```ts
import { findClosestSlideIndex, scrollToSlide } from '../../core/utils/horizontal-slider.util';
```

Sostituisci il corpo di `onSliderScroll()`/`scrollToIndex()` (attualmente righe 238-263):

```ts
  onSliderScroll(): void {
    if (this.scrollTicking) return;
    this.scrollTicking = true;
    requestAnimationFrame(() => {
      this.scrollTicking = false;
      const el = this.sliderEl?.nativeElement;
      if (!el) return;
      const children = Array.from(el.children) as HTMLElement[];
      let closest = 0;
      let minDist = Infinity;
      children.forEach((child, idx) => {
        const dist = Math.abs(child.offsetLeft - el.scrollLeft);
        if (dist < minDist) { minDist = dist; closest = idx; }
      });
      if (closest !== this.sliderIndex) {
        this.sliderIndex = closest;
        this.cdr.detectChanges();
      }
    });
  }

  scrollToIndex(idx: number): void {
    const el = this.sliderEl?.nativeElement;
    const child = el?.children[idx] as HTMLElement | undefined;
    child?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
```

con:

```ts
  onSliderScroll(): void {
    if (this.scrollTicking) return;
    this.scrollTicking = true;
    requestAnimationFrame(() => {
      this.scrollTicking = false;
      const el = this.sliderEl?.nativeElement;
      if (!el) return;
      const closest = findClosestSlideIndex(el);
      if (closest !== this.sliderIndex) {
        this.sliderIndex = closest;
        this.cdr.detectChanges();
      }
    });
  }

  scrollToIndex(idx: number): void {
    scrollToSlide(this.sliderEl?.nativeElement, idx);
  }
```

- [ ] **Step 3: Verifica**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx ng test --watch=false && npx ng build`
Expected: tsc pulito, 33/33 test (invariato), build ok. Verifica a mano (o per ragionamento sul codice) che il comportamento dello slider esercizi sia identico a prima: nessuna logica cambiata, solo estratta.

- [ ] **Step 4: Commit**

```bash
git add src/app/core/utils/horizontal-slider.util.ts src/app/pages/scheda-detail/scheda-detail.component.ts
git commit -m "refactor: estrae la sincronizzazione scroll-slider in un helper condiviso"
```

---

### Task 3: DietStateService

**Files:**
- Create: `src/app/services/diet-state.service.ts`

**Interfaces:**
- Consumes: `AppStateService.load()` → `Promise<AppState>` (con `dietViewMode`, dal Task 1), `AppStateService.patchField(path, value)`, `AuthService.authReady()`/`currentUser()` (gia' esistenti, stessa forma usata da `WorkoutStateService`).
- Produces: `DietStateService.viewMode: Signal<'list' | 'slider'>`, `DietStateService.setViewMode(mode: 'list' | 'slider'): void` — usati da `app.ts` (Task 4) e `dieta-detail.component.ts` (Task 5).

- [ ] **Step 1: Crea il servizio**

Crea `src/app/services/diet-state.service.ts`:

```ts
import { Injectable, signal, effect } from '@angular/core';
import { AppStateService } from './app-state.service';
import { AuthService } from '../core/services/auth.service';

export type DietViewMode = 'list' | 'slider';

const VIEW_MODE_CACHE_KEY = 'dietaViewMode';

/**
 * Stato UI della schermata dieta (per ora solo la preferenza vista
 * lista/slider). Mirror di WorkoutStateService.viewMode, ma tenuto
 * separato: la preferenza vista della dieta e' indipendente da quella
 * della scheda.
 */
@Injectable({ providedIn: 'root' })
export class DietStateService {

  /**
   * Vista lista/slider del piano dieta: inizializzata dalla cache locale
   * per evitare un flash alla vista di default prima che l'account
   * (Firestore) risponda, poi allineata al valore salvato sull'account.
   */
  viewMode = signal<DietViewMode>(
    localStorage.getItem(VIEW_MODE_CACHE_KEY) === 'slider' ? 'slider' : 'list'
  );

  constructor(private appState: AppStateService, private auth: AuthService) {
    effect(() => {
      if (!this.auth.authReady() || !this.auth.currentUser()) return;
      this.appState.load().then(state => {
        if (state.dietViewMode && state.dietViewMode !== this.viewMode()) {
          this.viewMode.set(state.dietViewMode);
          localStorage.setItem(VIEW_MODE_CACHE_KEY, state.dietViewMode);
        }
      });
    });
  }

  setViewMode(mode: DietViewMode): void {
    if (this.viewMode() === mode) return;
    this.viewMode.set(mode);
    localStorage.setItem(VIEW_MODE_CACHE_KEY, mode);
    this.appState.patchField('dietViewMode', mode);
  }
}
```

- [ ] **Step 2: Verifica**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: nessun errore (il servizio non e' ancora usato da nessun componente, ma deve compilare).

- [ ] **Step 3: Commit**

```bash
git add src/app/services/diet-state.service.ts
git commit -m "feat: DietStateService, mirror di WorkoutStateService per la sola preferenza vista"
```

---

### Task 4: abilita il toggle nella navbar per la schermata dieta

**Files:**
- Modify: `src/app/app.ts`
- Modify: `src/app/app.html:11`

**Interfaces:**
- Consumes: `DietStateService.viewMode`/`setViewMode` (dal Task 3), `WorkoutStateService.viewMode`/`setViewMode` (gia' esistenti).
- Produces: `AppComponent.currentViewMode(): 'list' | 'slider'` — nuovo metodo, sostituisce il binding diretto a `workoutState.viewMode()` nel template; usato solo da `app.html` (nessun task successivo lo consuma).

- [ ] **Step 1: Inietta DietStateService**

In `src/app/app.ts`, il costruttore attuale (righe 37-42) e':

```ts
  constructor(
    private router: Router,
    private workoutData: WorkoutDataService,
    public workoutState: WorkoutStateService,
    public auth: AuthService,
    private swUpdate: SwUpdate
  )
```

Aggiungi l'import in cima al file (accanto agli altri import di service):

```ts
import { DietStateService } from './services/diet-state.service';
```

e aggiungi il parametro al costruttore:

```ts
  constructor(
    private router: Router,
    private workoutData: WorkoutDataService,
    public workoutState: WorkoutStateService,
    public dietState: DietStateService,
    public auth: AuthService,
    private swUpdate: SwUpdate
  )
```

- [ ] **Step 2: Aggiungi il campo `viewToggleTarget`**

Vicino alla dichiarazione di `showViewToggle = false;` (riga 31), aggiungi:

```ts
  showViewToggle = false;
  viewToggleTarget: 'scheda' | 'dieta' = 'scheda';
```

- [ ] **Step 3: Imposta il target a 'dieta' sulla route del piano alimentare**

In `updateNav()`, il blocco per `/dieta/:mode` (attualmente righe 193-201) e':

```ts
    if (/^\/dieta\/(?!lista-spesa$)[^/]+$/.test(u)) {
      this.navTitle = 'Piano alimentare';
      this.navSubtitle = '';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      return;
    }
```

Sostituiscilo con (aggiunto `showViewToggle`/`viewToggleTarget`):

```ts
    if (/^\/dieta\/(?!lista-spesa$)[^/]+$/.test(u)) {
      this.navTitle = 'Piano alimentare';
      this.navSubtitle = '';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      this.showViewToggle = true;
      this.viewToggleTarget = 'dieta';
      return;
    }
```

Nel blocco del giorno di allenamento, il match `dayMatch` attuale e':

```ts
    const dayMatch = u.match(/^\/scheda\/day\/(\d+)$/);
    if (dayMatch) {
      const idx = parseInt(dayMatch[1], 10);
      const day = this.workoutData.days[idx];
      this.navTitle = day ? `Giorno ${idx + 1}` : 'Allenamento';
      this.navSubtitle = day ? `${day.label} · rec ${day.rec}` : '';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      this.showViewToggle = true;
      this.showSaveWorkout = true;
      return;
    }
```

Sostituiscilo con (aggiunto `this.viewToggleTarget = 'scheda';`, cosi' i due blocchi (scheda/dieta) non si confondano in futuro):

```ts
    const dayMatch = u.match(/^\/scheda\/day\/(\d+)$/);
    if (dayMatch) {
      const idx = parseInt(dayMatch[1], 10);
      const day = this.workoutData.days[idx];
      this.navTitle = day ? `Giorno ${idx + 1}` : 'Allenamento';
      this.navSubtitle = day ? `${day.label} · rec ${day.rec}` : '';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      this.showViewToggle = true;
      this.viewToggleTarget = 'scheda';
      this.showSaveWorkout = true;
      return;
    }
```

- [ ] **Step 4: Aggiungi `currentViewMode()` e aggiorna `onViewModeChange()`**

`onViewModeChange()` attuale (righe 360-362):

```ts
  onViewModeChange(mode: 'list' | 'slider'): void {
    this.workoutState.setViewMode(mode);
  }
```

Sostituiscilo con:

```ts
  currentViewMode(): 'list' | 'slider' {
    return this.viewToggleTarget === 'dieta' ? this.dietState.viewMode() : this.workoutState.viewMode();
  }

  onViewModeChange(mode: 'list' | 'slider'): void {
    if (this.viewToggleTarget === 'dieta') {
      this.dietState.setViewMode(mode);
    } else {
      this.workoutState.setViewMode(mode);
    }
  }
```

- [ ] **Step 5: Aggiorna il binding nel template**

In `src/app/app.html`, la riga 11 e' attualmente:

```html
  [viewMode]="workoutState.viewMode()"
```

Sostituiscila con:

```html
  [viewMode]="currentViewMode()"
```

- [ ] **Step 6: Verifica**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx ng build`
Expected: nessun errore, build ok.

- [ ] **Step 7: Commit**

```bash
git add src/app/app.ts src/app/app.html
git commit -m "feat: abilita il toggle vista lista/slider anche sulla schermata dieta"
```

---

### Task 5: vista slider in DietaDetailComponent

**Files:**
- Modify: `src/app/pages/dieta-detail/dieta-detail.component.ts`
- Modify: `src/app/pages/dieta-detail/dieta-detail.component.html`
- Modify: `src/styles.css` (2 nuove regole, vedi Step 3)

**Interfaces:**
- Consumes: `DietStateService.viewMode`/`setViewMode` (Task 3, gia' esposto anche via `app.ts`/navbar dal Task 4), `findClosestSlideIndex`/`scrollToSlide` (Task 2).

- [ ] **Step 1: Aggiorna il componente**

In `src/app/pages/dieta-detail/dieta-detail.component.ts`, l'import e il costruttore attuali sono:

```ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DietDataService } from '../../services/diet-data.service';
import { DietPlan, NamedMeal, MealCombination, FoodItem, FoodCategory, FOOD_CATEGORIES, FOOD_CATEGORY_LABELS } from '../../models/diet.model';

interface MealVM {
  meal: NamedMeal;
  open: boolean;
  selectedComboId: string;
}

@Component({
  selector: 'app-dieta-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dieta-detail.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class DietaDetailComponent implements OnInit {
  plan: DietPlan | null = null;
  meals: MealVM[] = [];

  readonly foodCategories = FOOD_CATEGORIES;
  readonly foodCategoryLabels = FOOD_CATEGORY_LABELS;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public dietData: DietDataService
  ) {}
```

Sostituiscilo con (aggiunti `ChangeDetectorRef`/`ElementRef`/`ViewChild`/`effect`, `DietStateService`, stato slider):

```ts
import { Component, OnInit, ChangeDetectorRef, ElementRef, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DietDataService } from '../../services/diet-data.service';
import { DietStateService } from '../../services/diet-state.service';
import { findClosestSlideIndex, scrollToSlide } from '../../core/utils/horizontal-slider.util';
import { DietPlan, NamedMeal, MealCombination, FoodItem, FoodCategory, FOOD_CATEGORIES, FOOD_CATEGORY_LABELS } from '../../models/diet.model';

interface MealVM {
  meal: NamedMeal;
  open: boolean;
  selectedComboId: string;
}

@Component({
  selector: 'app-dieta-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dieta-detail.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class DietaDetailComponent implements OnInit {
  plan: DietPlan | null = null;
  meals: MealVM[] = [];

  readonly foodCategories = FOOD_CATEGORIES;
  readonly foodCategoryLabels = FOOD_CATEGORY_LABELS;

  sliderIndex = 0;
  private scrollTicking = false;

  @ViewChild('sliderEl') sliderEl?: ElementRef<HTMLDivElement>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public dietData: DietDataService,
    public state: DietStateService,
    private cdr: ChangeDetectorRef
  ) {
    // Il toggle vive nella navbar (fuori da questa pagina): quando si passa
    // a "slider" da un'altra vista/pagina, riparte sempre dalla prima card.
    effect(() => {
      if (this.state.viewMode() === 'slider') {
        this.sliderIndex = 0;
        setTimeout(() => this.scrollToIndex(0), 0);
      }
    });
  }
```

Aggiungi in fondo alla classe (dopo `toggleMacroAltExpanded`, prima della chiusura `}`) i due metodi dello slider:

```ts

  onSliderScroll(): void {
    if (this.scrollTicking) return;
    this.scrollTicking = true;
    requestAnimationFrame(() => {
      this.scrollTicking = false;
      const el = this.sliderEl?.nativeElement;
      if (!el) return;
      const closest = findClosestSlideIndex(el);
      if (closest !== this.sliderIndex) {
        this.sliderIndex = closest;
        this.cdr.detectChanges();
      }
    });
  }

  scrollToIndex(idx: number): void {
    scrollToSlide(this.sliderEl?.nativeElement, idx);
  }
```

- [ ] **Step 2: Aggiorna il template**

`src/app/pages/dieta-detail/dieta-detail.component.html` attuale:

```html
<p class="sectiontitle">{{ plan?.name }}</p>

<!-- Meals -->
<div *ngFor="let vm of meals">
  <div class="meal" [class.open]="vm.open">
    <div class="meal-summary" (click)="toggleMeal(vm)">
      <span>{{ vm.meal.name }}</span>
      <span class="chevron">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
      </span>
    </div>

    <div class="content-inner" *ngIf="vm.open">

      <!-- Tab combinazioni (Base + alternative) -->
      <p class="fooditem-category" *ngIf="hasMultipleCombinations(vm)">Combinazioni</p>
      <div class="variant-tabs" *ngIf="hasMultipleCombinations(vm)">
        <button
          *ngFor="let combo of getCombinations(vm)"
          [class.active]="vm.selectedComboId === combo.id"
          (click)="selectCombo(vm, combo)">
          {{ combo.label }}
        </button>
      </div>

      <!-- Un alimento per macro nella combinazione selezionata -->
      <ng-container *ngFor="let cat of foodCategories">
        <ng-container *ngIf="comboItem(vm, cat) as item">
          <p class="fooditem-category">{{ foodCategoryLabels[cat] }}</p>
          <div class="fooditem">
            <div class="row">
              <span class="fname">{{ item.name }}</span>
              <span class="fqty">{{ item.qty }}</span>
            </div>

            <ng-container *ngIf="item.alt && item.alt.length > 0">
              <div class="altwrap" [class.open]="isItemAltOpen(vm, cat)">
                <div class="altwrap-header" (click)="toggleItemAlt(vm, cat)">
                  <span>{{ isItemAltOpen(vm, cat) ? 'Nascondi alternative' : 'Alternative (' + item.alt.length + ')' }}</span>
                  <span class="chevron">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                  </span>
                </div>
                <div class="altlist" *ngIf="isItemAltOpen(vm, cat)">
                  <div class="row" *ngFor="let alt of item.alt">
                    <span>{{ alt.name }}</span>
                    <span>{{ alt.qty }}</span>
                  </div>
                </div>
              </div>
            </ng-container>
          </div>
        </ng-container>
      </ng-container>

      <!-- Alternative per macro, un unico accordion -->
      <ng-container *ngIf="totalAlternatives(vm) > 0">
        <div class="altwrap-header" (click)="toggleMacroAltExpanded(vm)" style="margin-top:14px">
          <span>Alternative ({{ totalAlternatives(vm) }})</span>
          <span class="chevron">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          </span>
        </div>
        <div class="altlist" *ngIf="isMacroAltExpanded(vm)">
          <ng-container *ngFor="let cat of foodCategories">
            <ng-container *ngIf="macroAlternatives(vm, cat).length > 0">
              <p class="fooditem-category" style="margin-top:10px">{{ foodCategoryLabels[cat] }}</p>
              <div class="row" *ngFor="let alt of macroAlternatives(vm, cat)">
                <span>{{ alt.name }}</span>
                <span>{{ alt.qty }}</span>
              </div>
            </ng-container>
          </ng-container>
        </div>
      </ng-container>

    </div>
  </div>
</div>

<div class="consigli">
  <h3>Consigli di base</h3>
  <ul>
    <li>Bevi almeno 2–3 L di acqua al giorno</li>
    <li>Prepara i pasti in anticipo per rispettare le quantità</li>
    <li>Pesare gli alimenti a crudo per maggiore precisione</li>
    <li>In caso di fame eccessiva aggiungi verdure fresche illimitate</li>
  </ul>
</div>
```

Sostituiscilo con (contenuto pasto estratto in `ng-template #mealDetail`, condiviso tra vista lista invariata e nuova vista slider; "Consigli di base" invariato in fondo, fuori da entrambe):

```html
<p class="sectiontitle">{{ plan?.name }}</p>

<ng-template #mealDetail let-vm="vm">
  <!-- Tab combinazioni (Base + alternative) -->
  <p class="fooditem-category" *ngIf="hasMultipleCombinations(vm)">Combinazioni</p>
  <div class="variant-tabs" *ngIf="hasMultipleCombinations(vm)">
    <button
      *ngFor="let combo of getCombinations(vm)"
      [class.active]="vm.selectedComboId === combo.id"
      (click)="selectCombo(vm, combo)">
      {{ combo.label }}
    </button>
  </div>

  <!-- Un alimento per macro nella combinazione selezionata -->
  <ng-container *ngFor="let cat of foodCategories">
    <ng-container *ngIf="comboItem(vm, cat) as item">
      <p class="fooditem-category">{{ foodCategoryLabels[cat] }}</p>
      <div class="fooditem">
        <div class="row">
          <span class="fname">{{ item.name }}</span>
          <span class="fqty">{{ item.qty }}</span>
        </div>

        <ng-container *ngIf="item.alt && item.alt.length > 0">
          <div class="altwrap" [class.open]="isItemAltOpen(vm, cat)">
            <div class="altwrap-header" (click)="toggleItemAlt(vm, cat)">
              <span>{{ isItemAltOpen(vm, cat) ? 'Nascondi alternative' : 'Alternative (' + item.alt.length + ')' }}</span>
              <span class="chevron">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
              </span>
            </div>
            <div class="altlist" *ngIf="isItemAltOpen(vm, cat)">
              <div class="row" *ngFor="let alt of item.alt">
                <span>{{ alt.name }}</span>
                <span>{{ alt.qty }}</span>
              </div>
            </div>
          </div>
        </ng-container>
      </div>
    </ng-container>
  </ng-container>

  <!-- Alternative per macro, un unico accordion -->
  <ng-container *ngIf="totalAlternatives(vm) > 0">
    <div class="altwrap-header" (click)="toggleMacroAltExpanded(vm)" style="margin-top:14px">
      <span>Alternative ({{ totalAlternatives(vm) }})</span>
      <span class="chevron">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
      </span>
    </div>
    <div class="altlist" *ngIf="isMacroAltExpanded(vm)">
      <ng-container *ngFor="let cat of foodCategories">
        <ng-container *ngIf="macroAlternatives(vm, cat).length > 0">
          <p class="fooditem-category" style="margin-top:10px">{{ foodCategoryLabels[cat] }}</p>
          <div class="row" *ngFor="let alt of macroAlternatives(vm, cat)">
            <span>{{ alt.name }}</span>
            <span>{{ alt.qty }}</span>
          </div>
        </ng-container>
      </ng-container>
    </div>
  </ng-container>
</ng-template>

<!-- Vista lista (accordion) -->
<div *ngIf="plan && state.viewMode() === 'list'">
  <div *ngFor="let vm of meals">
    <div class="meal" [class.open]="vm.open">
      <div class="meal-summary" (click)="toggleMeal(vm)">
        <span>{{ vm.meal.name }}</span>
        <span class="chevron">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
        </span>
      </div>

      <div class="content-inner" *ngIf="vm.open">
        <ng-container *ngTemplateOutlet="mealDetail; context: { vm: vm }"></ng-container>
      </div>
    </div>
  </div>
</div>

<!-- Vista slider (card scorrevoli, una per volta) -->
<div class="exslider-wrap" *ngIf="plan && state.viewMode() === 'slider'">
  <div class="exslider-counter">Pasto {{ sliderIndex + 1 }} di {{ meals.length }}</div>

  <div class="exslider" #sliderEl (scroll)="onSliderScroll()">
    <div class="meal mealslide" *ngFor="let vm of meals">
      <div class="meal-summary noclick">
        <span>{{ vm.meal.name }}</span>
      </div>

      <div class="content-inner">
        <ng-container *ngTemplateOutlet="mealDetail; context: { vm: vm }"></ng-container>
      </div>
    </div>
  </div>

  <div class="exslider-dots" *ngIf="meals.length > 1">
    <span *ngFor="let vm of meals; let i = index"
      class="exslider-dot" [class.active]="i === sliderIndex"
      (click)="scrollToIndex(i)"></span>
  </div>
</div>

<div class="consigli">
  <h3>Consigli di base</h3>
  <ul>
    <li>Bevi almeno 2–3 L di acqua al giorno</li>
    <li>Prepara i pasti in anticipo per rispettare le quantità</li>
    <li>Pesare gli alimenti a crudo per maggiore precisione</li>
    <li>In caso di fame eccessiva aggiungi verdure fresche illimitate</li>
  </ul>
</div>
```

- [ ] **Step 3: Aggiungi le 2 regole CSS necessarie**

In `src/styles.css`, subito dopo la regola `.meal .content-inner{...}` (riga 376), aggiungi:

```css
.meal.mealslide{margin-bottom:0;}
.meal-summary.noclick{cursor:default;}
```

(`.meal` porta un `margin-bottom:12px` pensato per l'elenco verticale; nello slider orizzontale lo spazio tra le card e' gia' dato da `.exslider{gap:12px}`, quindi va azzerato sulla card-slide per evitare uno spazio vuoto in fondo alla card. `.meal-summary` ha `cursor:pointer` di base; nello slider non e' cliccabile, stesso trattamento di `.ex-summary.noclick`.)

- [ ] **Step 4: Verifica**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx ng test --watch=false && npx ng build`
Expected: tsc pulito, 33/33 test (invariato — nessun nuovo test per questo task, per convenzione), build ok.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/dieta-detail/dieta-detail.component.ts src/app/pages/dieta-detail/dieta-detail.component.html src/styles.css
git commit -m "feat: vista slider per la schermata dieta, mirror della vista slider esercizi"
```
