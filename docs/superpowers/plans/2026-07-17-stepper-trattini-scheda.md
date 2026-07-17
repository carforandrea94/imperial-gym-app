# Stepper a Trattini nella Vista Slider Scheda Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nella vista slider degli esercizi di `SchedaDetailComponent`, rimuovere la label "Esercizio X di Y" e sostituire i pallini di paginazione in fondo con trattini orizzontali spostati in cima, con stato "completato"/"corrente" gia' disponibile.

**Architecture:** Modifica del solo template e CSS — nessuna nuova logica TypeScript (riuso di `isComplete(vm)` gia' esistente). Nuove classi CSS dedicate (`.exslider-dashes`/`.exslider-dash`), separate dalle classi condivise con `dieta-detail` (`.exslider-counter`/`.exslider-dots`/`.exslider-dot`), che restano invariate.

**Tech Stack:** Angular 21 standalone component, CSS puro, Vitest (`npx ng test --watch=false`).

## Global Constraints

- Solo `scheda-detail.component.html`/`src/styles.css` cambiano. `dieta-detail.component.html` e le classi `.exslider-counter`/`.exslider-dots`/`.exslider-dot` NON vanno toccate — restano usate identiche da `dieta-detail` per lo slider dei pasti.
- Trattino dell'esercizio corrente (`i === sliderIndex`): sempre 24px di larghezza e colore `var(--accent)`, indipendentemente dal completamento.
- Trattino di un esercizio completato (`isComplete(vm)` vero, gia' esistente in `scheda-detail.component.ts:303-305`) ma non corrente: colore `var(--accent)`, larghezza normale (12px).
- Trattino di un esercizio ne' corrente ne' completato: colore `var(--content-glass-border)`, larghezza normale.
- Nessuna nuova logica di completamento — riuso diretto di `isComplete(vm)`.
- La vista lista (`state.viewMode() === 'list'`) non cambia.

---

### Task 1: sposta i trattini in cima, rimuovi la label, nuove classi CSS

**Files:**
- Modify: `src/app/pages/scheda-detail/scheda-detail.component.html:95-131`
- Modify: `src/styles.css` (nuovo blocco accanto alle regole `.exslider-*` esistenti, righe 163-171)

**Interfaces:**
- Consumes: `isComplete(vm: ExerciseVM): boolean` (gia' esistente, pubblico, `scheda-detail.component.ts:303-305`), `sliderIndex: number` (gia' esistente sul componente), `scrollToIndex(i: number)` (gia' esistente, gia' usato dal click sui pallini attuali).
- Produces: nessuna nuova interfaccia — solo markup/CSS.

Nessun nuovo `.spec.ts` (nessun test esistente per questo componente in questo progetto).

- [ ] **Step 1: Sostituisci il blocco del template**

Il blocco attuale (`scheda-detail.component.html:95-131`):

```html
<div class="exslider-wrap" *ngIf="day && !loading && !errorMsg && state.viewMode() === 'slider'">
  <div class="exslider-counter">Esercizio {{ sliderIndex + 1 }} di {{ exercises.length }}</div>

  <div class="exslider" #sliderEl (scroll)="onSliderScroll()">
    <div class="ex exslide" *ngFor="let vm of exercises; let i = index">
      <div class="ex-summary noclick">
        <div class="ex-icon ex-num"
          [style.background]="getMuscleInfo(vm.ex.muscle).dim"
          [style.color]="getMuscleInfo(vm.ex.muscle).color"
          [style.border-color]="getMuscleInfo(vm.ex.muscle).color + '44'">
          {{ i + 1 }}
        </div>
        <div class="ex-info">
          <div class="ex-name">{{ vm.ex.name }}</div>
          <span class="ex-muscle" [style.background]="getMuscleInfo(vm.ex.muscle).color">
            {{ vm.ex.muscle }}
          </span>
          <span class="ex-chip" *ngIf="vm.ex.text">{{ vm.ex.text }}</span>
          <span class="ex-chip rest">⏱ {{ formatRest(vm.restSeconds) }}</span>
        </div>
        <div class="ex-meta">
          <ng-container *ngTemplateOutlet="exMeta; context: { vm: vm }"></ng-container>
        </div>
      </div>

      <div class="content-inner">
        <ng-container *ngTemplateOutlet="exDetail; context: { vm: vm }"></ng-container>
      </div>
    </div>
  </div>

  <div class="exslider-dots" *ngIf="exercises.length > 1">
    <span *ngFor="let vm of exercises; let i = index"
      class="exslider-dot" [class.active]="i === sliderIndex"
      (click)="scrollToIndex(i)"></span>
  </div>
</div>
```

diventa (la label `.exslider-counter` e' rimossa; il blocco trattini si
sposta prima di `.exslider` con le nuove classi e `[class.done]`; il
contenuto interno di `.exslider`, righe 99-123, resta identico):

```html
<div class="exslider-wrap" *ngIf="day && !loading && !errorMsg && state.viewMode() === 'slider'">
  <div class="exslider-dashes" *ngIf="exercises.length > 1">
    <span *ngFor="let vm of exercises; let i = index"
      class="exslider-dash" [class.active]="i === sliderIndex" [class.done]="isComplete(vm)"
      (click)="scrollToIndex(i)"></span>
  </div>

  <div class="exslider" #sliderEl (scroll)="onSliderScroll()">
    <div class="ex exslide" *ngFor="let vm of exercises; let i = index">
      <div class="ex-summary noclick">
        <div class="ex-icon ex-num"
          [style.background]="getMuscleInfo(vm.ex.muscle).dim"
          [style.color]="getMuscleInfo(vm.ex.muscle).color"
          [style.border-color]="getMuscleInfo(vm.ex.muscle).color + '44'">
          {{ i + 1 }}
        </div>
        <div class="ex-info">
          <div class="ex-name">{{ vm.ex.name }}</div>
          <span class="ex-muscle" [style.background]="getMuscleInfo(vm.ex.muscle).color">
            {{ vm.ex.muscle }}
          </span>
          <span class="ex-chip" *ngIf="vm.ex.text">{{ vm.ex.text }}</span>
          <span class="ex-chip rest">⏱ {{ formatRest(vm.restSeconds) }}</span>
        </div>
        <div class="ex-meta">
          <ng-container *ngTemplateOutlet="exMeta; context: { vm: vm }"></ng-container>
        </div>
      </div>

      <div class="content-inner">
        <ng-container *ngTemplateOutlet="exDetail; context: { vm: vm }"></ng-container>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Aggiungi il CSS dei trattini**

In `src/styles.css`, subito dopo la riga `.exslider-dot.active{background:var(--accent);transform:scale(1.4);}` (riga 171 — le regole `.exslider-counter`/`.exslider-dots`/`.exslider-dot` restano invariate, servono ancora a `dieta-detail`), aggiungi:

```css
.exslider-dashes{display:flex;justify-content:center;gap:6px;margin-bottom:14px;}
.exslider-dash{width:12px;height:3px;border-radius:2px;background:var(--content-glass-border);cursor:pointer;transition:all .18s ease;}
.exslider-dash.done{background:var(--accent);}
.exslider-dash.active{width:24px;background:var(--accent);}
```

- [ ] **Step 3: Verifica compilazione e test invariati**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx ng test --watch=false && npx ng build`
Expected: nessun errore TypeScript/template; stesso numero di test verdi di prima (nessun test tocca questi file); build completata senza errori.

- [ ] **Step 4: Verifica manuale**

Run: `npx ng serve`, apri la vista slider di un giorno con più esercizi (icona slider nell'header, non la vista lista): la label "Esercizio X di Y" non deve più comparire; in cima deve comparire una riga di trattini orizzontali; il trattino dell'esercizio attualmente mostrato deve essere più lungo e colorato anche se non ha ancora tutte le serie spuntate; scorrendo/spuntando le serie di un esercizio fino a completarlo, il suo trattino (quando non è più quello corrente) deve restare colorato ma tornare alla larghezza normale. Apri poi la vista slider della dieta (Pasto X di Y): deve restare invariata, con la label e i pallini di oggi.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/scheda-detail/scheda-detail.component.html src/styles.css
git commit -m "feat: stepper a trattini nella vista slider degli esercizi"
```

---

## Self-Review Notes

- **Spec coverage:** rimozione label → Step 1; spostamento in cima + nuove classi dedicate (non condivise con dieta-detail) → Step 1/2; stato corrente/completato/nessuno dei due con le esatte larghezze/colori richiesti → Step 2; nessuna modifica a dieta-detail → nessun task tocca quel file, verificato esplicitamente nello Step 4. Nessun gap.
- **Placeholder scan:** nessun TBD/TODO; codice completo.
- **Type consistency:** `isComplete(vm)` usato con la stessa firma gia' esistente nel componente — nessuna modifica di tipo.
