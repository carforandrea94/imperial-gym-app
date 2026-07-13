# Bottone "Aggiorna da PDF" nel builder protocollo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nel builder del protocollo, un bottone icona-only nell'header apre una schermata che permette di ricaricare scheda/dieta/integrazione anche singolarmente e aggiornare solo le parti corrispondenti del protocollo esistente, invece di dover ricreare tutto da zero con entrambi i PDF obbligatori.

**Architecture:** Nuovo slot generico nella navbar esistente (stesso schema di `showHistory`). Nuova route che riusa `CoachProtocolImportComponent` in una modalita' "aggiornamento" (attivata da un param `protocolId` opzionale): richiede almeno un file invece di scheda+dieta insieme, aggiorna solo le porzioni del protocollo corrispondenti ai file forniti, con conferma esplicita prima di salvare. Le note "Info" vengono tracciate internamente da 2 sorgenti separate (dieta, integrazione) cosi' ricaricarne una sola non cancella l'altra.

**Tech Stack:** Angular 21 standalone components, routing con param opzionale, pattern gia' usato in questa sessione per `MisuraCategoriaComponent` (dual mode creazione/modifica via route param).

## Global Constraints

- App zoneless (nessun zone.js): ogni cambio di stato che avviene dentro un `await`/callback non gia' tracciato da Angular deve chiamare esplicitamente `ChangeDetectorRef.detectChanges()` — stesso trattamento gia' presente in `coach-protocol-import.component.ts`'s `setStage()`.
- Il bottone "Aggiorna da PDF" compare SEMPRE sulla route builder, indipendentemente da `protocol.source` (anche un protocollo manuale puo' agganciare un PDF in seguito).
- Il flusso di creazione (`importa-pdf` senza `protocolId`) resta identico a oggi in tutto e per tutto: nessuna modifica al suo comportamento osservabile.
- Copy italiana, coerente con lo stile esistente.
- Nessuna nuova classe CSS: tutto riusa classi gia' esistenti (`authfield`, `savebar`, `savebtn`, `autherror`, `navicon`, `infocard`, `bacheca-text`).
- Convenzione di test del progetto: nessun nuovo test automatico per questo lavoro di UI/routing — verifica tramite `npx tsc --noEmit -p tsconfig.app.json`, `npx ng test --watch=false` (36/36 attesi, invariato), `npx ng build`.

---

### Task 1: campi interni `dietNotesSource`/`supplementNotesSource` sul modello Protocol

**Files:**
- Modify: `src/app/models/protocol.model.ts:14-26`

**Interfaces:**
- Produces: `Protocol.dietNotesSource?: string`, `Protocol.supplementNotesSource?: string` — usati dal Task 4.

- [ ] **Step 1: Aggiungi i 2 campi opzionali**

In `src/app/models/protocol.model.ts`, l'interfaccia `Protocol` attuale e':

```ts
export interface Protocol {
  id: string;
  clientId: string;
  coachId: string;
  name: string;
  status: ProtocolStatus;
  source: ProtocolSource;
  workout: WorkoutProtocol;
  diet: Diet;
  infoNote: string;
  createdAt: string;
  updatedAt: string;
}
```

Sostituiscila con (aggiunti i 2 campi opzionali, subito dopo `infoNote`):

```ts
export interface Protocol {
  id: string;
  clientId: string;
  coachId: string;
  name: string;
  status: ProtocolStatus;
  source: ProtocolSource;
  workout: WorkoutProtocol;
  diet: Diet;
  infoNote: string;
  /** Ultima estrazione da extractDietNotes(dietaText): permette di ricaricare
   *  solo l'integrazione senza perdere le note gia' derivate dalla dieta. */
  dietNotesSource?: string;
  /** Ultimo testo del PDF integrazione (trim): permette di ricaricare solo
   *  la dieta senza perdere le note gia' derivate dall'integrazione. */
  supplementNotesSource?: string;
  createdAt: string;
  updatedAt: string;
}
```

Campi opzionali: nessuna modifica necessaria a `emptyProtocol()`/`emptyWorkoutProtocol()` ne' a `normalizeProtocol()` in `protocol.service.ts` (i documenti esistenti senza questi campi restano validi, `undefined` e' un valore lecito).

- [ ] **Step 2: Verifica**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add src/app/models/protocol.model.ts
git commit -m "feat: aggiunge dietNotesSource/supplementNotesSource al modello Protocol"
```

---

### Task 2: slot `showSettings`/`settingsClick` nella navbar

**Files:**
- Modify: `src/app/components/navbar/navbar.component.ts`
- Modify: `src/app/components/navbar/navbar.component.html`

**Interfaces:**
- Produces: `NavbarComponent.showSettings: boolean` (input), `NavbarComponent.settingsClick: EventEmitter<void>` (output) — usati dal Task 3.

- [ ] **Step 1: Aggiungi l'input e l'output**

In `src/app/components/navbar/navbar.component.ts`, la lista di `@Input()`/`@Output()` attuale e':

```ts
  @Input() title = '';
  @Input() subtitle = '';
  @Input() showBack = false;
  @Input() showHistory = false;
  @Input() showInfo = false;
  @Input() showAnalytics = false;
  @Input() showShoppingList = false;
  @Input() showViewToggle = false;
  @Input() viewMode: 'list' | 'slider' = 'list';
  @Input() showSaveWorkout = false;
  @Input() saveStatus: 'idle' | 'saving' | 'saved' | 'err' = 'idle';

  @Output() backClick = new EventEmitter<void>();
  @Output() historyClick = new EventEmitter<void>();
  @Output() infoClick = new EventEmitter<void>();
  @Output() analyticsClick = new EventEmitter<void>();
  @Output() shoppingListClick = new EventEmitter<void>();
  @Output() viewModeChange = new EventEmitter<'list' | 'slider'>();
  @Output() saveWorkoutClick = new EventEmitter<void>();
```

Sostituiscila con (aggiunti `showSettings` e `settingsClick`):

```ts
  @Input() title = '';
  @Input() subtitle = '';
  @Input() showBack = false;
  @Input() showHistory = false;
  @Input() showInfo = false;
  @Input() showAnalytics = false;
  @Input() showShoppingList = false;
  @Input() showViewToggle = false;
  @Input() viewMode: 'list' | 'slider' = 'list';
  @Input() showSaveWorkout = false;
  @Input() saveStatus: 'idle' | 'saving' | 'saved' | 'err' = 'idle';
  @Input() showSettings = false;

  @Output() backClick = new EventEmitter<void>();
  @Output() historyClick = new EventEmitter<void>();
  @Output() infoClick = new EventEmitter<void>();
  @Output() analyticsClick = new EventEmitter<void>();
  @Output() shoppingListClick = new EventEmitter<void>();
  @Output() viewModeChange = new EventEmitter<'list' | 'slider'>();
  @Output() saveWorkoutClick = new EventEmitter<void>();
  @Output() settingsClick = new EventEmitter<void>();
```

- [ ] **Step 2: Aggiungi il bottone nel template**

In `src/app/components/navbar/navbar.component.html`, la riga 12 (apertura di `.navactions`) e':

```html
    <div class="navactions" [class.hide]="!showHistory && !showInfo && !showAnalytics && !showShoppingList && !showViewToggle && !showSaveWorkout">
```

Sostituiscila con (aggiunto `showSettings` alla condizione di hide):

```html
    <div class="navactions" [class.hide]="!showHistory && !showInfo && !showAnalytics && !showShoppingList && !showViewToggle && !showSaveWorkout && !showSettings">
```

Poi, subito dopo il bottone `showInfo` (righe 62-68, il bottone con l'icona "i" e' l'ultimo del blocco `.navactions`, subito prima della chiusura `</div>` di riga 69), aggiungi un nuovo bottone con icona a ingranaggio:

```html
      <button class="navicon" *ngIf="showSettings" (click)="settingsClick.emit()" title="Aggiorna da PDF">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>
```

(Stessa icona a ingranaggio gia' usata altrove in questo codebase, es. il bottone "recupero" in `scheda-detail.component.html` — nessuna nuova icona da disegnare da zero.)

- [ ] **Step 3: Verifica**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx ng build`
Expected: nessun errore, build ok (nessun componente usa ancora `showSettings`/`settingsClick`, ma devono compilare).

- [ ] **Step 4: Commit**

```bash
git add src/app/components/navbar/navbar.component.ts src/app/components/navbar/navbar.component.html
git commit -m "feat: aggiunge lo slot showSettings/settingsClick alla navbar"
```

---

### Task 3: wiring in app.ts/app.html per la route builder

**Files:**
- Modify: `src/app/app.ts`
- Modify: `src/app/app.html`

**Interfaces:**
- Consumes: `NavbarComponent.showSettings`/`settingsClick` (Task 2).
- Produces: naviga a `/coach/clienti/:clientId/aggiorna-pdf/:protocolId` (route creata dal Task 4 — in questo task il click naviga gia' li', anche se la route non esiste ancora finche' il Task 4 non e' completo).

- [ ] **Step 1: Abilita `showSettings` sulla route builder**

In `src/app/app.ts`, il blocco `updateNav()` per la route builder (attualmente righe 165-173) e':

```ts
    if (/^\/coach\/clienti\/[^/]+\/builder\/[^/]+$/.test(u)) {
      this.navTitle = 'Protocollo';
      this.navSubtitle = '';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      return;
    }
```

Sostituiscilo con (aggiunto `this.showSettings = true;`):

```ts
    if (/^\/coach\/clienti\/[^/]+\/builder\/[^/]+$/.test(u)) {
      this.navTitle = 'Protocollo';
      this.navSubtitle = '';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      this.showSettings = true;
      return;
    }
```

- [ ] **Step 2: Resetta `showSettings` di default**

Subito dopo la riga `this.showViewToggle = false;` all'inizio di `updateNav()` (il blocco di reset comune a tutte le route, prima di qualunque `if`), aggiungi `this.showSettings = false;`. Il blocco di reset attuale e':

```ts
    this.showChrome = true;
    this.showShoppingList = false;
    this.showViewToggle = false;
    this.showSaveWorkout = false;
```

Sostituiscilo con:

```ts
    this.showChrome = true;
    this.showShoppingList = false;
    this.showViewToggle = false;
    this.showSaveWorkout = false;
    this.showSettings = false;
```

- [ ] **Step 3: Aggiungi il campo e il metodo `onSettingsClick()`**

Vicino alla dichiarazione di `showSaveWorkout = false;` (nella lista dei campi in cima alla classe), aggiungi:

```ts
  showSettings = false;
```

Subito dopo il metodo `onHistory()` (o in qualunque punto tra gli altri metodi `on*Click`), aggiungi:

```ts
  onSettingsClick(): void {
    const u = this.router.url.split('?')[0];
    const match = u.match(/^\/coach\/clienti\/([^/]+)\/builder\/([^/]+)$/);
    if (!match) return;
    this.router.navigate(['/coach/clienti', match[1], 'aggiorna-pdf', match[2]]);
  }
```

- [ ] **Step 4: Aggiungi il ramo in `onBack()` per la nuova route**

In `src/app/app.ts`, il metodo `onBack()` ha attualmente questo ramo per `importa-pdf`:

```ts
    } else if (/^\/coach\/clienti\/[^/]+\/importa-pdf$/.test(u)) {
      const clientId = u.split('/')[3];
      this.router.navigate(['/coach/clienti', clientId, 'nuovo']);
```

Aggiungi un ramo analogo per `aggiorna-pdf`, PRIMA di questo (l'ordine tra i due non e' significativo perche' i pattern non si sovrappongono, ma per chiarezza lo mettiamo subito sopra):

```ts
    } else if (/^\/coach\/clienti\/[^/]+\/aggiorna-pdf\/[^/]+$/.test(u)) {
      const parts = u.split('/');
      this.router.navigate(['/coach/clienti', parts[3], 'builder', parts[5]]);
    } else if (/^\/coach\/clienti\/[^/]+\/importa-pdf$/.test(u)) {
      const clientId = u.split('/')[3];
      this.router.navigate(['/coach/clienti', clientId, 'nuovo']);
```

- [ ] **Step 5: Aggiorna il binding nel template**

In `src/app/app.html`, l'elemento `<app-navbar>` attuale ha (tra gli altri) questi binding:

```html
  [showShoppingList]="showShoppingList"
  [showViewToggle]="showViewToggle"
  [viewMode]="currentViewMode()"
  [showSaveWorkout]="showSaveWorkout"
  [saveStatus]="workoutState.saveStatus()"
  (backClick)="onBack()"
  (historyClick)="onHistory()"
  (infoClick)="onInfo()"
  (analyticsClick)="onAnalytics()"
  (shoppingListClick)="onShoppingList()"
  (viewModeChange)="onViewModeChange($event)"
  (saveWorkoutClick)="onSaveWorkoutClick()">
```

Sostituiscilo con (aggiunti `[showSettings]` e `(settingsClick)`):

```html
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
```

- [ ] **Step 6: Verifica**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx ng build`
Expected: nessun errore, build ok.

- [ ] **Step 7: Commit**

```bash
git add src/app/app.ts src/app/app.html
git commit -m "feat: bottone impostazioni nell'header del builder, naviga ad aggiorna-pdf"
```

---

### Task 4: route + modalita' aggiornamento in CoachProtocolImportComponent

**Files:**
- Modify: `src/app/app.routes.ts`
- Modify: `src/app/pages/coach-protocol-import/coach-protocol-import.component.ts`
- Modify: `src/app/pages/coach-protocol-import/coach-protocol-import.component.html`

**Interfaces:**
- Consumes: `Protocol.dietNotesSource`/`supplementNotesSource` (Task 1), `ProtocolService.get(clientId, id): Promise<Protocol | null>` (gia' esistente), `ProtocolService.update(clientId, id, patch: Partial<Protocol>): Promise<void>` (gia' esistente), `PdfImportService.detectProtocolWeekPlan(days, totalWeeks): WeekPlan[]` (gia' esistente), `ConfirmDialogService.confirm(message: string): Promise<boolean>` (gia' esistente).

- [ ] **Step 1: Aggiungi la nuova route**

In `src/app/app.routes.ts`, subito dopo la route esistente:

```ts
  {
    path: 'coach/clienti/:clientId/importa-pdf',
    canActivate: [authGuard, coachGuard],
    loadComponent: () => import('./pages/coach-protocol-import/coach-protocol-import.component').then(m => m.CoachProtocolImportComponent)
  },
```

aggiungi (stesso componente, nuovo path con `protocolId`):

```ts
  {
    path: 'coach/clienti/:clientId/aggiorna-pdf/:protocolId',
    canActivate: [authGuard, coachGuard],
    loadComponent: () => import('./pages/coach-protocol-import/coach-protocol-import.component').then(m => m.CoachProtocolImportComponent)
  },
```

- [ ] **Step 2: Aggiorna il componente TypeScript**

Il file attuale `src/app/pages/coach-protocol-import/coach-protocol-import.component.ts` e':

```ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { PdfImportService } from '../../services/pdf-import.service';
import { ProtocolService } from '../../services/protocol.service';
import { AuthService } from '../../core/services/auth.service';
import { todayLocalISO } from '../../core/utils/date.util';

/** Tempo massimo per ciascuna fase prima di rinunciare e segnalare un errore
 *  invece di restare bloccati a tempo indeterminato senza alcun feedback
 *  (es. se il worker di pdf.js non riesce a caricarsi/rispondere). */
const STEP_TIMEOUT_MS = 25000;

@Component({
  selector: 'app-coach-protocol-import',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './coach-protocol-import.component.html',
  styles: [`
    :host { display: block; animation: fade .4s var(--spring-soft); }

    .pdf-overlay {
      position: fixed; inset: 0; z-index: 1000;
      display: flex; align-items: center; justify-content: center;
      background: rgba(4, 10, 8, 0.72);
      backdrop-filter: blur(6px) saturate(120%);
      -webkit-backdrop-filter: blur(6px) saturate(120%);
      animation: fade .25s var(--spring-soft);
    }
    .pdf-overlay-card {
      width: min(340px, 86vw);
      padding: 28px 24px;
      border-radius: 24px;
      background: var(--content-glass-bg, rgba(20,26,24,0.9));
      border: 1px solid var(--content-glass-border, rgba(255,255,255,.12));
      box-shadow: 0 20px 50px rgba(0,0,0,.45);
      text-align: center;
    }
    .pdf-overlay-stage {
      font-family: 'Inter', sans-serif; font-weight: 600; font-size: 15px;
      color: #fff; margin-bottom: 18px;
    }
    .pdf-progress-track {
      width: 100%; height: 8px; border-radius: 999px;
      background: rgba(255,255,255,.12); overflow: hidden;
    }
    .pdf-progress-fill {
      height: 100%; border-radius: 999px;
      background: linear-gradient(90deg, #0F7A57, var(--imp-red));
      transition: width .35s var(--spring-soft, ease);
    }
    .pdf-progress-pct {
      margin-top: 10px; font-family: 'IBM Plex Mono', monospace;
      font-size: 12.5px; color: var(--label-2, rgba(255,255,255,.6));
    }
  `]
})
export class CoachProtocolImportComponent implements OnInit, OnDestroy {
  clientId = '';
  private paramSub: Subscription | null = null;

  schedaFile: File | null = null;
  dietaFile: File | null = null;
  integrazioneFile: File | null = null;

  processing = false;
  errorMsg = '';
  /** Fase corrente mostrata all'utente durante l'elaborazione (vedi template). */
  stage = '';
  /** Avanzamento indicativo per fase (0-100), mostrato nella progress bar dell'overlay. */
  progressPercent = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private pdfSvc: PdfImportService,
    private protocolSvc: ProtocolService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.paramSub = this.route.paramMap.subscribe(params => {
      this.clientId = params.get('clientId') ?? '';
    });
  }

  ngOnDestroy(): void {
    this.paramSub?.unsubscribe();
  }

  onFile(event: Event, which: 'scheda' | 'dieta' | 'integrazione'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (which === 'scheda') this.schedaFile = file;
    if (which === 'dieta') this.dietaFile = file;
    if (which === 'integrazione') this.integrazioneFile = file;
  }

  get canProcess(): boolean {
    return !!this.schedaFile && !!this.dietaFile && !this.processing;
  }

  private async withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${label}: tempo scaduto. Riprova, o verifica che il PDF non sia troppo pesante/corrotto.`)),
        STEP_TIMEOUT_MS
      );
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timer!);
    }
  }

  private setStage(stage: string, percent: number): void {
    this.stage = stage;
    this.progressPercent = percent;
    // App senza zone.js: senza questa chiamata esplicita la vista non si
    // ridisegna dopo un await su Promise "pure" (Firestore, worker pdf.js),
    // restando visivamente bloccata sull'ultimo stage anche se lo stato interno
    // e' gia' avanzato (stesso problema che ZoneFixService risolve altrove).
    this.cdr.detectChanges();
  }

  async process(): Promise<void> {
    if (!this.canProcess) return;
    this.processing = true;
    this.errorMsg = '';

    try {
      this.setStage('Creazione bozza protocollo…', 5);
      const coach = this.auth.currentUser()!;
      const id = await this.withTimeout(this.protocolSvc.create(this.clientId, coach.uid), 'Creazione bozza protocollo');

      this.setStage('Lettura scheda allenamento…', 20);
      const schedaText = await this.withTimeout(this.pdfSvc.extractText(this.schedaFile!), 'Lettura scheda');

      this.setStage('Lettura dieta…', 40);
      const dietaText = await this.withTimeout(this.pdfSvc.extractText(this.dietaFile!), 'Lettura dieta');

      this.setStage('Analisi esercizi e alimenti…', 65);
      const days = this.pdfSvc.parseWorkoutText(schedaText);
      const diet = this.pdfSvc.parseDietText(dietaText);
      const durationWeeks = this.pdfSvc.detectProgramDurationWeeks(schedaText);
      const weekPlan = this.pdfSvc.detectProtocolWeekPlan(days, durationWeeks);

      let infoNote = this.pdfSvc.extractDietNotes(dietaText);
      if (this.integrazioneFile) {
        this.setStage('Lettura integrazione…', 75);
        const integrazioneText = await this.withTimeout(this.pdfSvc.extractText(this.integrazioneFile), 'Lettura integrazione');
        infoNote = [infoNote, integrazioneText.trim()].filter(Boolean).join('\n\n');
      }

      this.setStage('Salvataggio protocollo…', 90);
      await this.withTimeout(this.protocolSvc.update(this.clientId, id, {
        name: 'Protocollo da PDF',
        source: 'pdf',
        workout: { weekPlan, days, programStart: todayLocalISO() },
        diet,
        infoNote
      }), 'Salvataggio protocollo');

      this.setStage('Completato', 100);
      this.router.navigate(['/coach/clienti', this.clientId]);
    } catch (e: any) {
      console.error('Errore importazione PDF:', e);
      this.errorMsg = e?.message || 'Errore durante la lettura dei PDF. Riprova o crea il protocollo manualmente.';
    } finally {
      this.processing = false;
      this.stage = '';
      this.progressPercent = 0;
      this.cdr.detectChanges();
    }
  }
}
```

Sostituiscilo interamente con:

```ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { PdfImportService } from '../../services/pdf-import.service';
import { ProtocolService } from '../../services/protocol.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { AuthService } from '../../core/services/auth.service';
import { todayLocalISO } from '../../core/utils/date.util';
import { Protocol } from '../../models/protocol.model';

/** Tempo massimo per ciascuna fase prima di rinunciare e segnalare un errore
 *  invece di restare bloccati a tempo indeterminato senza alcun feedback
 *  (es. se il worker di pdf.js non riesce a caricarsi/rispondere). */
const STEP_TIMEOUT_MS = 25000;

@Component({
  selector: 'app-coach-protocol-import',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './coach-protocol-import.component.html',
  styles: [`
    :host { display: block; animation: fade .4s var(--spring-soft); }

    .pdf-overlay {
      position: fixed; inset: 0; z-index: 1000;
      display: flex; align-items: center; justify-content: center;
      background: rgba(4, 10, 8, 0.72);
      backdrop-filter: blur(6px) saturate(120%);
      -webkit-backdrop-filter: blur(6px) saturate(120%);
      animation: fade .25s var(--spring-soft);
    }
    .pdf-overlay-card {
      width: min(340px, 86vw);
      padding: 28px 24px;
      border-radius: 24px;
      background: var(--content-glass-bg, rgba(20,26,24,0.9));
      border: 1px solid var(--content-glass-border, rgba(255,255,255,.12));
      box-shadow: 0 20px 50px rgba(0,0,0,.45);
      text-align: center;
    }
    .pdf-overlay-stage {
      font-family: 'Inter', sans-serif; font-weight: 600; font-size: 15px;
      color: #fff; margin-bottom: 18px;
    }
    .pdf-progress-track {
      width: 100%; height: 8px; border-radius: 999px;
      background: rgba(255,255,255,.12); overflow: hidden;
    }
    .pdf-progress-fill {
      height: 100%; border-radius: 999px;
      background: linear-gradient(90deg, #0F7A57, var(--imp-red));
      transition: width .35s var(--spring-soft, ease);
    }
    .pdf-progress-pct {
      margin-top: 10px; font-family: 'IBM Plex Mono', monospace;
      font-size: 12.5px; color: var(--label-2, rgba(255,255,255,.6));
    }
  `]
})
export class CoachProtocolImportComponent implements OnInit, OnDestroy {
  clientId = '';
  /** Vuoto in modalita' creazione; valorizzato in modalita' aggiornamento (route con :protocolId). */
  protocolId = '';
  private existingProtocol: Protocol | null = null;
  private paramSub: Subscription | null = null;

  schedaFile: File | null = null;
  dietaFile: File | null = null;
  integrazioneFile: File | null = null;

  processing = false;
  errorMsg = '';
  /** Fase corrente mostrata all'utente durante l'elaborazione (vedi template). */
  stage = '';
  /** Avanzamento indicativo per fase (0-100), mostrato nella progress bar dell'overlay. */
  progressPercent = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private pdfSvc: PdfImportService,
    private protocolSvc: ProtocolService,
    private confirm: ConfirmDialogService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  get isUpdateMode(): boolean {
    return !!this.protocolId;
  }

  ngOnInit(): void {
    this.paramSub = this.route.paramMap.subscribe(params => {
      this.clientId = params.get('clientId') ?? '';
      this.protocolId = params.get('protocolId') ?? '';
      if (this.protocolId) this.loadExisting();
    });
  }

  ngOnDestroy(): void {
    this.paramSub?.unsubscribe();
  }

  private async loadExisting(): Promise<void> {
    const p = await this.protocolSvc.get(this.clientId, this.protocolId);
    if (!p) { this.router.navigate(['/coach/clienti', this.clientId]); return; }
    this.existingProtocol = p;
    this.cdr.detectChanges();
  }

  onFile(event: Event, which: 'scheda' | 'dieta' | 'integrazione'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (which === 'scheda') this.schedaFile = file;
    if (which === 'dieta') this.dietaFile = file;
    if (which === 'integrazione') this.integrazioneFile = file;
  }

  get canProcess(): boolean {
    if (this.processing) return false;
    if (this.isUpdateMode) return !!(this.schedaFile || this.dietaFile || this.integrazioneFile);
    return !!this.schedaFile && !!this.dietaFile;
  }

  private async withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${label}: tempo scaduto. Riprova, o verifica che il PDF non sia troppo pesante/corrotto.`)),
        STEP_TIMEOUT_MS
      );
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timer!);
    }
  }

  private setStage(stage: string, percent: number): void {
    this.stage = stage;
    this.progressPercent = percent;
    // App senza zone.js: senza questa chiamata esplicita la vista non si
    // ridisegna dopo un await su Promise "pure" (Firestore, worker pdf.js),
    // restando visivamente bloccata sull'ultimo stage anche se lo stato interno
    // e' gia' avanzato (stesso problema che ZoneFixService risolve altrove).
    this.cdr.detectChanges();
  }

  private buildConfirmMessage(): string {
    const parts: string[] = [];
    if (this.schedaFile) parts.push('giorni di allenamento e onda di carico');
    if (this.dietaFile) parts.push('dieta e note');
    if (this.integrazioneFile) parts.push('note integrazione');
    return `Verranno aggiornati: ${parts.join(', ')}. Continuare?`;
  }

  async process(): Promise<void> {
    if (!this.canProcess) return;

    if (this.isUpdateMode) {
      const ok = await this.confirm.confirm(this.buildConfirmMessage());
      if (!ok) return;
    }

    this.processing = true;
    this.errorMsg = '';

    try {
      if (this.isUpdateMode) {
        await this.processUpdate();
      } else {
        await this.processCreate();
      }
    } catch (e: any) {
      console.error('Errore importazione PDF:', e);
      this.errorMsg = e?.message || 'Errore durante la lettura dei PDF. Riprova o crea il protocollo manualmente.';
    } finally {
      this.processing = false;
      this.stage = '';
      this.progressPercent = 0;
      this.cdr.detectChanges();
    }
  }

  private async processCreate(): Promise<void> {
    this.setStage('Creazione bozza protocollo…', 5);
    const coach = this.auth.currentUser()!;
    const id = await this.withTimeout(this.protocolSvc.create(this.clientId, coach.uid), 'Creazione bozza protocollo');

    this.setStage('Lettura scheda allenamento…', 20);
    const schedaText = await this.withTimeout(this.pdfSvc.extractText(this.schedaFile!), 'Lettura scheda');

    this.setStage('Lettura dieta…', 40);
    const dietaText = await this.withTimeout(this.pdfSvc.extractText(this.dietaFile!), 'Lettura dieta');

    this.setStage('Analisi esercizi e alimenti…', 65);
    const days = this.pdfSvc.parseWorkoutText(schedaText);
    const diet = this.pdfSvc.parseDietText(dietaText);
    const durationWeeks = this.pdfSvc.detectProgramDurationWeeks(schedaText);
    const weekPlan = this.pdfSvc.detectProtocolWeekPlan(days, durationWeeks);

    const dietNotesSource = this.pdfSvc.extractDietNotes(dietaText);
    let supplementNotesSource = '';
    if (this.integrazioneFile) {
      this.setStage('Lettura integrazione…', 75);
      const integrazioneText = await this.withTimeout(this.pdfSvc.extractText(this.integrazioneFile), 'Lettura integrazione');
      supplementNotesSource = integrazioneText.trim();
    }
    const infoNote = [dietNotesSource, supplementNotesSource].filter(Boolean).join('\n\n');

    this.setStage('Salvataggio protocollo…', 90);
    await this.withTimeout(this.protocolSvc.update(this.clientId, id, {
      name: 'Protocollo da PDF',
      source: 'pdf',
      workout: { weekPlan, days, programStart: todayLocalISO() },
      diet,
      dietNotesSource,
      supplementNotesSource,
      infoNote
    }), 'Salvataggio protocollo');

    this.setStage('Completato', 100);
    this.router.navigate(['/coach/clienti', this.clientId]);
  }

  private async processUpdate(): Promise<void> {
    const existing = this.existingProtocol!;
    const patch: Partial<Protocol> = {};
    let percent = 10;

    if (this.schedaFile) {
      this.setStage('Lettura scheda allenamento…', percent);
      const schedaText = await this.withTimeout(this.pdfSvc.extractText(this.schedaFile), 'Lettura scheda');
      const days = this.pdfSvc.parseWorkoutText(schedaText);
      const durationWeeks = this.pdfSvc.detectProgramDurationWeeks(schedaText);
      const weekPlan = this.pdfSvc.detectProtocolWeekPlan(days, durationWeeks);
      patch.workout = { ...existing.workout, days, weekPlan };
      percent = 40;
    }

    let dietNotesSource = existing.dietNotesSource ?? '';
    let supplementNotesSource = existing.supplementNotesSource ?? '';

    if (this.dietaFile) {
      this.setStage('Lettura dieta…', percent);
      const dietaText = await this.withTimeout(this.pdfSvc.extractText(this.dietaFile), 'Lettura dieta');
      patch.diet = this.pdfSvc.parseDietText(dietaText);
      dietNotesSource = this.pdfSvc.extractDietNotes(dietaText);
      percent = 65;
    }

    if (this.integrazioneFile) {
      this.setStage('Lettura integrazione…', percent);
      const integrazioneText = await this.withTimeout(this.pdfSvc.extractText(this.integrazioneFile), 'Lettura integrazione');
      supplementNotesSource = integrazioneText.trim();
    }

    if (this.dietaFile || this.integrazioneFile) {
      patch.dietNotesSource = dietNotesSource;
      patch.supplementNotesSource = supplementNotesSource;
      patch.infoNote = [dietNotesSource, supplementNotesSource].filter(Boolean).join('\n\n');
    }

    this.setStage('Salvataggio protocollo…', 90);
    await this.withTimeout(this.protocolSvc.update(this.clientId, this.protocolId, patch), 'Salvataggio protocollo');

    this.setStage('Completato', 100);
    this.router.navigate(['/coach/clienti', this.clientId, 'builder', this.protocolId]);
  }
}
```

- [ ] **Step 3: Aggiorna il template**

Il file attuale `src/app/pages/coach-protocol-import/coach-protocol-import.component.html` e':

```html
<p class="sectiontitle">Carica i PDF</p>

<div class="infocard" style="margin-bottom:14px">
  <p class="bacheca-text" style="margin-bottom:14px">
    L'app prova a leggere i PDF ed estrarre esercizi e alimenti automaticamente.
    E' un'estrazione best-effort: funziona meglio se il PDF ha un formato semplice
    (una riga per esercizio/alimento). Rivedi sempre la bozza nel builder prima di attivarla.
  </p>

  <div class="authfield">
    <label>Scheda allenamento (obbligatorio)</label>
    <input type="file" accept="application/pdf" (change)="onFile($event, 'scheda')" />
  </div>

  <div class="authfield">
    <label>Dieta (obbligatorio)</label>
    <input type="file" accept="application/pdf" (change)="onFile($event, 'dieta')" />
  </div>

  <div class="authfield" style="margin-bottom:0">
    <label>Integrazione (opzionale — finisce nella scheda Info)</label>
    <input type="file" accept="application/pdf" (change)="onFile($event, 'integrazione')" />
  </div>
</div>

<p class="autherror" *ngIf="errorMsg">{{ errorMsg }}</p>

<div class="savebar">
  <button class="savebtn" [disabled]="!canProcess" (click)="process()">
    {{ processing ? 'Elaborazione in corso…' : 'Elabora e crea bozza' }}
  </button>
</div>

<div class="pdf-overlay" *ngIf="processing">
  <div class="pdf-overlay-card">
    <p class="pdf-overlay-stage">{{ stage || 'Elaborazione…' }}</p>
    <div class="pdf-progress-track">
      <div class="pdf-progress-fill" [style.width.%]="progressPercent"></div>
    </div>
    <p class="pdf-progress-pct">{{ progressPercent }}%</p>
  </div>
</div>
```

Sostituiscilo con (titolo/intro/etichette condizionali in base a `isUpdateMode`, bottone con testo diverso, il resto invariato):

```html
<p class="sectiontitle">{{ isUpdateMode ? 'Aggiorna da PDF' : 'Carica i PDF' }}</p>

<div class="infocard" style="margin-bottom:14px">
  <p class="bacheca-text" style="margin-bottom:14px" *ngIf="!isUpdateMode">
    L'app prova a leggere i PDF ed estrarre esercizi e alimenti automaticamente.
    E' un'estrazione best-effort: funziona meglio se il PDF ha un formato semplice
    (una riga per esercizio/alimento). Rivedi sempre la bozza nel builder prima di attivarla.
  </p>
  <p class="bacheca-text" style="margin-bottom:14px" *ngIf="isUpdateMode">
    Carica almeno uno dei PDF per aggiornare le parti corrispondenti del
    protocollo. Ricaricare la dieta o l'integrazione da sola non cancella le
    note dell'altra.
  </p>

  <div class="authfield">
    <label>{{ isUpdateMode ? 'Scheda allenamento' : 'Scheda allenamento (obbligatorio)' }}</label>
    <input type="file" accept="application/pdf" (change)="onFile($event, 'scheda')" />
  </div>

  <div class="authfield">
    <label>{{ isUpdateMode ? 'Dieta' : 'Dieta (obbligatorio)' }}</label>
    <input type="file" accept="application/pdf" (change)="onFile($event, 'dieta')" />
  </div>

  <div class="authfield" style="margin-bottom:0">
    <label>Integrazione (opzionale — finisce nella scheda Info)</label>
    <input type="file" accept="application/pdf" (change)="onFile($event, 'integrazione')" />
  </div>
</div>

<p class="autherror" *ngIf="errorMsg">{{ errorMsg }}</p>

<div class="savebar">
  <button class="savebtn" [disabled]="!canProcess" (click)="process()">
    {{ processing ? 'Elaborazione in corso…' : (isUpdateMode ? 'Aggiorna protocollo' : 'Elabora e crea bozza') }}
  </button>
</div>

<div class="pdf-overlay" *ngIf="processing">
  <div class="pdf-overlay-card">
    <p class="pdf-overlay-stage">{{ stage || 'Elaborazione…' }}</p>
    <div class="pdf-progress-track">
      <div class="pdf-progress-fill" [style.width.%]="progressPercent"></div>
    </div>
    <p class="pdf-progress-pct">{{ progressPercent }}%</p>
  </div>
</div>
```

- [ ] **Step 4: Verifica**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx ng test --watch=false && npx ng build`
Expected: tsc pulito, 36/36 test (invariato — nessun nuovo test per questo task, per convenzione), build ok.

- [ ] **Step 5: Commit**

```bash
git add src/app/app.routes.ts src/app/pages/coach-protocol-import/coach-protocol-import.component.ts src/app/pages/coach-protocol-import/coach-protocol-import.component.html
git commit -m "feat: modalita' aggiornamento in CoachProtocolImportComponent, ricarica PDF singolarmente"
```
