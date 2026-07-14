# Edit Storico Seduta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettere di modificare data, ripetizioni, carico e spuntato di una seduta gia' salvata nello storico allenamenti, senza poter aggiungere/rimuovere esercizi o serie.

**Architecture:** Nuovo metodo `WorkoutSessionsService.moveSession()` che rispecchia `MeasurementDataService.moveCategoryEntry` (stesso id `${dayId}_${isoDate}`, stessa dance atomica `writeBatch` set+delete quando la data cambia, stesso controllo di collisione, stesso tipo di ritorno `'ok'|'collision'|'error'`). `HistoryDetailComponent` guadagna una modalita' `editMode` che lavora su un clone (`structuredClone`) della sessione caricata, con input inline (stessi `rip-input`/`load-input`/`set-check` gia' usati nella scheda allenamento live) e un campo data (stesso pattern `<input type="date">` + `[max]` gia' usato in `misura-categoria.component.html`). Nessuna nuova route: tutto avviene nella stessa pagina `/scheda/storico/:key`.

**Tech Stack:** Angular standalone components, `FormsModule`/`ngModel`, Firebase JS SDK v9 modular (`firebase/firestore`), Vitest.

## Global Constraints

- **Nessuna modifica al modello `WorkoutSession`** (`src/app/models/workout.model.ts`) — nessun nuovo campo.
- **Nessuna possibilita' di aggiungere/rimuovere serie o esercizi** dalla seduta storica — solo i valori di `reps`/`load`/`done` delle serie gia' esistenti, e la `date`.
- **`WorkoutSessionsService.save()`/`get()`/`delete()`/`listAll()`/`listForDay()` restano invariati** — `moveSession()` e' un metodo aggiuntivo, non li sostituisce.
- **Il nuovo file di test `workout-sessions.service.spec.ts` DEVE includere `initializeFirestore: () => ({}) as any` nel suo mock di `firebase/firestore`**, esattamente come gia' fatto in `measurement-data.service.spec.ts` — il builder Vitest di questo progetto condivide moduli tra file di test (`test.isolate:false`), quindi un mock incompleto di `firebase/firestore` in un nuovo file puo' far crashare `FirebaseService` in un ALTRO file di test che finisce nello stesso worker (bug reale gia' successo e risolto in questo stesso progetto — vedi commit `da73368`). Non omettere questo stub per nessun motivo.
- **`moveSession()` deve rispecchiare esattamente la struttura di `MeasurementDataService.moveCategoryEntry`** (`src/app/services/measurement-data.service.ts:124-168`): stessa gestione try/catch con `console.error` + return `'error'`, stesso controllo "stessa data -> aggiorna in place" prima di controllare collisioni, stesso `writeBatch` per l'operazione atomica set+delete quando la data cambia.
- **Nessun nuovo test automatico per `HistoryDetailComponent`** (lavoro di UI/form, stessa convenzione gia' seguita per il resto dei componenti pagina di questo progetto — nessun file sotto `src/app/pages/**` ha uno `.spec.ts` dedicato alla presentazione).
- **Zoneless app**: `detectChanges()` va chiamato solo dopo il completamento di operazioni asincrone (stesso pattern gia' in uso in `deleteSession()` — vedi sotto), MAI dentro handler sincroni tipo `(click)` che mutano solo stato locale (stesso pattern gia' in uso in `toggleEx()`, che non chiama `detectChanges()`).
- **Il navigare a `/scheda/storico/:key` con un `:key` diverso mentre si e' gia' su quella route NON ricrea il componente** (Angular riusa l'istanza per lo stesso path di route) — per questo `ngOnInit` deve sottoscrivere `route.paramMap` invece di leggere `route.snapshot.paramMap` una sola volta, esattamente come gia' fa `MisuraCategoriaComponent.ngOnInit()` (`src/app/pages/misura-categoria/misura-categoria.component.ts:44-55`) per lo stesso identico motivo.
- **La classe CSS `.savebar` NON va modificata nella sua forma base** (usata con un solo bottone in molte altre pagine: `misura-categoria`, `dieta-detail`, ecc.) — il layout a due bottoni affiancati va aggiunto SOLO tramite una nuova classe modificatore `.savebar.dual`, applicata staticamente nel template di `HistoryDetailComponent` (non condizionale, dato che in questa pagina il savebar ha sempre 2 bottoni: Modifica+Elimina oppure Annulla+Salva).
- Verifica per Task 1: `npx tsc --noEmit -p tsconfig.app.json && npx ng test --watch=false` (deve aggiungere test verdi, nessuno rosso). Verifica per Task 2: `npx tsc --noEmit -p tsconfig.app.json && npx ng test --watch=false` (conteggio dei test di Task 1 invariato) `&& npx ng build`.
- Cercare le stringhe esatte indicate in ogni step, non affidarsi ciecamente ai numeri di riga se sono gia' scalati da un edit precedente nello stesso file.

---

### Task 1: `WorkoutSessionsService.moveSession()` (TDD)

**Files:**
- Modify: `src/app/services/workout-sessions.service.ts`
- Create: `src/app/services/workout-sessions.service.spec.ts`

**Interfaces:**
- Consumes: nessuna (usa gia' `sanitizeForFirestore` gia' importato nel file, e `writeBatch` da aggiungere all'import esistente di `firebase/firestore`).
- Produces: `WorkoutSessionsService.moveSession(session: WorkoutSession, oldId: string, newDate: string): Promise<'ok' | 'collision' | 'error'>` — consumato da Task 2.

- [ ] **Step 1: Scrivi il test che fallisce — stessa data, aggiorna in place**

Crea `src/app/services/workout-sessions.service.spec.ts`:

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockDocs = new Map<string, any>();

vi.mock('firebase/firestore', () => ({
  // Stubbed so this mock stays harmless if it leaks into another spec file (isolate: false shares modules across files) that constructs the real FirebaseService.
  initializeFirestore: () => ({}) as any,
  collection: (_db: any, ...segments: string[]) => ({ path: segments.join('/') }),
  doc: (_col: any, id: string) => ({ id }),
  getDoc: async (ref: { id: string }) => {
    const data = mockDocs.get(ref.id);
    return { exists: () => data !== undefined, data: () => data };
  },
  getDocs: async () => ({
    docs: Array.from(mockDocs.entries()).map(([id, data]) => ({ id, data: () => data }))
  }),
  setDoc: async (ref: { id: string }, data: any) => {
    mockDocs.set(ref.id, data);
  },
  deleteDoc: async (ref: { id: string }) => {
    mockDocs.delete(ref.id);
  },
  query: (col: any) => col,
  where: () => ({}),
  writeBatch: (_db: any) => {
    const ops: (() => void)[] = [];
    return {
      set: (ref: { id: string }, data: any) => {
        ops.push(() => { mockDocs.set(ref.id, data); });
      },
      delete: (ref: { id: string }) => {
        ops.push(() => { mockDocs.delete(ref.id); });
      },
      commit: async () => { ops.forEach(op => op()); }
    };
  }
}));

import { WorkoutSessionsService } from './workout-sessions.service';
import { WorkoutSession } from '../models/workout.model';

describe('WorkoutSessionsService.moveSession', () => {
  let service: WorkoutSessionsService;

  const baseSession: WorkoutSession = {
    dayId: 'day1',
    dayLabel: 'Giorno ON',
    date: '2026-07-01',
    exercises: [{ name: 'Squat', sets: [{ load: '100', reps: '8', done: true }] }]
  };

  beforeEach(() => {
    mockDocs.clear();
    const fbStub = { db: {} } as any;
    const authStub = { currentUser: () => ({ uid: 'u1' }) } as any;
    const zoneFixStub = { run: (p: Promise<any>) => p } as any;
    service = new WorkoutSessionsService(fbStub, authStub, zoneFixStub);
  });

  it('con la stessa data, aggiorna il documento esistente senza cambiare id', async () => {
    mockDocs.set('day1_2026-07-01', { ...baseSession });

    const result = await service.moveSession(baseSession, 'day1_2026-07-01', '2026-07-01');

    expect(result).toBe('ok');
    expect(mockDocs.get('day1_2026-07-01')).toMatchObject({ date: '2026-07-01', dayId: 'day1' });
    expect(mockDocs.has('day1_2026-07-05')).toBe(false);
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npx ng test --watch=false 2>&1 | grep -A 20 "workout-sessions"`
Expected: FAIL — `WorkoutSessionsService.moveSession` non esiste ancora (`service.moveSession is not a function` o errore TypeScript equivalente).

- [ ] **Step 3: Aggiungi `writeBatch` all'import esistente**

Trova questa riga in `src/app/services/workout-sessions.service.ts`:

```typescript
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
```

Sostituiscila con:

```typescript
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch
} from 'firebase/firestore';
```

- [ ] **Step 4: Implementa `moveSession()` (minimo per far passare il test)**

Trova questa riga (fine del metodo `delete()`, prima di `listAll()`):

```typescript
  delete(id: string): Promise<boolean> {
    return this.zoneFix.run((async () => {
      try {
        await deleteDoc(doc(this.col(), id));
        return true;
      } catch (e) {
        console.error('Errore eliminazione sessione allenamento:', e);
        return false;
      }
    })());
  }

  /** Tutte le sessioni salvate (storico completo), piu' recenti prima. */
```

Sostituiscila con (aggiunto `moveSession` tra `delete()` e `listAll()`):

```typescript
  delete(id: string): Promise<boolean> {
    return this.zoneFix.run((async () => {
      try {
        await deleteDoc(doc(this.col(), id));
        return true;
      } catch (e) {
        console.error('Errore eliminazione sessione allenamento:', e);
        return false;
      }
    })());
  }

  /**
   * Sposta/aggiorna una sessione gia' salvata. Se la data non cambia, aggiorna
   * il documento esistente in place. Se la data cambia, l'id cambia (id =
   * `${dayId}_${isoDate}`): scrive il nuovo documento e cancella quello vecchio
   * in un'unica writeBatch atomica, dopo aver verificato che la data di
   * destinazione non abbia gia' una seduta salvata per lo stesso dayId.
   */
  moveSession(session: WorkoutSession, oldId: string, newDate: string): Promise<'ok' | 'collision' | 'error'> {
    return this.zoneFix.run((async () => {
      try {
        const newId = this.sessionId(session.dayId, newDate);
        const data = sanitizeForFirestore({ ...session, date: newDate });

        if (newId === oldId) {
          await setDoc(doc(this.col(), oldId), data);
          return 'ok';
        }

        const targetSnap = await getDoc(doc(this.col(), newId));
        if (targetSnap.exists()) return 'collision';

        const batch = writeBatch(this.fb.db);
        batch.set(doc(this.col(), newId), data);
        batch.delete(doc(this.col(), oldId));
        await batch.commit();
        return 'ok';
      } catch (e) {
        console.error('Errore spostamento seduta:', e);
        return 'error';
      }
    })());
  }

  /** Tutte le sessioni salvate (storico completo), piu' recenti prima. */
```

- [ ] **Step 5: Esegui il test e verifica che passi**

Run: `npx ng test --watch=false 2>&1 | grep -A 20 "workout-sessions"`
Expected: PASS — il test dello Step 1 e' verde.

- [ ] **Step 6: Aggiungi il test — data diversa senza collisione**

Aggiungi questo test dentro lo stesso blocco `describe`, dopo il test dello Step 1:

```typescript
  it('con una data diversa senza collisione, scrive il nuovo documento ed elimina quello vecchio', async () => {
    mockDocs.set('day1_2026-07-01', { ...baseSession });

    const result = await service.moveSession(baseSession, 'day1_2026-07-01', '2026-07-05');

    expect(result).toBe('ok');
    expect(mockDocs.get('day1_2026-07-05')).toMatchObject({ date: '2026-07-05', dayId: 'day1' });
    expect(mockDocs.has('day1_2026-07-01')).toBe(false);
  });
```

Run: `npx ng test --watch=false 2>&1 | grep -A 20 "workout-sessions"`
Expected: PASS — l'implementazione dello Step 4 gia' gestisce questo caso.

- [ ] **Step 7: Aggiungi il test — collisione sulla data di destinazione**

Aggiungi questo test dopo quello dello Step 6:

```typescript
  it('blocca lo spostamento se esiste gia\' una seduta nella data di destinazione, senza scrivere ne\' cancellare nulla', async () => {
    mockDocs.set('day1_2026-07-01', { ...baseSession });
    mockDocs.set('day1_2026-07-05', { ...baseSession, date: '2026-07-05', exercises: [] });

    const result = await service.moveSession(baseSession, 'day1_2026-07-01', '2026-07-05');

    expect(result).toBe('collision');
    expect(mockDocs.get('day1_2026-07-01')).toMatchObject({ date: '2026-07-01' });
    expect(mockDocs.get('day1_2026-07-05')).toMatchObject({ exercises: [] });
  });
```

Run: `npx ng test --watch=false 2>&1 | grep -A 20 "workout-sessions"`
Expected: PASS — 3/3 test verdi in questo file.

- [ ] **Step 8: Verifica compilazione e suite completa**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx ng test --watch=false`
Expected: nessun errore TypeScript; suite totale verde con 3 nuovi test rispetto al totale precedente (nessun test preesistente rosso).

- [ ] **Step 9: Commit**

```bash
git add src/app/services/workout-sessions.service.ts src/app/services/workout-sessions.service.spec.ts
git commit -m "feat: aggiunge WorkoutSessionsService.moveSession per modificare data/valori di una seduta storica (TDD)"
```

---

### Task 2: Modalita' modifica in `HistoryDetailComponent`

**Files:**
- Modify: `src/app/pages/history-detail/history-detail.component.ts`
- Modify: `src/app/pages/history-detail/history-detail.component.html`
- Modify: `src/styles.css` (3 nuove regole, elencate sotto)

**Interfaces:**
- Consumes: `WorkoutSessionsService.moveSession(session: WorkoutSession, oldId: string, newDate: string): Promise<'ok' | 'collision' | 'error'>` (Task 1) e `WorkoutSessionsService.sessionId(dayId: string, isoDate: string): string` (gia' esistente).
- Produces: nessuna nuova interfaccia — solo componente pagina, nessun altro file lo consuma.

Nessuno `.spec.ts` da creare per questo task (vedi Global Constraints).

- [ ] **Step 1: Sostituisci l'intero contenuto di `history-detail.component.ts`**

Motivo: `ngOnInit` deve passare da lettura one-shot di `route.snapshot.paramMap` a una sottoscrizione di `route.paramMap` (necessario perche' dopo un cambio data si naviga sulla stessa route con un `:key` diverso, e Angular riusa l'istanza del componente — vedi Global Constraints), quindi la maggior parte del file cambia struttura. Sostituisci l'intero file con:

```typescript
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { WorkoutSessionsService } from '../../services/workout-sessions.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { WorkoutSession } from '../../models/workout.model';
import { WorkoutDataService } from '../../services/workout-data.service';
import { todayLocalISO } from '../../core/utils/date.util';

@Component({
  selector: 'app-history-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './history-detail.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class HistoryDetailComponent implements OnInit, OnDestroy {
  session: WorkoutSession | null = null;
  displayDate = '';
  key = '';
  openExercises: boolean[] = [];
  loading = true;
  errorMsg = '';

  editMode = false;
  editSession: WorkoutSession | null = null;
  editDate = '';
  maxDate = todayLocalISO();

  private paramSub: Subscription | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private sessionsSvc: WorkoutSessionsService,
    private confirm: ConfirmDialogService,
    public workoutData: WorkoutDataService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) {}

  getMuscleIcon(name: string): SafeHtml {
    const muscle = this.getMuscle(name);
    return this.sanitizer.bypassSecurityTrustHtml(
      this.workoutData.MUSCLE_ICONS[muscle] ?? this.workoutData.MUSCLE_ICONS['Core']
    );
  }

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

  async load(): Promise<void> {
    this.loading = true;
    this.errorMsg = '';

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 12000)
    );

    try {
      this.session = await Promise.race([this.sessionsSvc.get(this.key), timeout]);
      if (this.session) {
        this.setDisplayDate(this.session.date);
        this.openExercises = this.session.exercises.map(() => true);
      }
    } catch (e: any) {
      console.error('Errore caricamento seduta:', e);
      this.errorMsg = e?.message === 'TIMEOUT'
        ? 'La connessione sta impiegando troppo tempo. Controlla la rete e riprova.'
        : 'Errore nel caricamento della seduta. Riprova.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  private setDisplayDate(isoDate: string): void {
    const date = new Date(isoDate + 'T00:00:00');
    this.displayDate = date.toLocaleDateString('it-IT', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  toggleEx(i: number): void {
    this.openExercises[i] = !this.openExercises[i];
  }

  getMuscleInfo(name: string) {
    const day = this.workoutData.days.find(d => d.id === this.session?.dayId);
    const ex = day?.ex.find(e => e.name === name);
    if (!ex) return { color: '#64D2FF', dim: 'rgba(100,210,255,0.16)' };
    return this.workoutData.MUSCLES[ex.muscle] ?? { color: '#64D2FF', dim: 'rgba(100,210,255,0.16)' };
  }

  getMuscle(name: string): string {
    const day = this.workoutData.days.find(d => d.id === this.session?.dayId);
    return day?.ex.find(e => e.name === name)?.muscle ?? '';
  }

  async deleteSession(): Promise<void> {
    const confirmed = await this.confirm.confirm('Eliminare questa seduta dallo storico?');
    if (!confirmed) return;
    const ok = await this.sessionsSvc.delete(this.key);
    if (ok) {
      this.router.navigate(['/scheda/storico']);
    } else {
      this.errorMsg = 'Errore durante l\'eliminazione. Riprova.';
      this.cdr.detectChanges();
    }
  }

  getDoneCount(sets: { done: boolean }[]): number {
    return sets.filter(s => s.done).length;
  }

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

  getEditSet(exIdx: number, setIdx: number): { load: string | null; reps: string | null; done: boolean } {
    return this.editSession!.exercises[exIdx].sets[setIdx];
  }

  toggleSetDone(exIdx: number, setIdx: number): void {
    const s = this.getEditSet(exIdx, setIdx);
    s.done = !s.done;
  }

  async saveEdit(): Promise<void> {
    if (!this.editSession) return;
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
    } else if (result === 'collision') {
      this.errorMsg = 'Esiste gia\' una seduta per questo giorno di allenamento in questa data.';
      this.cdr.detectChanges();
    } else {
      this.errorMsg = 'Errore durante il salvataggio. Riprova.';
      this.cdr.detectChanges();
    }
  }
}
```

- [ ] **Step 2: Sostituisci l'intero contenuto di `history-detail.component.html`**

```html
<div *ngIf="loading" class="history-empty">Caricamento…</div>

<div *ngIf="!loading && errorMsg && !session" class="history-empty">
  {{ errorMsg }}<br>
  <button class="savebtn" style="margin-top:12px" (click)="load()">Riprova</button>
</div>

<div *ngIf="!loading && !errorMsg && !session" class="history-empty">Seduta non trovata.</div>

<ng-container *ngIf="!loading && session">
  <div class="infocard" *ngIf="editMode">
    <div class="measure-field">
      <label>Data</label>
      <div class="measure-input-wrap">
        <input type="date" [(ngModel)]="editDate" [max]="maxDate" />
      </div>
    </div>
  </div>

  <div class="daymeta">
    <span>{{ session.dayLabel }}</span>
    <span class="rec">{{ displayDate }}</span>
  </div>

  <p class="autherror" *ngIf="errorMsg && session">{{ errorMsg }}</p>

  <div class="exlist">
    <div class="ex readonly" *ngFor="let ex of session.exercises; let i = index"
         [class.open]="openExercises[i]">

      <div class="ex-summary" (click)="toggleEx(i)">
        <div class="ex-icon ex-num"
          [style.background]="getMuscleInfo(ex.name).dim"
          [style.color]="getMuscleInfo(ex.name).color"
          [style.border-color]="getMuscleInfo(ex.name).color + '30'">
          {{ i + 1 }}
        </div>
        <div class="ex-info">
          <div class="ex-name">{{ ex.name }}</div>
          <span class="ex-muscle" [style.background]="getMuscleInfo(ex.name).color">
            {{ getMuscle(ex.name) }}
          </span>
        </div>
        <div class="ex-meta">
          <span class="ex-counter" [class.complete]="getDoneCount(ex.sets) === ex.sets.length">
            {{ getDoneCount(ex.sets) }}/{{ ex.sets.length }}
          </span>
          <span class="ex-chevron">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          </span>
        </div>
      </div>

      <div class="content-inner" *ngIf="openExercises[i]">
        <div class="settable-head">
          <span>Serie</span><span>Rip.</span><span>Carico</span><span style="text-align:center">✓</span>
        </div>
        <div class="settable-row" *ngFor="let s of ex.sets; let j = index">
          <div class="serie-badge">{{ j + 1 }}</div>

          <ng-container *ngIf="!editMode">
            <div class="ro-value">{{ s.reps ?? '—' }}</div>
            <div class="ro-value">{{ s.load ? s.load + ' kg' : '—' }}</div>
            <div class="set-check" [class.done]="s.done">✓</div>
          </ng-container>

          <ng-container *ngIf="editMode">
            <input class="rip-input" type="text" inputmode="decimal"
              [(ngModel)]="getEditSet(i, j).reps" />
            <input class="load-input" type="text" inputmode="decimal"
              [(ngModel)]="getEditSet(i, j).load" />
            <div class="set-check" [class.done]="getEditSet(i, j).done"
              (click)="toggleSetDone(i, j)">✓</div>
          </ng-container>
        </div>
      </div>
    </div>
  </div>

  <div class="savebar dual">
    <ng-container *ngIf="!editMode">
      <button class="savebtn cancel" (click)="enterEditMode()">Modifica</button>
      <button class="savebtn delete-session-btn" (click)="deleteSession()">Elimina questa seduta</button>
    </ng-container>
    <ng-container *ngIf="editMode">
      <button class="savebtn cancel" (click)="cancelEdit()">Annulla</button>
      <button class="savebtn" (click)="saveEdit()">Salva</button>
    </ng-container>
  </div>
</ng-container>
```

- [ ] **Step 3: Aggiungi le 3 regole CSS per il layout a due bottoni e il bottone neutro**

Trova questa riga in `src/styles.css`:

```css
.savebar{margin-top:16px;}
```

Sostituiscila con:

```css
.savebar{margin-top:16px;}
.savebar.dual{display:flex;gap:10px;}
.savebar.dual .savebtn{width:auto;flex:1;}
.savebtn.cancel{background:rgba(255,255,255,0.07);color:var(--label);box-shadow:none;}
```

- [ ] **Step 4: Verifica compilazione, test invariati e build**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx ng test --watch=false && npx ng build`
Expected: nessun errore; stesso numero di test verdi di dopo il Task 1 (nessun test copre `HistoryDetailComponent`, vedi Global Constraints); build completata senza errori.

- [ ] **Step 5: Verifica manuale (dev server)**

Run: `npx ng serve` (o equivalente gia' in uso), poi apri una seduta dallo storico allenamenti (`/scheda/storico/:key`):
- In sola lettura, la savebar mostra due bottoni affiancati: "Modifica" (neutro) ed "Elimina questa seduta" (rosso), invece del solo bottone "Elimina" di prima.
- Cliccando "Modifica": appare il campo data in cima (con `[max]` a oggi), ogni riga serie mostra input modificabili per ripetizioni/carico e il pallino spuntato/non spuntato diventa cliccabile; la savebar mostra "Annulla"/"Salva".
- "Annulla" scarta le modifiche (nessuna chiamata di rete) e torna alla vista sola-lettura con i valori originali invariati.
- "Salva" con la stessa data: aggiorna i valori e torna alla vista sola-lettura sulla stessa URL, senza refresh di pagina.
- "Salva" con una data diversa e nessuna collisione: la pagina naviga al nuovo URL (`/scheda/storico/:nuovoKey`) e mostra la seduta con la nuova data.
- "Salva" con una data diversa che collide con una seduta gia' esistente per lo stesso giorno di allenamento: appare un messaggio di errore, resta in `editMode`, nessun dato viene scritto ne' cancellato (verificabile ricaricando lo storico: la seduta originale e' ancora al suo posto).
- Nessuna possibilita' di aggiungere/rimuovere serie o esercizi in nessun momento.
- La vista lista storico (`/scheda/storico`) e le altre pagine che usano `.savebar` con un solo bottone (es. Misure, Dieta) restano visivamente invariate.

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/history-detail/history-detail.component.ts src/app/pages/history-detail/history-detail.component.html src/styles.css
git commit -m "feat: modalita' modifica per data/valori di una seduta nello storico allenamenti"
```

---

## Self-Review Notes

- **Spec coverage:** modifica inline nella stessa pagina, nessuna nuova route → Task 2, nessuna route aggiunta. Campo data + `[max]` a oggi, stesso pattern di `misura-categoria` → Step 2/Task 2. Stessi input `rip-input`/`load-input`/`set-check` della scheda live → Step 2/Task 2. Bottoni Modifica/Elimina ↔ Salva/Annulla → Step 2/Task 2. "Annulla" senza chiamate di rete → `cancelEdit()` in Step 1/Task 2 non chiama nessun servizio. Clone semplice della sessione → `structuredClone` in `enterEditMode()`. `moveSession` con stessa forma di `moveCategoryEntry` (id deterministico, `writeBatch` atomico, collisione, ritorno ok/collision/error) → Task 1 per intero. Navigazione al nuovo URL dopo cambio data riuscito, restare sulla pagina se la data non e' cambiata → `saveEdit()` in Step 1/Task 2. Nessuna modifica al modello, a `save()`/`get()`/`delete()`, ne' possibilita' di aggiungere/rimuovere serie/esercizi → rispettato ovunque, nessuno step li tocca. Test TDD per `moveSession` con i 3 casi (stessa data, data diversa senza collisione, collisione) → Step 1/6/7 di Task 1. Nessun test automatico per `HistoryDetailComponent` → rispettato, Task 2 non crea `.spec.ts`. Tutto coperto, nessun gap rispetto allo spec.
- **Placeholder scan:** nessun TBD/TODO; ogni step ha codice completo ed esatto (incluso il contenuto completo dei due file `.ts`/`.html` di Task 2, dato che la ristrutturazione di `ngOnInit` tocca la maggior parte del file).
- **Type consistency:** `moveSession(session: WorkoutSession, oldId: string, newDate: string): Promise<'ok' | 'collision' | 'error'>` e' la stessa identica firma sia nella dichiarazione di Task 1 sia nella chiamata da `saveEdit()` in Task 2. `getEditSet()` ritorna lo stesso tipo inline `{ load: string | null; reps: string | null; done: boolean }` gia' usato in `WorkoutSession.exercises[].sets[]` (`workout.model.ts:42`). `sessionId(dayId: string, isoDate: string): string` (gia' esistente, non modificato) e' la stessa firma usata sia dentro `moveSession` sia dentro `saveEdit()` per calcolare `newId`.
