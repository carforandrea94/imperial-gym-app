# Bottoni Salva nell'Header + Toast di Esito Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Spostare i bottoni "Salva" di history-detail e coach-protocol-builder nell'header (solo icona, stesso pattern gia' usato da scheda-detail), e introdurre un toast generico riusabile che mostra l'esito (successo/errore) di ogni salvataggio, incluso quello gia' esistente di scheda-detail.

**Architecture:** Un nuovo `ToastService` (root, signal-based) + `<app-toast>` montato una volta sola in `app.html` fa da meccanismo generico. Per le 2 pagine migrate si replica esattamente il pattern gia' in uso per l'allenamento (`WorkoutStateService`): un piccolo servizio root per pagina con un signal di stato + `registerSaveHandler`/`requestSave()`, cosi' l'header (fuori dalla pagina, dentro `app.html`) puo' inoltrare il click alla pagina senza che `NavbarComponent`/`App` conoscano i dettagli interni della pagina.

**Tech Stack:** Angular 21 standalone components/signals, CSS puro, Vitest (`npx ng test --watch=false`).

## Global Constraints

- Perimetro: solo scheda-detail (gia' in header, solo aggiunta toast), history-detail ("Salva" modifica seduta), coach-protocol-builder ("Salva bozza"/"Salva e attiva"). Nessun'altra pagina.
- Il toast e' additivo: non rimuove `errorMsg`/`saveMsg` esistenti nelle pagine.
- Un solo toast alla volta, autoscompare dopo 2500ms, nessuna coda.
- Testo esatto dei toast: scheda-detail successo → `'Allenamento salvato ✓'`, errore → `'Errore durante il salvataggio. Riprova.'`; history-detail successo → `'Seduta aggiornata ✓'`, collisione → `'Esiste gia\' una seduta in questa data.'`, errore → `'Errore durante il salvataggio. Riprova.'`; coach-protocol-builder successo bozza → `'Bozza salvata ✓'`, successo attiva → `'Protocollo attivato ✓'`, mismatch → `'Salvataggio incompleto, riprova.'`, errore → `'Errore durante il salvataggio. Riprova.'`.
- Posizione toast: `position:fixed`, in basso sopra la tab bar — `bottom:calc(var(--tabbar-h) + var(--safe-b) + 12px)`, centrato, non bloccante (riuso di `--tabbar-h`/`--safe-b` gia' definite in `src/styles.css:40-41`).
- I 2 nuovi servizi di stato pagina (`HistoryEditStateService`, `ProtocolBuilderStateService`) seguono esattamente la forma di `WorkoutStateService.registerSaveHandler`/`requestSave` (`src/app/services/workout-state.service.ts:43-50`).
- Cambio colore icona di scheda-detail (`.saveworkout-icon.saved`/`.err`) resta invariato — il toast si aggiunge.
- Nessuna modifica a "Salva esercizio"/"Fatto" (editor esercizio/pasto in coach-protocol-builder) ne' a "Modifica"/"Elimina"/"Annulla" in history-detail — restano dove sono.

---

### Task 1: `ToastService`

**Files:**
- Create: `src/app/services/toast.service.ts`
- Test: `src/app/services/toast.service.spec.ts`

**Interfaces:**
- Produces: `ToastService.toast: Signal<{ kind: 'success' | 'error'; message: string } | null>`, `ToastService.success(message: string): void`, `ToastService.error(message: string): void`.

- [ ] **Step 1: Scrivi il test che fallisce**

```ts
// src/app/services/toast.service.spec.ts
import { fakeAsync, tick } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    service = new ToastService();
  });

  it('non mostra nessun toast prima di success()/error()', () => {
    expect(service.toast()).toBeNull();
  });

  it('success() imposta un toast di tipo success con il messaggio dato', () => {
    service.success('Allenamento salvato ✓');
    expect(service.toast()).toEqual({ kind: 'success', message: 'Allenamento salvato ✓' });
  });

  it('error() imposta un toast di tipo error con il messaggio dato', () => {
    service.error('Errore durante il salvataggio. Riprova.');
    expect(service.toast()).toEqual({ kind: 'error', message: 'Errore durante il salvataggio. Riprova.' });
  });

  it('il toast scompare da solo dopo 2500ms', fakeAsync(() => {
    service.success('Bozza salvata ✓');
    expect(service.toast()).not.toBeNull();
    tick(2500);
    expect(service.toast()).toBeNull();
  }));

  it('un nuovo show() prima dello scadere del precedente sostituisce il toast e riazzera il timer', fakeAsync(() => {
    service.success('Bozza salvata ✓');
    tick(2000);
    service.error('Errore durante il salvataggio. Riprova.');
    tick(2000);
    // sono passati 4000ms totali ma solo 2000ms dal secondo show(): deve essere ancora visibile
    expect(service.toast()).toEqual({ kind: 'error', message: 'Errore durante il salvataggio. Riprova.' });
    tick(500);
    expect(service.toast()).toBeNull();
  }));
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npx ng test --watch=false --include='**/toast.service.spec.ts'`
Expected: FAIL — `Cannot find module './toast.service'`

- [ ] **Step 3: Implementa `ToastService`**

```ts
// src/app/services/toast.service.ts
import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error';

export interface ToastState {
  kind: ToastKind;
  message: string;
}

const TOAST_DURATION_MS = 2500;

@Injectable({ providedIn: 'root' })
export class ToastService {
  toast = signal<ToastState | null>(null);
  private hideTimeout: ReturnType<typeof setTimeout> | null = null;

  success(message: string): void {
    this.show('success', message);
  }

  error(message: string): void {
    this.show('error', message);
  }

  private show(kind: ToastKind, message: string): void {
    if (this.hideTimeout) clearTimeout(this.hideTimeout);
    this.toast.set({ kind, message });
    this.hideTimeout = setTimeout(() => this.toast.set(null), TOAST_DURATION_MS);
  }
}
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npx ng test --watch=false --include='**/toast.service.spec.ts'`
Expected: PASS — 5/5 test verdi

- [ ] **Step 5: Commit**

```bash
git add src/app/services/toast.service.ts src/app/services/toast.service.spec.ts
git commit -m "feat: aggiungi ToastService generico per l'esito dei salvataggi"
```

---

### Task 2: `ToastComponent` + CSS + montaggio in `app.html`

**Files:**
- Create: `src/app/components/toast/toast.component.ts`
- Create: `src/app/components/toast/toast.component.html`
- Modify: `src/app/app.ts` (import + costruttore + import in `@Component.imports`)
- Modify: `src/app/app.html:31-32` (aggiunta `<app-toast>`)
- Modify: `src/styles.css` (nuovo blocco CSS in fondo al file)

**Interfaces:**
- Consumes: `ToastService.toast` (Task 1).
- Produces: nessuna nuova interfaccia — solo presentazione.

Nessuno `.spec.ts` dedicato (componente di sola presentazione, stessa convenzione gia' seguita per `app.html`/`ConfirmDialogComponent` in questo progetto — verifica tramite `tsc`/build/manuale, vedi Global Constraints del progetto).

- [ ] **Step 1: Crea `toast.component.ts`**

```ts
// src/app/components/toast/toast.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.component.html'
})
export class ToastComponent {
  constructor(public toast: ToastService) {}
}
```

- [ ] **Step 2: Crea `toast.component.html`**

```html
<!-- src/app/components/toast/toast.component.html -->
<div class="apptoast" *ngIf="toast.toast() as t" [class.error]="t.kind === 'error'">
  {{ t.message }}
</div>
```

- [ ] **Step 3: Monta `<app-toast>` in `app.html`**

Il file attuale (`src/app/app.html:31-33`) e':

```html
<app-rest-timer *ngIf="showChrome && auth.authReady()"></app-rest-timer>
<app-confirm-dialog></app-confirm-dialog>
<app-tabbar *ngIf="showChrome && auth.authReady()"></app-tabbar>
```

Sostituiscilo con:

```html
<app-rest-timer *ngIf="showChrome && auth.authReady()"></app-rest-timer>
<app-confirm-dialog></app-confirm-dialog>
<app-toast></app-toast>
<app-tabbar *ngIf="showChrome && auth.authReady()"></app-tabbar>
```

- [ ] **Step 4: Registra `ToastComponent` in `app.ts`**

In `src/app/app.ts:7-10` (import esistenti), aggiungi:

```ts
import { ToastComponent } from './components/toast/toast.component';
```

In `src/app/app.ts:20` (`imports` del decoratore `@Component`), attuale:

```ts
imports: [CommonModule, RouterOutlet, NavbarComponent, TabbarComponent, RestTimerComponent, ConfirmDialogComponent],
```

diventa:

```ts
imports: [CommonModule, RouterOutlet, NavbarComponent, TabbarComponent, RestTimerComponent, ConfirmDialogComponent, ToastComponent],
```

- [ ] **Step 5: Aggiungi il CSS in fondo a `src/styles.css`**

```css
.apptoast{position:fixed;left:50%;bottom:calc(var(--tabbar-h) + var(--safe-b) + 12px);transform:translateX(-50%);z-index:65;padding:10px 20px;border-radius:20px;background:rgba(48,209,88,0.92);color:#04220f;font-weight:600;font-size:14px;box-shadow:0 6px 18px rgba(0,0,0,.3);backdrop-filter:blur(12px) saturate(125%);-webkit-backdrop-filter:blur(12px) saturate(125%);animation:fade .2s ease;white-space:nowrap;max-width:calc(100vw - 32px);text-overflow:ellipsis;overflow:hidden;}
.apptoast.error{background:rgba(255,69,58,0.92);color:#fff;}
```

- [ ] **Step 6: Verifica compilazione e test invariati**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx ng test --watch=false && npx ng build`
Expected: nessun errore; stesso numero di test verdi di prima + i 5 di Task 1; build completata senza errori.

- [ ] **Step 7: Commit**

```bash
git add src/app/components/toast src/app/app.ts src/app/app.html src/styles.css
git commit -m "feat: aggiungi ToastComponent e montalo nello shell dell'app"
```

---

### Task 3: scheda-detail — aggiungi le chiamate al toast

**Files:**
- Modify: `src/app/pages/scheda-detail/scheda-detail.component.ts:1-75` (import + costruttore), `:344-378` (`saveWorkout()`)

**Interfaces:**
- Consumes: `ToastService.success(message: string)`, `ToastService.error(message: string)` (Task 1).
- Produces: nessuna — nessun consumer esterno di questa modifica.

Nessun nuovo `.spec.ts` (comportamento di presentazione aggiuntivo su un metodo gia' testato manualmente, stessa convenzione gia' seguita per questo file — vedi Global Constraints del progetto).

- [ ] **Step 1: Inietta `ToastService` nel costruttore**

In `src/app/pages/scheda-detail/scheda-detail.component.ts:1`, riga import esistente:

```ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef, ElementRef, ViewChild, effect } from '@angular/core';
```

resta invariata. Aggiungi una nuova riga import subito dopo le altre import di servizi (dopo la riga `import { findClosestSlideIndex, scrollToSlide } from '../../core/utils/horizontal-slider.util';` a riga 13):

```ts
import { ToastService } from '../../services/toast.service';
```

Il costruttore attuale (righe 56-66) e':

```ts
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public workoutData: WorkoutDataService,
    public state: WorkoutStateService,
    private appState: AppStateService,
    private sessions: WorkoutSessionsService,
    private confirm: ConfirmDialogService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) {
```

diventa:

```ts
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public workoutData: WorkoutDataService,
    public state: WorkoutStateService,
    private appState: AppStateService,
    private sessions: WorkoutSessionsService,
    private confirm: ConfirmDialogService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    private toast: ToastService
  ) {
```

- [ ] **Step 2: Aggiungi le chiamate al toast in `saveWorkout()`**

Il metodo attuale (righe 344-378) e':

```ts
  async saveWorkout(): Promise<void> {
    if (this.state.saveStatus() === 'saving') return; // evita doppio invio mentre e' gia' in corso
    this.state.saveStatus.set('saving');
    if (this.draftTimer) { clearTimeout(this.draftTimer); this.draftTimer = null; }

    const isoDate = todayLocalISO();
    const session: WorkoutSession = {
      dayId: this.day.id,
      dayLabel: this.day.label,
      date: isoDate,
      exercises: this.exercises.map(vm => ({
        name: vm.ex.name,
        sets: vm.rows.map(r => ({ load: r.load || null, reps: r.reps || null, done: r.done }))
      }))
    };

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 12000)
    );

    try {
      const ok = await Promise.race([this.sessions.save(session), timeout]);
      if (ok) {
        await this.appState.deleteFieldPath(`workoutDrafts.${this.day.id}`);
        this.state.saveStatus.set('saved');
      } else {
        this.state.saveStatus.set('err');
      }
    } catch (e: any) {
      console.error('Errore salvataggio allenamento:', e);
      this.state.saveStatus.set('err');
    } finally {
      setTimeout(() => this.state.saveStatus.set('idle'), 2000);
    }
  }
```

Sostituiscilo con (uniche righe nuove: le 3 chiamate a `this.toast.*`):

```ts
  async saveWorkout(): Promise<void> {
    if (this.state.saveStatus() === 'saving') return; // evita doppio invio mentre e' gia' in corso
    this.state.saveStatus.set('saving');
    if (this.draftTimer) { clearTimeout(this.draftTimer); this.draftTimer = null; }

    const isoDate = todayLocalISO();
    const session: WorkoutSession = {
      dayId: this.day.id,
      dayLabel: this.day.label,
      date: isoDate,
      exercises: this.exercises.map(vm => ({
        name: vm.ex.name,
        sets: vm.rows.map(r => ({ load: r.load || null, reps: r.reps || null, done: r.done }))
      }))
    };

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 12000)
    );

    try {
      const ok = await Promise.race([this.sessions.save(session), timeout]);
      if (ok) {
        await this.appState.deleteFieldPath(`workoutDrafts.${this.day.id}`);
        this.state.saveStatus.set('saved');
        this.toast.success('Allenamento salvato ✓');
      } else {
        this.state.saveStatus.set('err');
        this.toast.error('Errore durante il salvataggio. Riprova.');
      }
    } catch (e: any) {
      console.error('Errore salvataggio allenamento:', e);
      this.state.saveStatus.set('err');
      this.toast.error('Errore durante il salvataggio. Riprova.');
    } finally {
      setTimeout(() => this.state.saveStatus.set('idle'), 2000);
    }
  }
```

- [ ] **Step 3: Verifica compilazione e test invariati**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx ng test --watch=false && npx ng build`
Expected: nessun errore; stesso numero di test verdi di prima; build completata senza errori.

- [ ] **Step 4: Verifica manuale**

Run: `npx ng serve`, apri una scheda allenamento, salva: deve comparire il toast verde "Allenamento salvato ✓" in basso sopra la tab bar, oltre al normale cambio colore dell'icona.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/scheda-detail/scheda-detail.component.ts
git commit -m "feat: mostra il toast di esito quando si salva un allenamento"
```

---

### Task 4: `HistoryEditStateService`

**Files:**
- Create: `src/app/services/history-edit-state.service.ts`
- Test: `src/app/services/history-edit-state.service.spec.ts`

**Interfaces:**
- Produces: `HistoryEditStateService.editMode: Signal<boolean>`, `HistoryEditStateService.saving: Signal<boolean>`, `HistoryEditStateService.registerSaveHandler(handler: (() => void) | null): void`, `HistoryEditStateService.requestSave(): void`.

- [ ] **Step 1: Scrivi il test che fallisce**

```ts
// src/app/services/history-edit-state.service.spec.ts
import { HistoryEditStateService } from './history-edit-state.service';

describe('HistoryEditStateService', () => {
  let service: HistoryEditStateService;

  beforeEach(() => {
    service = new HistoryEditStateService();
  });

  it('editMode e saving partono a false', () => {
    expect(service.editMode()).toBe(false);
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

Run: `npx ng test --watch=false --include='**/history-edit-state.service.spec.ts'`
Expected: FAIL — `Cannot find module './history-edit-state.service'`

- [ ] **Step 3: Implementa `HistoryEditStateService`**

```ts
// src/app/services/history-edit-state.service.ts
import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class HistoryEditStateService {
  editMode = signal(false);
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

Run: `npx ng test --watch=false --include='**/history-edit-state.service.spec.ts'`
Expected: PASS — 4/4 test verdi

- [ ] **Step 5: Commit**

```bash
git add src/app/services/history-edit-state.service.ts src/app/services/history-edit-state.service.spec.ts
git commit -m "feat: aggiungi HistoryEditStateService per il salvataggio da header"
```

---

### Task 5: history-detail — usa `HistoryEditStateService` + toast, rimuovi il bottone in fondo pagina

**Files:**
- Modify: `src/app/pages/history-detail/history-detail.component.ts` (import, costruttore, campo `editMode`, `ngOnInit`, `ngOnDestroy`, `enterEditMode`, `cancelEdit`, `saveEdit`)
- Modify: `src/app/pages/history-detail/history-detail.component.html:80-89` (rimozione bottone "Salva")

**Interfaces:**
- Consumes: `HistoryEditStateService` (Task 4), `ToastService.success`/`.error` (Task 1).
- Produces: nessuna nuova interfaccia esterna — il getter `editMode` mantiene la stessa firma pubblica usata oggi dal template (`editMode: boolean`), cosi' `history-detail.component.html` non richiede altre modifiche oltre alla rimozione del bottone.

Nessun nuovo `.spec.ts` dedicato: non esiste oggi un file di test per questo componente (nessun precedente da seguire), e la modifica e' un rewiring di stato gia' coperto manualmente — stessa convenzione gia' seguita per questo file in questo progetto.

- [ ] **Step 1: Import e iniezione dei servizi**

In `src/app/pages/history-detail/history-detail.component.ts:1`, riga import esistente:

```ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
```

resta invariata. Dopo la riga `import { todayLocalISO } from '../../core/utils/date.util';` (riga 11), aggiungi:

```ts
import { HistoryEditStateService } from '../../services/history-edit-state.service';
import { ToastService } from '../../services/toast.service';
```

- [ ] **Step 2: Trasforma il campo `editMode` in un getter sul servizio**

Il campo attuale (riga 28):

```ts
  editMode = false;
```

diventa un getter (stessa posizione):

```ts
  get editMode(): boolean {
    return this.historyEditState.editMode();
  }
```

- [ ] **Step 3: Aggiungi i 2 servizi al costruttore**

Il costruttore attuale (righe 35-43) e':

```ts
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private sessionsSvc: WorkoutSessionsService,
    private confirm: ConfirmDialogService,
    public workoutData: WorkoutDataService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) {}
```

diventa:

```ts
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private sessionsSvc: WorkoutSessionsService,
    private confirm: ConfirmDialogService,
    public workoutData: WorkoutDataService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    private historyEditState: HistoryEditStateService,
    private toast: ToastService
  ) {}
```

- [ ] **Step 4: Registra/deregistra l'handler in `ngOnInit`/`ngOnDestroy`**

`ngOnInit` attuale (righe 52-60):

```ts
  ngOnInit(): void {
    this.paramSub = this.route.paramMap.subscribe(params => {
      const rawKey = params.get('key') ?? '';
      this.key = decodeURIComponent(rawKey);
      this.editMode = false;
      this.editSession = null;
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.paramSub?.unsubscribe();
  }
```

diventa:

```ts
  ngOnInit(): void {
    this.historyEditState.registerSaveHandler(() => this.saveEdit());
    this.paramSub = this.route.paramMap.subscribe(params => {
      const rawKey = params.get('key') ?? '';
      this.key = decodeURIComponent(rawKey);
      this.historyEditState.editMode.set(false);
      this.editSession = null;
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.paramSub?.unsubscribe();
    this.historyEditState.registerSaveHandler(null);
    this.historyEditState.editMode.set(false);
  }
```

- [ ] **Step 5: Aggiorna `enterEditMode()`/`cancelEdit()`**

Attuali (righe 130-142):

```ts
  enterEditMode(): void {
    if (!this.session) return;
    this.editSession = structuredClone(this.session);
    this.editDate = this.session.date;
    this.errorMsg = '';
    this.editMode = true;
  }

  cancelEdit(): void {
    this.editSession = null;
    this.editMode = false;
    this.errorMsg = '';
  }
```

diventano:

```ts
  enterEditMode(): void {
    if (!this.session) return;
    this.editSession = structuredClone(this.session);
    this.editDate = this.session.date;
    this.errorMsg = '';
    this.historyEditState.editMode.set(true);
  }

  cancelEdit(): void {
    this.editSession = null;
    this.historyEditState.editMode.set(false);
    this.errorMsg = '';
  }
```

- [ ] **Step 6: Aggiorna `saveEdit()`**

Attuale (righe 153-182):

```ts
  async saveEdit(): Promise<void> {
    if (!this.editSession) return;
    if (!this.editDate || this.editDate > this.maxDate) {
      this.errorMsg = 'Data non valida: non puoi salvare una seduta senza data o con una data futura.';
      this.cdr.detectChanges();
      return;
    }
    this.errorMsg = '';

    const result = await this.sessionsSvc.moveSession(this.editSession, this.key, this.editDate);

    if (result === 'ok') {
      const newId = this.sessionsSvc.sessionId(this.editSession.dayId, this.editDate);
      if (newId !== this.key) {
        this.router.navigate(['/scheda/storico', encodeURIComponent(newId)]);
        return;
      }
      this.session = this.editSession;
      this.setDisplayDate(this.session.date);
      this.editSession = null;
      this.editMode = false;
      this.cdr.detectChanges();
    } else if (result === 'collision') {
      this.errorMsg = 'Esiste gia\' una seduta per questo giorno di allenamento in questa data.';
      this.cdr.detectChanges();
    } else {
      this.errorMsg = 'Errore durante il salvataggio. Riprova.';
      this.cdr.detectChanges();
    }
  }
```

diventa:

```ts
  async saveEdit(): Promise<void> {
    if (!this.editSession) return;
    if (!this.editDate || this.editDate > this.maxDate) {
      this.errorMsg = 'Data non valida: non puoi salvare una seduta senza data o con una data futura.';
      this.cdr.detectChanges();
      return;
    }
    this.errorMsg = '';
    this.historyEditState.saving.set(true);

    const result = await this.sessionsSvc.moveSession(this.editSession, this.key, this.editDate);
    this.historyEditState.saving.set(false);

    if (result === 'ok') {
      const newId = this.sessionsSvc.sessionId(this.editSession.dayId, this.editDate);
      if (newId !== this.key) {
        this.toast.success('Seduta aggiornata ✓');
        this.router.navigate(['/scheda/storico', encodeURIComponent(newId)]);
        return;
      }
      this.session = this.editSession;
      this.setDisplayDate(this.session.date);
      this.editSession = null;
      this.historyEditState.editMode.set(false);
      this.cdr.detectChanges();
      this.toast.success('Seduta aggiornata ✓');
    } else if (result === 'collision') {
      this.errorMsg = 'Esiste gia\' una seduta per questo giorno di allenamento in questa data.';
      this.cdr.detectChanges();
      this.toast.error('Esiste gia\' una seduta in questa data.');
    } else {
      this.errorMsg = 'Errore durante il salvataggio. Riprova.';
      this.cdr.detectChanges();
      this.toast.error('Errore durante il salvataggio. Riprova.');
    }
  }
```

- [ ] **Step 7: Rimuovi il bottone "Salva" dal template**

In `src/app/pages/history-detail/history-detail.component.html:85-88`, attuale:

```html
    <ng-container *ngIf="editMode">
      <button class="savebtn cancel-accent" (click)="cancelEdit()">Annulla</button>
      <button class="savebtn" (click)="saveEdit()">Salva</button>
    </ng-container>
```

diventa (resta solo "Annulla", ora da solo — non piu' in un `.row` a 2 colonne):

```html
    <ng-container *ngIf="editMode">
      <button class="savebtn cancel-accent" (click)="cancelEdit()">Annulla</button>
    </ng-container>
```

- [ ] **Step 8: Verifica compilazione e test invariati**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx ng test --watch=false && npx ng build`
Expected: nessun errore; stesso numero di test verdi di prima + i 4 di Task 4; build completata senza errori.

- [ ] **Step 9: Commit**

```bash
git add src/app/pages/history-detail/history-detail.component.ts src/app/pages/history-detail/history-detail.component.html
git commit -m "feat: sposta il salvataggio di history-detail su HistoryEditStateService + toast"
```

---

### Task 6: icona "Salva" di history-detail nell'header

**Files:**
- Modify: `src/app/components/navbar/navbar.component.ts` (nuovi `@Input`/`@Output`)
- Modify: `src/app/components/navbar/navbar.component.html:32-42` (nuovo bottone icona)
- Modify: `src/app/app.ts` (import servizio, iniezione, esposizione pubblica)
- Modify: `src/app/app.html:1-23` (nuovi binding su `<app-navbar>`)
- Modify: `src/styles.css` (stato disabled generico per `.navicon`)

**Interfaces:**
- Consumes: `HistoryEditStateService.editMode`, `.saving`, `.requestSave()` (Task 4).
- Produces: `NavbarComponent.showSaveEdit: boolean` (Input), `NavbarComponent.saveEditSaving: boolean` (Input), `NavbarComponent.saveEditClick: EventEmitter<void>` (Output) — nomi usati anche in `app.html`.

- [ ] **Step 1: Aggiungi `@Input`/`@Output` a `NavbarComponent`**

In `src/app/components/navbar/navbar.component.ts:20-22`, attuale:

```ts
  @Input() showSaveWorkout = false;
  @Input() saveStatus: 'idle' | 'saving' | 'saved' | 'err' = 'idle';
  @Input() showSettings = false;
```

diventa:

```ts
  @Input() showSaveWorkout = false;
  @Input() saveStatus: 'idle' | 'saving' | 'saved' | 'err' = 'idle';
  @Input() showSettings = false;
  @Input() showSaveEdit = false;
  @Input() saveEditSaving = false;
```

In `src/app/components/navbar/navbar.component.ts:30-31`, attuale:

```ts
  @Output() saveWorkoutClick = new EventEmitter<void>();
  @Output() settingsClick = new EventEmitter<void>();
```

diventa:

```ts
  @Output() saveWorkoutClick = new EventEmitter<void>();
  @Output() settingsClick = new EventEmitter<void>();
  @Output() saveEditClick = new EventEmitter<void>();
```

- [ ] **Step 2: Aggiungi il bottone icona in `navbar.component.html`**

In `src/app/components/navbar/navbar.component.html:12`, la condizione che nasconde `.navactions` quando non c'e' nulla da mostrare:

```html
    <div class="navactions" [class.hide]="!showHistory && !showInfo && !showAnalytics && !showShoppingList && !showViewToggle && !showSaveWorkout && !showSettings">
```

diventa (aggiunto `&& !showSaveEdit`):

```html
    <div class="navactions" [class.hide]="!showHistory && !showInfo && !showAnalytics && !showShoppingList && !showViewToggle && !showSaveWorkout && !showSettings && !showSaveEdit">
```

Subito dopo il bottone `.saveworkout-icon` (dopo la chiusura `</button>` di riga 42), aggiungi:

```html
      <button class="navicon" *ngIf="showSaveEdit" [disabled]="saveEditSaving"
        (click)="saveEditClick.emit()" aria-label="Salva modifiche" title="Salva modifiche">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
      </button>
```

- [ ] **Step 3: Inietta `HistoryEditStateService` in `app.ts` e passalo alla navbar**

In `src/app/app.ts:11-15` (import esistenti), aggiungi:

```ts
import { HistoryEditStateService } from './services/history-edit-state.service';
```

Nel costruttore (righe 40-47), attuale:

```ts
  constructor(
    private router: Router,
    private workoutData: WorkoutDataService,
    public workoutState: WorkoutStateService,
    public dietState: DietStateService,
    public auth: AuthService,
    private swUpdate: SwUpdate
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
    public historyEditState: HistoryEditStateService
  ) {}
```

- [ ] **Step 4: Aggiungi i binding in `app.html`**

Il blocco `<app-navbar>` attuale (`src/app/app.html:1-23`) e':

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
```

diventa:

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
  [showSaveEdit]="historyEditState.editMode()"
  [saveEditSaving]="historyEditState.saving()"
  (backClick)="onBack()"
  (historyClick)="onHistory()"
  (infoClick)="onInfo()"
  (analyticsClick)="onAnalytics()"
  (shoppingListClick)="onShoppingList()"
  (viewModeChange)="onViewModeChange($event)"
  (saveWorkoutClick)="onSaveWorkoutClick()"
  (settingsClick)="onSettingsClick()"
  (saveEditClick)="historyEditState.requestSave()">
</app-navbar>
```

- [ ] **Step 5: Stato disabled generico per `.navicon`**

In `src/styles.css`, subito dopo la riga `.navicon{...}` (`src/styles.css:108`), aggiungi:

```css
.navicon:disabled{opacity:.5;cursor:not-allowed;}
```

- [ ] **Step 6: Verifica compilazione e test invariati**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx ng test --watch=false && npx ng build`
Expected: nessun errore; stesso numero di test verdi di prima; build completata senza errori.

- [ ] **Step 7: Verifica manuale**

Run: `npx ng serve`, apri il dettaglio di una seduta passata, premi "Modifica": deve comparire l'icona di salvataggio nell'header; premi "Annulla": l'icona deve sparire; premi "Modifica" di nuovo e poi l'icona nell'header: la seduta si salva, compare il toast verde "Seduta aggiornata ✓", si torna alla vista di sola lettura.

- [ ] **Step 8: Commit**

```bash
git add src/app/components/navbar/navbar.component.ts src/app/components/navbar/navbar.component.html src/app/app.ts src/app/app.html src/styles.css
git commit -m "feat: icona di salvataggio di history-detail nell'header"
```

---

### Task 7: `ProtocolBuilderStateService`

**Files:**
- Create: `src/app/services/protocol-builder-state.service.ts`
- Test: `src/app/services/protocol-builder-state.service.spec.ts`

**Interfaces:**
- Produces: `ProtocolBuilderStateService.editingSubform: Signal<boolean>`, `.saving: Signal<boolean>`, `.registerHandlers(draft: (() => void) | null, activate: (() => void) | null): void`, `.requestSaveDraft(): void`, `.requestSaveActivate(): void`.

- [ ] **Step 1: Scrivi il test che fallisce**

```ts
// src/app/services/protocol-builder-state.service.spec.ts
import { ProtocolBuilderStateService } from './protocol-builder-state.service';

describe('ProtocolBuilderStateService', () => {
  let service: ProtocolBuilderStateService;

  beforeEach(() => {
    service = new ProtocolBuilderStateService();
  });

  it('editingSubform e saving partono a false', () => {
    expect(service.editingSubform()).toBe(false);
    expect(service.saving()).toBe(false);
  });

  it('requestSaveDraft()/requestSaveActivate() senza handler non lanciano', () => {
    expect(() => service.requestSaveDraft()).not.toThrow();
    expect(() => service.requestSaveActivate()).not.toThrow();
  });

  it('requestSaveDraft() invoca solo l\'handler bozza', () => {
    const draft = vi.fn();
    const activate = vi.fn();
    service.registerHandlers(draft, activate);
    service.requestSaveDraft();
    expect(draft).toHaveBeenCalledTimes(1);
    expect(activate).not.toHaveBeenCalled();
  });

  it('requestSaveActivate() invoca solo l\'handler attiva', () => {
    const draft = vi.fn();
    const activate = vi.fn();
    service.registerHandlers(draft, activate);
    service.requestSaveActivate();
    expect(activate).toHaveBeenCalledTimes(1);
    expect(draft).not.toHaveBeenCalled();
  });

  it('registerHandlers(null, null) rimuove entrambi gli handler', () => {
    const draft = vi.fn();
    const activate = vi.fn();
    service.registerHandlers(draft, activate);
    service.registerHandlers(null, null);
    service.requestSaveDraft();
    service.requestSaveActivate();
    expect(draft).not.toHaveBeenCalled();
    expect(activate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npx ng test --watch=false --include='**/protocol-builder-state.service.spec.ts'`
Expected: FAIL — `Cannot find module './protocol-builder-state.service'`

- [ ] **Step 3: Implementa `ProtocolBuilderStateService`**

```ts
// src/app/services/protocol-builder-state.service.ts
import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ProtocolBuilderStateService {
  editingSubform = signal(false);
  saving = signal(false);
  private draftHandler: (() => void) | null = null;
  private activateHandler: (() => void) | null = null;

  registerHandlers(draft: (() => void) | null, activate: (() => void) | null): void {
    this.draftHandler = draft;
    this.activateHandler = activate;
  }

  requestSaveDraft(): void {
    this.draftHandler?.();
  }

  requestSaveActivate(): void {
    this.activateHandler?.();
  }
}
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npx ng test --watch=false --include='**/protocol-builder-state.service.spec.ts'`
Expected: PASS — 5/5 test verdi

- [ ] **Step 5: Commit**

```bash
git add src/app/services/protocol-builder-state.service.ts src/app/services/protocol-builder-state.service.spec.ts
git commit -m "feat: aggiungi ProtocolBuilderStateService per il salvataggio da header"
```

---

### Task 8: coach-protocol-builder — usa `ProtocolBuilderStateService` + toast, rimuovi i 2 bottoni in fondo pagina

**Files:**
- Modify: `src/app/pages/coach-protocol-builder/coach-protocol-builder.component.ts` (import, costruttore, `editingExercise`/`editingMeal` → getter/setter, `ngOnInit`, `ngOnDestroy`, `save()`)
- Modify: `src/app/pages/coach-protocol-builder/coach-protocol-builder.component.html:409-416` (rimozione blocco `.savebar.builder-savebar`)

**Interfaces:**
- Consumes: `ProtocolBuilderStateService` (Task 7), `ToastService.success`/`.error` (Task 1).
- Produces: nessuna nuova interfaccia esterna — `editingExercise`/`editingMeal` mantengono le stesse firme pubbliche usate oggi dal template.

Nessun nuovo `.spec.ts` dedicato (stessa motivazione di Task 5 — nessun test esistente per questo componente da estendere, comportamento verificato manualmente).

- [ ] **Step 1: Import dei servizi**

In `src/app/pages/coach-protocol-builder/coach-protocol-builder.component.ts:10` (ultima riga import esistente), aggiungi subito dopo:

```ts
import { ProtocolBuilderStateService } from '../../services/protocol-builder-state.service';
import { ToastService } from '../../services/toast.service';
```

- [ ] **Step 2: Trasforma `editingMeal`/`editingExercise` in getter/setter sincronizzati**

I campi attuali (righe 32-33):

```ts
  editingMeal: NamedMeal | null = null;
  editingExercise: { day: Day; ex: Exercise; isNew: boolean } | null = null;
```

diventano (nessun'altra riga del file cambia: ogni `this.editingExercise = ...`/`this.editingMeal = ...` esistente continua a funzionare invariato, invocando il setter):

```ts
  private _editingMeal: NamedMeal | null = null;
  get editingMeal(): NamedMeal | null { return this._editingMeal; }
  set editingMeal(val: NamedMeal | null) {
    this._editingMeal = val;
    this.syncEditingSubform();
  }

  private _editingExercise: { day: Day; ex: Exercise; isNew: boolean } | null = null;
  get editingExercise(): { day: Day; ex: Exercise; isNew: boolean } | null { return this._editingExercise; }
  set editingExercise(val: { day: Day; ex: Exercise; isNew: boolean } | null) {
    this._editingExercise = val;
    this.syncEditingSubform();
  }

  private syncEditingSubform(): void {
    this.protocolBuilderState.editingSubform.set(!!this._editingExercise || !!this._editingMeal);
  }
```

- [ ] **Step 3: Aggiungi i 2 servizi al costruttore**

Il costruttore attuale (righe 39-45):

```ts
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private protocolSvc: ProtocolService,
    public workoutData: WorkoutDataService,
    private cdr: ChangeDetectorRef
  ) {}
```

diventa:

```ts
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private protocolSvc: ProtocolService,
    public workoutData: WorkoutDataService,
    private cdr: ChangeDetectorRef,
    private protocolBuilderState: ProtocolBuilderStateService,
    private toast: ToastService
  ) {}
```

- [ ] **Step 4: Registra/deregistra gli handler in `ngOnInit`/`ngOnDestroy`**

Attuali (righe 47-57):

```ts
  ngOnInit(): void {
    this.paramSub = this.route.paramMap.subscribe(params => {
      this.clientId = params.get('clientId') ?? '';
      this.protocolId = params.get('protocolId') ?? '';
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.paramSub?.unsubscribe();
  }
```

diventano:

```ts
  ngOnInit(): void {
    this.protocolBuilderState.registerHandlers(() => this.save(false), () => this.save(true));
    this.paramSub = this.route.paramMap.subscribe(params => {
      this.clientId = params.get('clientId') ?? '';
      this.protocolId = params.get('protocolId') ?? '';
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.paramSub?.unsubscribe();
    this.protocolBuilderState.registerHandlers(null, null);
    this.protocolBuilderState.editingSubform.set(false);
  }
```

- [ ] **Step 5: Aggiorna `save()`**

Attuale (righe 363-396):

```ts
  async save(activateAfter: boolean): Promise<void> {
    if (!this.protocol) return;
    this.saving = true;
    this.saveMsg = '';
    try {
      const toSave = {
        name: this.protocol.name,
        workout: this.protocol.workout,
        diet: this.protocol.diet,
        infoNote: this.protocol.infoNote
      };
      await this.protocolSvc.update(this.clientId, this.protocolId, toSave);

      // Verifica reale: rileggo da Firestore e confronto i conteggi strutturali
      // con quello che intendevo salvare, invece di fidarmi solo dell'assenza di errori.
      const reread = await this.protocolSvc.get(this.clientId, this.protocolId);
      const mismatch = this.findMismatch(toSave, reread);
      if (mismatch) {
        this.saveMsg = `Attenzione: il salvataggio sembra incompleto (${mismatch}). Riprova prima di attivare.`;
        this.saving = false;
        return;
      }

      if (activateAfter) {
        await this.protocolSvc.activate(this.clientId, this.protocolId);
      }
      this.router.navigate(['/coach/clienti', this.clientId]);
    } catch (e: any) {
      console.error('Errore salvataggio protocollo:', e);
      this.saveMsg = e?.message || 'Errore durante il salvataggio.';
    } finally {
      this.saving = false;
    }
  }
```

diventa:

```ts
  async save(activateAfter: boolean): Promise<void> {
    if (!this.protocol) return;
    this.saving = true;
    this.saveMsg = '';
    this.protocolBuilderState.saving.set(true);
    try {
      const toSave = {
        name: this.protocol.name,
        workout: this.protocol.workout,
        diet: this.protocol.diet,
        infoNote: this.protocol.infoNote
      };
      await this.protocolSvc.update(this.clientId, this.protocolId, toSave);

      // Verifica reale: rileggo da Firestore e confronto i conteggi strutturali
      // con quello che intendevo salvare, invece di fidarmi solo dell'assenza di errori.
      const reread = await this.protocolSvc.get(this.clientId, this.protocolId);
      const mismatch = this.findMismatch(toSave, reread);
      if (mismatch) {
        this.saveMsg = `Attenzione: il salvataggio sembra incompleto (${mismatch}). Riprova prima di attivare.`;
        this.toast.error('Salvataggio incompleto, riprova.');
        this.saving = false;
        return;
      }

      if (activateAfter) {
        await this.protocolSvc.activate(this.clientId, this.protocolId);
      }
      this.toast.success(activateAfter ? 'Protocollo attivato ✓' : 'Bozza salvata ✓');
      this.router.navigate(['/coach/clienti', this.clientId]);
    } catch (e: any) {
      console.error('Errore salvataggio protocollo:', e);
      this.saveMsg = e?.message || 'Errore durante il salvataggio.';
      this.toast.error('Errore durante il salvataggio. Riprova.');
    } finally {
      this.saving = false;
      this.protocolBuilderState.saving.set(false);
    }
  }
```

- [ ] **Step 6: Rimuovi i 2 bottoni dal template**

In `src/app/pages/coach-protocol-builder/coach-protocol-builder.component.html:409-416`, attuale:

```html
  <div class="savebar builder-savebar" *ngIf="!editingExercise && !editingMeal">
    <button class="confirmbtn cancel" style="flex:1" [disabled]="saving" (click)="save(false)">
      {{ saving ? '…' : 'Salva bozza' }}
    </button>
    <button class="savebtn" style="flex:1.4" [disabled]="saving" (click)="save(true)">
      {{ saving ? '…' : 'Salva e attiva' }}
    </button>
  </div>
```

va rimosso interamente (nessuna riga sostitutiva — il salvataggio ora avviene solo dall'header).

- [ ] **Step 7: Verifica compilazione e test invariati**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx ng test --watch=false && npx ng build`
Expected: nessun errore; stesso numero di test verdi di prima + i 5 di Task 7; build completata senza errori.

- [ ] **Step 8: Commit**

```bash
git add src/app/pages/coach-protocol-builder/coach-protocol-builder.component.ts src/app/pages/coach-protocol-builder/coach-protocol-builder.component.html
git commit -m "feat: sposta il salvataggio di coach-protocol-builder su ProtocolBuilderStateService + toast"
```

---

### Task 9: 2 icone "Salva bozza"/"Salva e attiva" di coach-protocol-builder nell'header

**Files:**
- Modify: `src/app/components/navbar/navbar.component.ts` (nuovi `@Input`/`@Output`)
- Modify: `src/app/components/navbar/navbar.component.html:32-42` (nuovo blocco 2 icone)
- Modify: `src/app/app.ts` (import servizio, iniezione, getter `showProtocolSave`)
- Modify: `src/app/app.html:1-25` (nuovi binding su `<app-navbar>`)
- Modify: `src/styles.css` (wrapper `.protocolsave`)

**Interfaces:**
- Consumes: `ProtocolBuilderStateService.editingSubform`, `.saving`, `.requestSaveDraft()`, `.requestSaveActivate()` (Task 7); `App.showSettings` (gia' esistente, `src/app/app.ts:35`).
- Produces: `NavbarComponent.showProtocolSave: boolean` (Input), `NavbarComponent.protocolSaving: boolean` (Input), `NavbarComponent.saveDraftClick: EventEmitter<void>`, `NavbarComponent.saveActivateClick: EventEmitter<void>` (Output).

- [ ] **Step 1: Aggiungi `@Input`/`@Output` a `NavbarComponent`**

Continuando da dove si e' fermato Task 6 (`src/app/components/navbar/navbar.component.ts`), attuale dopo Task 6:

```ts
  @Input() showSaveWorkout = false;
  @Input() saveStatus: 'idle' | 'saving' | 'saved' | 'err' = 'idle';
  @Input() showSettings = false;
  @Input() showSaveEdit = false;
  @Input() saveEditSaving = false;
```

diventa:

```ts
  @Input() showSaveWorkout = false;
  @Input() saveStatus: 'idle' | 'saving' | 'saved' | 'err' = 'idle';
  @Input() showSettings = false;
  @Input() showSaveEdit = false;
  @Input() saveEditSaving = false;
  @Input() showProtocolSave = false;
  @Input() protocolSaving = false;
```

E, dopo `@Output() saveEditClick = new EventEmitter<void>();` (aggiunto in Task 6):

```ts
  @Output() saveDraftClick = new EventEmitter<void>();
  @Output() saveActivateClick = new EventEmitter<void>();
```

- [ ] **Step 2: Aggiungi il blocco 2 icone in `navbar.component.html`**

Nella condizione di `.navactions` (aggiornata in Task 6), aggiungi anche `&& !showProtocolSave`:

```html
    <div class="navactions" [class.hide]="!showHistory && !showInfo && !showAnalytics && !showShoppingList && !showViewToggle && !showSaveWorkout && !showSettings && !showSaveEdit && !showProtocolSave">
```

Subito dopo il bottone `showSaveEdit` aggiunto in Task 6, aggiungi:

```html
      <div class="protocolsave" *ngIf="showProtocolSave">
        <button class="navicon" [disabled]="protocolSaving" (click)="saveDraftClick.emit()"
          aria-label="Salva bozza" title="Salva bozza">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
        </button>
        <button class="navicon" [disabled]="protocolSaving" (click)="saveActivateClick.emit()"
          aria-label="Salva e attiva" title="Salva e attiva">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        </button>
      </div>
```

- [ ] **Step 3: Inietta `ProtocolBuilderStateService` in `app.ts` e aggiungi il getter**

Import (continuando da Task 6):

```ts
import { ProtocolBuilderStateService } from './services/protocol-builder-state.service';
```

Costruttore (continuando da Task 6):

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

Subito dopo la dichiarazione del campo `showChrome = false;` (`src/app/app.ts:36`), aggiungi il getter:

```ts
  get showProtocolSave(): boolean {
    return this.showSettings && !this.protocolBuilderState.editingSubform();
  }
```

- [ ] **Step 4: Aggiungi i binding in `app.html`**

Continuando dal blocco `<app-navbar>` di Task 6, aggiungi 2 nuovi `[Input]` e 2 nuovi `(Output)`:

```html
  [showProtocolSave]="showProtocolSave"
  [protocolSaving]="protocolBuilderState.saving()"
```

subito dopo `[saveEditSaving]="historyEditState.saving()"`, e:

```html
  (saveDraftClick)="protocolBuilderState.requestSaveDraft()"
  (saveActivateClick)="protocolBuilderState.requestSaveActivate()"
```

subito dopo `(saveEditClick)="historyEditState.requestSave()"`.

- [ ] **Step 5: Aggiungi il CSS del wrapper `.protocolsave`**

In `src/styles.css`, subito dopo `.navicon:disabled{opacity:.5;cursor:not-allowed;}` (aggiunto in Task 6), aggiungi:

```css
.protocolsave{display:flex;gap:8px;}
```

- [ ] **Step 6: Verifica compilazione e test invariati**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx ng test --watch=false && npx ng build`
Expected: nessun errore; stesso numero di test verdi di prima; build completata senza errori.

- [ ] **Step 7: Verifica manuale**

Run: `npx ng serve`, apri il builder di un protocollo (come coach): devono comparire le 2 icone (bozza/attiva) nell'header; apri l'editor di un esercizio o pasto: le 2 icone devono sparire; chiudi l'editor: devono ricomparire; premi l'icona "bozza": compare il toast verde "Bozza salvata ✓"; premi l'icona "attiva" (da un altro protocollo per non navigare via subito, o verifica che dopo la navigazione il toast resti visibile): compare "Protocollo attivato ✓" e si torna alla pagina cliente. I 2 bottoni testuali in fondo pagina non ci sono piu'.

- [ ] **Step 8: Commit**

```bash
git add src/app/components/navbar/navbar.component.ts src/app/components/navbar/navbar.component.html src/app/app.ts src/app/app.html src/styles.css
git commit -m "feat: icone di salvataggio bozza/attiva di coach-protocol-builder nell'header"
```

---

## Self-Review Notes

- **Spec coverage:** `ToastService` generico → Task 1; `<app-toast>` montato nello shell → Task 2; scheda-detail solo aggiunta toast (nessun cambio strutturale) → Task 3; `HistoryEditStateService` → Task 4; history-detail rewiring + rimozione bottone → Task 5; icona header history-detail → Task 6; `ProtocolBuilderStateService` → Task 7; coach-protocol-builder rewiring + rimozione bottoni → Task 8; 2 icone header coach-protocol-builder → Task 9. Tutti i testi esatti dei toast, la posizione, il timing 2500ms e il perimetro delle 3 pagine sono coperti nei Global Constraints e ripetuti nei task pertinenti. Nessun gap.
- **Placeholder scan:** nessun TBD/TODO; ogni step ha codice completo con path esatti.
- **Type consistency:** `ToastService.success(message: string)`/`.error(message: string)` usati con la stessa firma in Task 3/5/8. `HistoryEditStateService.editMode/saving: Signal<boolean>`, `.registerSaveHandler`/`.requestSave()` usati identici in Task 5/6. `ProtocolBuilderStateService.editingSubform/saving: Signal<boolean>`, `.registerHandlers`/`.requestSaveDraft`/`.requestSaveActivate` usati identici in Task 8/9. `NavbarComponent` nuovi Input/Output (`showSaveEdit`, `saveEditSaving`, `saveEditClick`, `showProtocolSave`, `protocolSaving`, `saveDraftClick`, `saveActivateClick`) hanno lo stesso nome in Task 6/9 e nei binding di `app.html`.
