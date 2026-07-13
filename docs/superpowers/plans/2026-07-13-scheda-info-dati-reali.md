# Scheda Info: dati reali per Storico e Consigli Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire i 2 blocchi statici "Storico e carichi" e "Consigli generali" in `scheda-info.component` (tab Info lato cliente) con contenuto derivato dai dati reali gia' esistenti (storico allenamenti Firestore, esercizi wave del protocollo attivo), senza modificare il modello `Protocol`.

**Architecture:** `SchedaInfoComponent` carica lo storico via `WorkoutSessionsService.listAll()` (gia' esistente, stesso servizio di `HistoryListComponent`) per calcolare un riepilogo (numero allenamenti completati + data ultimo allenamento); un getter `hasWaveExercises` deriva dal `WorkoutDataService.days` gia' caricato se mostrare il consiglio wave-specifico. Nessun nuovo servizio, nessuna nuova collection, nessun nuovo campo dato.

**Tech Stack:** Angular 21 standalone component (zoneless — richiede `ChangeDetectorRef.detectChanges()` dopo il caricamento asincrono), Firestore JS SDK v9 via `WorkoutSessionsService`.

## Global Constraints

- Zero modifiche al modello `Protocol` o a `protocol.model.ts` (confermato nello spec: nessun nuovo campo, nessun rischio dati legacy).
- Nessun nuovo test automatico dedicato per questo task: convenzione gia' seguita nel progetto per componenti pagina (`history-list.component.ts` e ogni altro file in `src/app/pages/**` non ha uno `.spec.ts`). Verifica tramite `npx tsc --noEmit -p tsconfig.app.json`, `npx ng test --watch=false` (deve restare invariato rispetto al conteggio attuale), `npx ng build`.
- Segui esattamente il pattern di caricamento asincrono gia' in uso in `src/app/pages/history-list/history-list.component.ts` (race con timeout 12s, `cdr.detectChanges()` in `finally`, formattazione data con `toLocaleDateString('it-IT', ...)`).
- I consigli dieta estratti dal PDF (`dietNotesSource`, mostrati oggi in "Note dal tuo coach") NON vanno duplicati in "Consigli generali".

---

### Task 1: Storico reale e consiglio wave condizionale in SchedaInfoComponent

**Files:**
- Modify: `src/app/pages/scheda-info/scheda-info.component.ts` (intero file, 24 righe attuali)
- Modify: `src/app/pages/scheda-info/scheda-info.component.html:28-45` (i 2 blocchi statici)

**Interfaces:**
- Consumes: `WorkoutSessionsService.listAll(): Promise<{ id: string; session: WorkoutSession }[]>` (gia' esistente, `src/app/services/workout-sessions.service.ts:69`); `WorkoutSession.date: string` (ISO yyyy-mm-dd, `src/app/models/workout.model.ts:39`); `WorkoutDataService.days: Day[]` (gia' esistente, popolato con il protocollo attivo, `src/app/services/workout-data.service.ts:56`); `Day.ex: Exercise[]` e `Exercise.scheme: 'wave' | 'plain'` (`src/app/models/workout.model.ts:6-22`).
- Produces: `SchedaInfoComponent.loadingHistory: boolean`, `SchedaInfoComponent.totalWorkouts: number`, `SchedaInfoComponent.lastWorkoutDate: string`, `SchedaInfoComponent.hasWaveExercises: boolean` (getter) — usati dal template nello stesso task.

Nessuno `.spec.ts` da creare per questo task (vedi Global Constraints). La verifica e' tramite build/tsc e verifica visiva manuale (vedi Step finale).

- [ ] **Step 1: Sostituisci il contenuto di `scheda-info.component.ts`**

```ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkoutStateService } from '../../services/workout-state.service';
import { WorkoutDataService } from '../../services/workout-data.service';
import { WorkoutSessionsService } from '../../services/workout-sessions.service';

@Component({
  selector: 'app-scheda-info',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scheda-info.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class SchedaInfoComponent implements OnInit {
  readonly currentWeek;
  readonly weekPlan;

  loadingHistory = true;
  totalWorkouts = 0;
  lastWorkoutDate = '';

  constructor(
    public state: WorkoutStateService,
    public workoutData: WorkoutDataService,
    private sessionsSvc: WorkoutSessionsService,
    private cdr: ChangeDetectorRef
  ) {
    this.currentWeek = state.currentWeek;
    this.weekPlan = workoutData.WEEK_PLAN;
  }

  get hasWaveExercises(): boolean {
    return this.workoutData.days.some(d => d.ex.some(e => e.scheme === 'wave'));
  }

  ngOnInit(): void {
    this.loadHistory();
  }

  async loadHistory(): Promise<void> {
    this.loadingHistory = true;

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 12000)
    );

    try {
      const all = await Promise.race([this.sessionsSvc.listAll(), timeout]);
      this.totalWorkouts = all.length;
      if (all.length > 0) {
        const date = new Date(all[0].session.date + 'T00:00:00');
        this.lastWorkoutDate = date.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
      }
    } catch (e) {
      console.error('Errore caricamento storico allenamenti:', e);
    } finally {
      this.loadingHistory = false;
      this.cdr.detectChanges();
    }
  }
}
```

- [ ] **Step 2: Verifica che il file compili da solo**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: nessun errore (il template non e' ancora stato modificato, quindi Angular potrebbe segnalare che `loadingHistory`/`totalWorkouts`/`lastWorkoutDate`/`hasWaveExercises` non sono usati nel template — questo e' atteso a questo step intermedio; se invece riporta un errore di sintassi TypeScript, correggilo prima di proseguire).

- [ ] **Step 3: Sostituisci le righe 28-45 di `scheda-info.component.html`**

Blocco attuale da sostituire (righe 28-45):

```html
  <div class="infocard">
    <h3>Storico e carichi</h3>
    <p>Ogni allenamento completato viene salvato sul tuo account. Nella scheda dettaglio puoi vedere:</p>
    <p>— L'ultimo carico usato per ogni esercizio (suggerito come placeholder)</p>
    <p>— Il grafico sparkline della progressione dei carichi</p>
    <p>— Un suggerimento di carico per gli esercizi wave</p>
  </div>

  <div class="consigli">
    <h3>Consigli generali</h3>
    <ul>
      <li>Recupero tra le serie: segui i tempi indicati (timer automatico)</li>
      <li>Progressione: aumenta il carico quando completi tutte le serie con buona tecnica</li>
      <li>Per gli esercizi wave: aumenta di 2.5–5 kg quando completi tutte le serie</li>
      <li>Bevi almeno 2L di acqua al giorno, di più nei giorni di allenamento</li>
      <li>Assicurati di dormire almeno 7–8 ore per ottimizzare il recupero</li>
    </ul>
  </div>
```

Nuovo blocco (sostituiscilo con questo, stessa posizione):

```html
  <div class="infocard">
    <h3>Storico e carichi</h3>
    <p *ngIf="loadingHistory">Caricamento storico...</p>
    <p *ngIf="!loadingHistory && totalWorkouts === 0">
      Non hai ancora registrato allenamenti. Il tuo storico apparirà qui dopo il primo allenamento completato.
    </p>
    <ng-container *ngIf="!loadingHistory && totalWorkouts > 0">
      <p>Allenamenti completati: <b>{{ totalWorkouts }}</b></p>
      <p>Ultimo allenamento: <b>{{ lastWorkoutDate }}</b></p>
      <p>Nella scheda dettaglio puoi vedere, per ogni esercizio: l'ultimo carico usato, il grafico della progressione e un suggerimento di carico per gli esercizi wave.</p>
    </ng-container>
  </div>

  <div class="consigli">
    <h3>Consigli generali</h3>
    <ul>
      <li>Recupero tra le serie: segui i tempi indicati (timer automatico)</li>
      <li>Progressione: aumenta il carico quando completi tutte le serie con buona tecnica</li>
      <li *ngIf="hasWaveExercises">Per gli esercizi wave: aumenta di 2.5–5 kg quando completi tutte le serie</li>
      <li>Bevi almeno 2L di acqua al giorno, di più nei giorni di allenamento</li>
      <li>Assicurati di dormire almeno 7–8 ore per ottimizzare il recupero</li>
    </ul>
  </div>
```

- [ ] **Step 4: Verifica compilazione completa e test suite invariata**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx ng test --watch=false && npx ng build`
Expected: nessun errore TypeScript/template; la suite di test riporta lo stesso numero di test verdi di prima di questa modifica (nessun test esistente tocca `scheda-info`, quindi il conteggio non deve cambiare); build completata senza errori.

- [ ] **Step 5: Verifica manuale (dev server)**

Run: `npx ng serve` (o equivalente gia' in uso nel progetto), poi apri la tab "Info" della scheda come utente cliente con un protocollo attivo:
- Se il cliente ha gia' storico allenamenti salvato: la card "Storico e carichi" deve mostrare il conteggio reale e la data dell'ultimo allenamento (non piu' il testo descrittivo generico).
- Se il cliente non ha storico: deve apparire il messaggio di stato vuoto.
- Se il protocollo attivo NON ha esercizi con `scheme: 'wave'`: il consiglio "Per gli esercizi wave..." non deve comparire nella lista "Consigli generali".
- Se il protocollo attivo HA esercizi wave: il consiglio deve comparire come prima.
- La card "Note dal tuo coach" deve restare invariata (nessuna duplicazione di `dietNotesSource`).

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/scheda-info/scheda-info.component.ts src/app/pages/scheda-info/scheda-info.component.html
git commit -m "feat: storico e consigli generali da dati reali nella tab Info"
```

---

## Self-Review Notes

- **Spec coverage:** "Storico e carichi" (riepilogo calcolato) → Task 1 Step 1+3. "Consigli generali" condizionale wave → Task 1 Step 1+3. Nessuna duplicazione `dietNotesSource` → verificato in Step 5 (il blocco "Note dal tuo coach" non viene toccato). Nessuna modifica al modello `Protocol` → confermato, nessun task tocca `protocol.model.ts`. Tutto coperto, nessun gap.
- **Placeholder scan:** nessun TBD/TODO; ogni step ha codice completo.
- **Type consistency:** `hasWaveExercises` (getter, non un campo assegnato) usato in modo coerente nel `.ts` e nel template; `totalWorkouts`/`lastWorkoutDate`/`loadingHistory` nomi coerenti tra Step 1 e Step 3; `WorkoutSession.date`/`Day.ex`/`Exercise.scheme` usati con gli stessi nomi del modello esistente.
