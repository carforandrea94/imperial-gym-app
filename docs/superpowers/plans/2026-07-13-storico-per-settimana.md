# Storico sedute diviso per settimana Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dividere lo storico sedute (`HistoryListComponent`) in gruppi per settimana del protocollo attivo, invece della lista piatta attuale.

**Architecture:** Un nuovo metodo puro `WorkoutStateService.weekNumberForDate(dateISO, programStart)` classifica la settimana di una data qualsiasi (stessa formula di `computeAutoWeek`, senza clamp). `HistoryListComponent` lo usa per assegnare un numero di settimana a ogni seduta caricata, poi raggruppa le sedute in sezioni ordinate.

**Tech Stack:** Angular 21 standalone component, Vitest (`npx ng test`), TestBed per testare un servizio che usa `effect()` in costruttore.

## Global Constraints

- `computeAutoWeek()` (righe 99-106 di `workout-state.service.ts`) NON va modificato — resta la logica esistente per "qual e' la settimana di oggi".
- `weekNumberForDate` usa la stessa formula (`Math.floor(diffDays / 7) + 1`) ma senza alcun `Math.min`/`Math.max`: un risultato ≤ 0 significa "prima dell'inizio del programma attuale", un risultato > maxWeeks e' legittimo (nessun clamp superiore).
- Etichette gruppo: `Settimana {n}` per settimane ≥ 1 con almeno una seduta, `Altre sedute` per il gruppo finale (mostrato solo se non vuoto).
- Ordine: gruppi settimana in ordine crescente (Settimana 1, poi 2, ...), `Altre sedute` sempre per ultimo. Dentro ogni gruppo le sedute restano nell'ordine gia' restituito da `listAll()` (piu' recente prima) — nessun nuovo ordinamento.
- Nessuna modifica al modello `Protocol`/`WorkoutSession`.
- Nessun nuovo test dedicato per `HistoryListComponent` (convenzione del progetto: nessun file sotto `src/app/pages/**` ha uno `.spec.ts`); verifica tramite `npx tsc --noEmit -p tsconfig.app.json`, `npx ng test --watch=false`, `npx ng build`.
- `weekNumberForDate` e' logica pura e algoritmica: richiede test TDD dedicati (stessa convenzione gia' seguita per `detectProtocolWeekPlan` in `pdf-import.service.ts`).

---

### Task 1: `weekNumberForDate` su `WorkoutStateService` (TDD)

**Files:**
- Modify: `src/app/services/workout-state.service.ts:97` (inserisci il nuovo metodo tra `recomputeWeek` e `computeAutoWeek`)
- Create: `src/app/services/workout-state.service.spec.ts`

**Interfaces:**
- Consumes: nessuna dipendenza da altri task.
- Produces: `WorkoutStateService.weekNumberForDate(dateISO: string, programStart: string): number` — usato nel Task 2 come `state.weekNumberForDate(session.date, state.DEFAULT_PROGRAM_START)`.

Il costruttore di `WorkoutStateService` chiama `effect(...)` (riga 65 del file attuale), quindi va istanziato con `TestBed.runInInjectionContext(...)` nel test — un `new WorkoutStateService(...)` diretto lancerebbe l'errore Angular NG0203 ("effect() called outside injection context"). Segui esattamente il codice sotto.

- [ ] **Step 1: Scrivi i test falliti in `src/app/services/workout-state.service.spec.ts`**

```ts
import { TestBed } from '@angular/core/testing';
import { WorkoutStateService } from './workout-state.service';

describe('WorkoutStateService.weekNumberForDate', () => {
  let service: WorkoutStateService;

  beforeEach(() => {
    const appStateStub = {} as any;
    const authStub = { authReady: () => false, currentUser: () => null } as any;
    service = TestBed.runInInjectionContext(() =>
      new WorkoutStateService(appStateStub, authStub)
    );
  });

  it("restituisce un numero <= 0 per una data precedente all'inizio del programma", () => {
    expect(service.weekNumberForDate('2026-06-28', '2026-07-05')).toBeLessThanOrEqual(0);
  });

  it('restituisce 1 per il giorno esatto di inizio del programma', () => {
    expect(service.weekNumberForDate('2026-07-05', '2026-07-05')).toBe(1);
  });

  it('resta in settimana 1 al settimo giorno dall\'inizio', () => {
    expect(service.weekNumberForDate('2026-07-11', '2026-07-05')).toBe(1);
  });

  it("passa a settimana 2 all'ottavo giorno dall'inizio", () => {
    expect(service.weekNumberForDate('2026-07-12', '2026-07-05')).toBe(2);
  });

  it('non applica alcun clamp superiore oltre la durata pianificata del protocollo', () => {
    expect(service.weekNumberForDate('2026-09-06', '2026-07-05')).toBe(10);
  });
});
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `npx ng test --watch=false`
Expected: FAIL — `service.weekNumberForDate is not a function` (il metodo non esiste ancora).

- [ ] **Step 3: Aggiungi il metodo in `src/app/services/workout-state.service.ts`**

Inserisci questo metodo subito dopo la chiusura di `recomputeWeek` (dopo la riga `}` alla fine dell'attuale riga 97), prima di `private computeAutoWeek(...)`:

```ts
  /**
   * Numero di settimana del protocollo per una data qualsiasi (non solo oggi),
   * stessa formula di computeAutoWeek ma senza clamp: un risultato <= 0 indica
   * una data precedente all'inizio del programma attuale, un risultato oltre
   * maxWeeks e' legittimo (nessun tetto superiore). Usato per raggruppare lo
   * storico sedute per settimana.
   */
  weekNumberForDate(dateISO: string, programStart: string): number {
    const start = new Date(programStart + 'T00:00:00');
    const date = new Date(dateISO + 'T00:00:00');
    const diffDays = Math.floor((date.getTime() - start.getTime()) / 86400000);
    return Math.floor(diffDays / 7) + 1;
  }
```

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `npx ng test --watch=false`
Expected: PASS — tutti i test in `workout-state.service.spec.ts` verdi (5/5), totale suite invariato piu' 5 nuovi test rispetto a prima di questo task.

- [ ] **Step 5: Verifica compilazione**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx ng build`
Expected: nessun errore.

- [ ] **Step 6: Commit**

```bash
git add src/app/services/workout-state.service.ts src/app/services/workout-state.service.spec.ts
git commit -m "feat: aggiunge weekNumberForDate a WorkoutStateService (TDD)"
```

---

### Task 2: Raggruppamento per settimana in `HistoryListComponent`

**Files:**
- Modify: `src/app/pages/history-list/history-list.component.ts` (intero file)
- Modify: `src/app/pages/history-list/history-list.component.html` (intero file)

**Interfaces:**
- Consumes: `WorkoutStateService.weekNumberForDate(dateISO: string, programStart: string): number` e `WorkoutStateService.DEFAULT_PROGRAM_START: string` (Task 1, gia' pubblico in precedenza).
- Produces: `HistoryListComponent.weekGroups: WeekGroup[]` dove `WeekGroup = { label: string; entries: SessionEntry[] }` e `SessionEntry` include il nuovo campo `weekNumber: number` — usati dal template nello stesso task, nessun consumer esterno.

Nessuno `.spec.ts` da creare per questo task (vedi Global Constraints). Verifica tramite build/tsc e verifica visiva manuale.

- [ ] **Step 1: Sostituisci il contenuto di `src/app/pages/history-list/history-list.component.ts`**

```ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { WorkoutSessionsService } from '../../services/workout-sessions.service';
import { WorkoutStateService } from '../../services/workout-state.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { WorkoutSession } from '../../models/workout.model';

interface SessionEntry {
  key: string;
  session: WorkoutSession;
  displayDate: string;
  completedSets: number;
  weekNumber: number;
}

interface WeekGroup {
  label: string;
  entries: SessionEntry[];
}

@Component({
  selector: 'app-history-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './history-list.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class HistoryListComponent implements OnInit {
  sessions: SessionEntry[] = [];
  weekGroups: WeekGroup[] = [];
  loading = true;
  errorMsg = '';

  constructor(
    private sessionsSvc: WorkoutSessionsService,
    private state: WorkoutStateService,
    private confirm: ConfirmDialogService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadSessions();
  }

  async loadSessions(): Promise<void> {
    this.loading = true;
    this.errorMsg = '';

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 12000)
    );

    try {
      const all = await Promise.race([this.sessionsSvc.listAll(), timeout]);
      this.sessions = all.map(({ id, session }) => {
        const date = new Date(session.date + 'T00:00:00');
        const displayDate = date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        const completedSets = session.exercises.reduce((acc, ex) =>
          acc + ex.sets.filter(s => s.done).length, 0);
        const weekNumber = this.state.weekNumberForDate(session.date, this.state.DEFAULT_PROGRAM_START);
        return { key: id, session, displayDate, completedSets, weekNumber };
      });
      this.weekGroups = this.groupByWeek(this.sessions);
    } catch (e: any) {
      console.error('Errore caricamento storico allenamenti:', e);
      this.errorMsg = e?.message === 'TIMEOUT'
        ? 'La connessione sta impiegando troppo tempo. Controlla la rete e riprova.'
        : 'Errore nel caricamento dello storico. Riprova.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  private groupByWeek(entries: SessionEntry[]): WeekGroup[] {
    const byWeek = new Map<number, SessionEntry[]>();
    const others: SessionEntry[] = [];

    for (const entry of entries) {
      if (entry.weekNumber < 1) {
        others.push(entry);
      } else {
        const list = byWeek.get(entry.weekNumber) ?? [];
        list.push(entry);
        byWeek.set(entry.weekNumber, list);
      }
    }

    const groups: WeekGroup[] = Array.from(byWeek.keys())
      .sort((a, b) => a - b)
      .map(week => ({ label: `Settimana ${week}`, entries: byWeek.get(week)! }));

    if (others.length > 0) {
      groups.push({ label: 'Altre sedute', entries: others });
    }

    return groups;
  }

  goToDetail(key: string): void {
    this.router.navigate(['/scheda/storico', encodeURIComponent(key)]);
  }

  async deleteSession(key: string, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    const confirmed = await this.confirm.confirm('Eliminare questa seduta dallo storico?');
    if (!confirmed) return;
    const ok = await this.sessionsSvc.delete(key);
    if (ok) {
      await this.loadSessions();
    } else {
      this.errorMsg = 'Errore durante l\'eliminazione. Riprova.';
      this.cdr.detectChanges();
    }
  }
}
```

- [ ] **Step 2: Verifica che il file compili da solo**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: nessun errore (il template non e' ancora stato modificato; se Angular segnala che `weekGroups` non e' usato nel template, e' atteso a questo step intermedio — se invece riporta un errore di sintassi TypeScript, correggilo prima di proseguire).

- [ ] **Step 3: Sostituisci il contenuto di `src/app/pages/history-list/history-list.component.html`**

```html
<div *ngIf="loading" class="history-empty">Caricamento…</div>

<div *ngIf="!loading && errorMsg" class="history-empty">
  {{ errorMsg }}<br>
  <button class="savebtn" style="margin-top:12px" (click)="loadSessions()">Riprova</button>
</div>

<div *ngIf="!loading && !errorMsg && sessions.length === 0" class="history-empty">
  Nessuna seduta salvata.<br>Completa il primo allenamento per vedere lo storico qui.
</div>

<ng-container *ngIf="!loading && !errorMsg && sessions.length > 0">
  <ng-container *ngFor="let g of weekGroups">
    <p class="sectiontitle">{{ g.label }}</p>
    <div class="grouplist">
      <div class="daycard press-fx" *ngFor="let s of g.entries" (click)="goToDetail(s.key)">
        <div class="badge" style="font-size:12px">{{ s.session.dayId.replace('day','G') }}</div>
        <div class="info">
          <div class="lbl">{{ s.session.dayLabel }}</div>
          <div class="meta">{{ s.displayDate }} &nbsp;·&nbsp; {{ s.completedSets }} serie</div>
        </div>
        <button class="delete-btn" (click)="deleteSession(s.key, $event)" title="Elimina">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
          </svg>
        </button>
        <span class="chev">›</span>
      </div>
    </div>
  </ng-container>
</ng-container>
```

- [ ] **Step 4: Verifica compilazione completa e test suite invariata**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx ng test --watch=false && npx ng build`
Expected: nessun errore TypeScript/template; la suite di test riporta lo stesso numero di test verdi lasciato dal Task 1 (nessun test tocca `history-list`, quindi il conteggio non deve cambiare rispetto alla fine del Task 1); build completata senza errori.

- [ ] **Step 5: Verifica manuale (dev server)**

Run: `npx ng serve` (o equivalente gia' in uso), poi apri "Storico" (`/scheda/storico`) come utente cliente con sedute salvate:
- Le sedute devono comparire raggruppate sotto titoli "Settimana 1", "Settimana 2", ... in ordine crescente.
- Dentro ogni settimana, le sedute restano ordinate dalla piu' recente alla piu' vecchia (come oggi).
- Se esistono sedute precedenti all'inizio del protocollo attivo (o di un protocollo sostituito), devono comparire in un gruppo "Altre sedute" in fondo, dopo tutte le settimane.
- Se non ci sono sedute "fuori range", il gruppo "Altre sedute" non deve comparire.
- Il click su una seduta e il bottone elimina devono continuare a funzionare esattamente come prima.

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/history-list/history-list.component.ts src/app/pages/history-list/history-list.component.html
git commit -m "feat: divide lo storico sedute per settimana del protocollo"
```

---

## Self-Review Notes

- **Spec coverage:** calcolo settimana senza clamp (Task 1) → coperto con 5 test TDD che includono esplicitamente il caso "nessun clamp superiore". Raggruppamento con etichette "Settimana N"/"Altre sedute", ordine crescente + "Altre sedute" in fondo, ordine invariato dentro ogni gruppo → Task 2 Step 1+3. `computeAutoWeek` non toccato → nessun task lo modifica (verificato: Task 1 inserisce solo un nuovo metodo, non tocca le righe esistenti di `computeAutoWeek`). Nessuna modifica a `Protocol`/`WorkoutSession` → confermato, nessun task tocca `protocol.model.ts`/`workout.model.ts`. Tutto coperto, nessun gap.
- **Placeholder scan:** nessun TBD/TODO; ogni step ha codice completo.
- **Type consistency:** `weekNumberForDate(dateISO: string, programStart: string): number` — stessa firma tra Task 1 (definizione, test) e Task 2 (uso in `loadSessions()`). `SessionEntry`/`WeekGroup` nomi e campi coerenti tra Step 1 e Step 3 del Task 2. `DEFAULT_PROGRAM_START` gia' esistente e pubblico (non ridefinito).
