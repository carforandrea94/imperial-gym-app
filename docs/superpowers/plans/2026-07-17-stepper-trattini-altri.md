# Stepper a Trattini — Slider Pasti e Indicatore Settimana Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estendere lo stepper a trattini (gia' introdotto per gli esercizi, PR #53) allo slider dei pasti in `dieta-detail` e all'indicatore settimana in `scheda-list`.

**Architecture:** Task 1 converte lo slider pasti riusando le classi CSS gia' esistenti (`.exslider-dashes`/`.exslider-dash`), poi rimuove le vecchie classi CSS ormai morte. Task 2 modifica solo il CSS di `.weekdots` (nessun markup/logica). I 2 task sono completamente indipendenti (file diversi, nessuna dipendenza tra loro).

**Tech Stack:** Angular 21 standalone component, CSS puro, Vitest (`npx ng test --watch=false`).

## Global Constraints

- Nessuna nuova classe CSS per lo slider pasti — riusa `.exslider-dashes`/`.exslider-dash` gia' create per lo slider esercizi (PR #53).
- Lo slider pasti non ha concetto di "completato": solo `[class.active]`, nessun `[class.done]`.
- Le classi `.exslider-counter`/`.exslider-dots`/`.exslider-dot`/`.exslider-dot.active` in `src/styles.css` vanno rimosse SOLO dopo aver confermato che nessun template le usa piu' (verificato nello spec: solo `dieta-detail` le usava, dopo il Task 1 nessuno le usa).
- L'indicatore settimana (`scheda-list.component.html`, `.weekdots`) non cambia markup ne' logica — solo la forma via CSS, da cerchio (`border-radius:50%`, 6x6px) a trattino (`border-radius:2px`, 12x3px normale / 22px quando `.active`).
- La label "Settimana X di Y" e le altre info in `scheda-list` restano invariate.

---

### Task 1: slider pasti — trattini + pulizia CSS morto

**Files:**
- Modify: `src/app/pages/dieta-detail/dieta-detail.component.html:86-106`
- Modify: `src/styles.css` (rimozione righe 164, 169-171 — le 4 regole `.exslider-counter`/`.exslider-dots`/`.exslider-dot`/`.exslider-dot.active`)

**Interfaces:**
- Consumes: `.exslider-dashes`/`.exslider-dash` (gia' esistenti in `src/styles.css`, introdotte in PR #53 per lo slider esercizi — nessuna modifica a queste regole).
- Produces: nessuna nuova interfaccia — solo markup.

Nessun nuovo `.spec.ts` (nessun test esistente per questo componente in questo progetto).

- [ ] **Step 1: Sostituisci il blocco del template**

Il blocco attuale (`dieta-detail.component.html:86-106`):

```html
<div class="exslider-wrap" *ngIf="plan && state.viewMode() === 'slider'">
  <div class="exslider-counter">Pasto {{ sliderIndex + 1 }} di {{ meals.length }}</div>

  <div class="exslider" #sliderEl (scroll)="onSliderScroll()">
    <div class="meal mealslide exslide" *ngFor="let vm of meals">
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
```

diventa:

```html
<div class="exslider-wrap" *ngIf="plan && state.viewMode() === 'slider'">
  <div class="exslider-dashes" *ngIf="meals.length > 1">
    <span *ngFor="let vm of meals; let i = index"
      class="exslider-dash" [class.active]="i === sliderIndex"
      (click)="scrollToIndex(i)"></span>
  </div>

  <div class="exslider" #sliderEl (scroll)="onSliderScroll()">
    <div class="meal mealslide exslide" *ngFor="let vm of meals">
      <div class="meal-summary noclick">
        <span>{{ vm.meal.name }}</span>
      </div>

      <div class="content-inner">
        <ng-container *ngTemplateOutlet="mealDetail; context: { vm: vm }"></ng-container>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Verifica che nessun altro file usi le vecchie classi**

Run: `grep -rln "exslider-counter\|exslider-dots\|exslider-dot\b" src/app --include="*.html"`
Expected: nessun output (nessun file le usa piu', dopo la modifica dello Step 1).

Se il comando restituisce un file, FERMATI e non procedere allo Step 3 — segnalalo nel report invece di rimuovere il CSS.

- [ ] **Step 3: Rimuovi le regole CSS morte**

In `src/styles.css`, rimuovi queste 4 righe (attualmente alle righe 164, 169-171):

```css
.exslider-counter{font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--label-3);text-align:center;margin-bottom:10px;}
```

e

```css
.exslider-dots{display:flex;justify-content:center;gap:6px;margin-top:12px;}
.exslider-dot{width:6px;height:6px;border-radius:50%;background:var(--content-glass-border);cursor:pointer;transition:background .18s ease,transform .18s ease;}
.exslider-dot.active{background:var(--accent);transform:scale(1.4);}
```

Nessun'altra riga va toccata (in particolare, `.exslider-wrap`, `.exslider`, `.exslider-dashes`, `.exslider-dash` restano invariate).

- [ ] **Step 4: Verifica compilazione e test invariati**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx ng test --watch=false && npx ng build`
Expected: nessun errore; stesso numero di test verdi di prima; build completata senza errori.

- [ ] **Step 5: Verifica manuale**

Run: `npx ng serve`, apri la vista slider della dieta (icona slider nell'header di "Dieta"): la label "Pasto X di Y" non deve piu' comparire; in cima deve comparire una riga di trattini; cliccare un trattino deve navigare al pasto corrispondente, quello del pasto corrente deve essere piu' lungo e colorato.

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/dieta-detail/dieta-detail.component.html src/styles.css
git commit -m "feat: stepper a trattini nella vista slider dei pasti"
```

---

### Task 2: indicatore settimana — trattini invece di pallini

**Files:**
- Modify: `src/styles.css:143-146` (blocco `.weekdots`)

**Interfaces:**
- Consumes: nessuna — modifica CSS pura, nessuna interfaccia nuova o esistente coinvolta.
- Produces: nessuna.

Nessun nuovo `.spec.ts` (modifica di sola presentazione CSS, nessun markup/logica toccati).

- [ ] **Step 1: Sostituisci il blocco CSS**

Il blocco attuale (`src/styles.css:143-146`):

```css
.weekdots{display:flex;justify-content:center;gap:5px;margin-top:8px;}
.weekdots span{width:6px;height:6px;border-radius:50%;background:var(--content-glass-border);transition:background .2s ease,transform .2s ease;}
.weekdots span.completed{background:var(--accent);}
.weekdots span.active{background:var(--accent);transform:scale(1.4);}
```

diventa:

```css
.weekdots{display:flex;justify-content:center;gap:5px;margin-top:8px;}
.weekdots span{width:12px;height:3px;border-radius:2px;background:var(--content-glass-border);transition:background .2s ease,width .2s ease;}
.weekdots span.completed{background:var(--accent);}
.weekdots span.active{background:var(--accent);width:22px;}
```

- [ ] **Step 2: Verifica compilazione e test invariati**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx ng test --watch=false && npx ng build`
Expected: nessun errore; stesso numero di test verdi di prima; build completata senza errori.

- [ ] **Step 3: Verifica manuale**

Run: `npx ng serve`, apri la lista scheda (schermata iniziale "Scheda"): l'indicatore delle settimane sotto "Settimana X di Y" deve mostrare trattini invece di pallini, con la settimana corrente piu' lunga e quelle passate/completate colorate, esattamente come il comportamento di oggi ma con la nuova forma.

- [ ] **Step 4: Commit**

```bash
git add src/styles.css
git commit -m "feat: indicatore settimana a trattini invece di pallini"
```

---

## Self-Review Notes

- **Spec coverage:** slider pasti (rimozione label, trattini in cima, riuso classi esistenti) → Task 1 Step 1; pulizia CSS morto con verifica di sicurezza esplicita (grep prima di rimuovere) → Task 1 Step 2-3; indicatore settimana (solo CSS, stessa logica) → Task 2 Step 1. Nessun gap.
- **Placeholder scan:** nessun TBD/TODO; codice completo in ogni step.
- **Type consistency:** nessuna interfaccia TypeScript coinvolta in nessuno dei 2 task — solo markup/CSS, nessun rischio di disallineamento tipi.
