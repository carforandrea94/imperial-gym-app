# Messaggio Conferma Salvataggio Allenamento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrare un banner testuale in fondo allo schermo che conferma il salvataggio di un allenamento o segnala un errore, invece del solo cambio colore della piccola icona nell'header.

**Architecture:** Un elemento nel template dello shell dell'app (`app.html`, dove vive gia' `<app-navbar>`) legge lo stesso signal `WorkoutStateService.saveStatus()` gia' esistente — nessuna nuova logica di stato/timer, solo un nuovo elemento di presentazione.

**Tech Stack:** Angular 21 standalone component, CSS puro (nessuna libreria).

## Global Constraints

- Testo: `saved` → "Allenamento salvato ✓"; `err` → "Errore durante il salvataggio. Riprova."
- Visibile solo quando `showSaveWorkout` e' `true` (stessa condizione gia' usata per l'icona di salvataggio nella navbar — la route della scheda allenamento) e `workoutState.saveStatus()` non e' `'idle'` ne' `'saving'`.
- Nessuna modifica a `WorkoutStateService`, a `scheda-detail.component.ts`, o al timer di reset a 2 secondi gia' esistente (`scheda-detail.component.ts:376`) — il banner compare/scompare in sync con l'icona esistente riusando lo stesso segnale, senza introdurre nuovo stato.
- Posizione: in basso, sopra la tab bar inferiore (non in cima) — `bottom: calc(var(--tabbar-h) + var(--safe-b) + 12px)`, centrato orizzontalmente, non bloccante (nessun overlay/backdrop).
- Nessun nuovo test automatico dedicato (lavoro di UI/template a livello di shell dell'app, stessa convenzione gia' seguita per `app.html`/`app.ts` in questo progetto); verifica tramite `npx tsc --noEmit -p tsconfig.app.json`, `npx ng test --watch=false` (conteggio invariato), `npx ng build`, e verifica manuale.

---

### Task 1: banner `.savebanner` in `app.html` + CSS

**Files:**
- Modify: `src/app/app.html:1-34` (aggiunta di un nuovo elemento, nessuna riga esistente rimossa)
- Modify: `src/styles.css` (aggiunta di un nuovo blocco CSS, nessuna regola esistente modificata)

**Interfaces:**
- Consumes: `App.showSaveWorkout: boolean` (gia' pubblico, `src/app/app.ts:34`); `App.workoutState: WorkoutStateService` (gia' pubblico, `src/app/app.ts:43`); `WorkoutStateService.saveStatus: Signal<'idle' | 'saving' | 'saved' | 'err'>` (gia' esistente, `src/app/services/workout-state.service.ts:43`).
- Produces: nessuna nuova interfaccia — modifica solo la presentazione, nessun consumer esterno.

Nessuno `.spec.ts` da creare per questo task (vedi Global Constraints).

- [ ] **Step 1: Aggiungi il banner in `src/app/app.html`**

Aggiungi questo blocco subito dopo la chiusura di `</app-navbar>` (riga 23 attuale), prima del `<div class="content"...>`:

```html
<div class="savebanner"
     *ngIf="showSaveWorkout && workoutState.saveStatus() !== 'idle' && workoutState.saveStatus() !== 'saving'"
     [class.err]="workoutState.saveStatus() === 'err'">
  {{ workoutState.saveStatus() === 'saved' ? 'Allenamento salvato ✓' : 'Errore durante il salvataggio. Riprova.' }}
</div>
```

Il file risultante deve avere questa struttura (invariato tutto il resto):

```html
<app-navbar
  *ngIf="showChrome && auth.authReady()"
  [title]="navTitle"
  [subtitle]="navSubtitle"
  [showBack]="showBack"
  [showHistory]="showHistory"
  [showInfo]="showInfo"
  [showAnalytics]="showAnalytics"
  [showShoppingList]="showShoppingList"
  [showViewToggle]="showViewToggle"
  [viewMode]="currentViewMode()"
  [showSaveWorkout]="showSaveWorkout"
  [saveStatus]="workoutState.saveStatus()"
  [showSettings]="showSettings"
  (backClick)="onBack()"
  (historyClick)="onHistory()"
  (infoClick)="onInfo()"
  (analyticsClick)="onAnalytics()"
  (shoppingListClick)="onShoppingList()"
  (viewModeChange)="onViewModeChange($event)"
  (saveWorkoutClick)="onSaveWorkoutClick()"
  (settingsClick)="onSettingsClick()">
</app-navbar>

<div class="savebanner"
     *ngIf="showSaveWorkout && workoutState.saveStatus() !== 'idle' && workoutState.saveStatus() !== 'saving'"
     [class.err]="workoutState.saveStatus() === 'err'">
  {{ workoutState.saveStatus() === 'saved' ? 'Allenamento salvato ✓' : 'Errore durante il salvataggio. Riprova.' }}
</div>

<div class="content" [class.no-chrome]="!showChrome">
  <div class="wrap">
    <router-outlet></router-outlet>
  </div>
</div>

<app-rest-timer *ngIf="showChrome && auth.authReady()"></app-rest-timer>
<app-confirm-dialog></app-confirm-dialog>
<app-tabbar *ngIf="showChrome && auth.authReady()"></app-tabbar>
```

- [ ] **Step 2: Aggiungi il CSS in `src/styles.css`**

Aggiungi questo blocco alla fine del file (dopo l'ultima regola esistente):

```css
.savebanner{position:fixed;left:50%;bottom:calc(var(--tabbar-h) + var(--safe-b) + 12px);transform:translateX(-50%);z-index:65;padding:10px 20px;border-radius:20px;background:rgba(48,209,88,0.92);color:#04220f;font-weight:600;font-size:14px;box-shadow:0 6px 18px rgba(0,0,0,.3);backdrop-filter:blur(12px) saturate(125%);-webkit-backdrop-filter:blur(12px) saturate(125%);animation:fade .2s ease;white-space:nowrap;max-width:calc(100vw - 32px);text-overflow:ellipsis;overflow:hidden;}
.savebanner.err{background:rgba(255,69,58,0.92);color:#fff;}
```

- [ ] **Step 3: Verifica compilazione e test invariati**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx ng test --watch=false && npx ng build`
Expected: nessun errore TypeScript/template; la suite di test riporta lo stesso numero di test verdi di prima di questo task (nessun test tocca `app.html`/`styles.css`); build completata senza errori.

- [ ] **Step 4: Verifica manuale (dev server)**

Run: `npx ng serve` (o equivalente gia' in uso), poi apri la scheda allenamento come cliente e salva un allenamento:
- Deve comparire un banner verde in basso (sopra la tab bar) con il testo "Allenamento salvato ✓" per circa 2 secondi, poi sparire.
- Forzare un errore di salvataggio (es. disconnessione di rete) deve mostrare il banner rosso con "Errore durante il salvataggio. Riprova."
- Il banner non deve comparire su nessun'altra schermata (es. Dieta, Misure, Account).
- L'icona di salvataggio nell'header deve continuare a cambiare colore come prima (nessuna regressione).

- [ ] **Step 5: Commit**

```bash
git add src/app/app.html src/styles.css
git commit -m "feat: banner di conferma salvataggio allenamento"
```

---

## Self-Review Notes

- **Spec coverage:** testo esatto per `saved`/`err` → Step 1. Visibilita' solo su `showSaveWorkout` + stato non idle/saving → Step 1. Posizione in basso sopra la tab bar, non bloccante → Step 2. Nessuna modifica a `WorkoutStateService`/timer esistente → nessun task tocca quei file. Tutto coperto, nessun gap.
- **Placeholder scan:** nessun TBD/TODO; ogni step ha codice completo.
- **Type consistency:** `workoutState.saveStatus()` usato con la stessa sintassi gia' presente in `app.html:13` (`[saveStatus]="workoutState.saveStatus()"`) — nessuna nuova proprieta' inventata, solo binding aggiuntivi sullo stesso signal.
