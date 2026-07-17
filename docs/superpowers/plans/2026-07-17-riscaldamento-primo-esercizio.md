# Riscaldamento Primo Esercizio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire la nota testuale del primo esercizio di ogni giorno con un suggerimento di riscaldamento a 3 serie calcolato sul peso massimo dell'ultima sessione per quell'esercizio.

**Architecture:** Estensione dell'interfaccia locale `ExerciseVM` di `SchedaDetailComponent` con 2 nuovi campi presentazionali (`isFirst`, `warmup`), valorizzati in `buildExercises()`/`loadInsights()` riusando dati gia' calcolati (`maxLoads`). Nessun nuovo servizio, nessuna modifica al modello dati condiviso.

**Tech Stack:** Angular 21 standalone component, TypeScript, Vitest (`npx ng test --watch=false`).

## Global Constraints

- Si applica SOLO all'esercizio con indice 0 nell'array `this.day.ex` (il primo esercizio del giorno). Tutti gli altri esercizi non cambiano comportamento.
- Riusa `maxLoads[maxLoads.length - 1]` gia' calcolato in `loadInsights()` — nessuna nuova query allo storico.
- 3 serie: 40% × 8 rip., 50% × 5 rip., 60% × 3 rip. del peso massimo dell'ultima sessione, ciascun carico arrotondato ai 5 kg piu' vicini (`Math.round(kg/5)*5`).
- Se non esiste storico per il primo esercizio (`maxLoads.length === 0`), non viene mostrato ne' il riscaldamento ne' la nota — nessuna delle due, per quell'esercizio.
- Per gli esercizi diversi dal primo, la nota (`vm.ex.note`) continua a comparire esattamente come oggi.
- Il blocco `ex-insights` (Ultimo/Progressione/Prova X kg) sotto la tabella serie non viene toccato in nessun modo.
- Testo esatto del riscaldamento (con tag `<b>`, stesso pattern di `insight.suggestion`): `` Riscaldamento: <b>{{w1}} kg</b> x8, <b>{{w2}} kg</b> x5, <b>{{w3}} kg</b> x3 `` dove `w1`/`w2`/`w3` sono i 3 carichi arrotondati (40%/50%/60%).

---

### Task 1: `isFirst`/`warmup` su `ExerciseVM` + template

**Files:**
- Modify: `src/app/pages/scheda-detail/scheda-detail.component.ts:24-31` (interfaccia `ExerciseVM`), `:124-140` (`buildExercises()`), `:170-235` (`loadInsights()`)
- Modify: `src/app/pages/scheda-detail/scheda-detail.component.html:9` (nota → nota condizionale + riscaldamento)

**Interfaces:**
- Produces: `ExerciseVM.isFirst: boolean`, `ExerciseVM.warmup: string | null` — consumati solo dal template di questo stesso componente, nessun altro file li legge.

Nessun nuovo `.spec.ts` (nessun test esistente per questo componente in questo progetto — stessa convenzione gia' seguita per le altre modifiche a `scheda-detail.component.ts` in questa codebase; verifica tramite `tsc`/`ng test`/`ng build` + verifica manuale, vedi Global Constraints).

- [ ] **Step 1: Aggiungi i 2 campi a `ExerciseVM`**

L'interfaccia attuale (righe 24-31):

```ts
interface ExerciseVM {
  ex: Exercise;
  rows: SerieRow[];
  open: boolean;
  insightVisible: boolean;
  insight: ExInsight | null;
  restSeconds: number;
}
```

diventa:

```ts
interface ExerciseVM {
  ex: Exercise;
  rows: SerieRow[];
  open: boolean;
  insightVisible: boolean;
  insight: ExInsight | null;
  restSeconds: number;
  isFirst: boolean;
  warmup: string | null;
}
```

- [ ] **Step 2: Valorizza `isFirst` in `buildExercises()`**

Il metodo attuale (righe 124-140):

```ts
  private buildExercises(restOverrides: Record<string, number>): void {
    const week = this.state.currentWeek;
    const protocolDefault = this.parseRecSeconds(this.day.rec);
    this.exercises = this.day.ex.map(ex => {
      const { sets, reps } = this.workoutData.getExSetsReps(ex, week);
      const rows: SerieRow[] = Array.from({ length: sets }, (_, i) => ({
        reps: String(reps[i] ?? ''),
        load: '',
        done: false,
        ripPlaceholder: String(reps[i] ?? ''),
        loadPlaceholder: ''
      }));
      const override = restOverrides[this.restKey(ex.name)];
      const restSeconds = override && override > 0 ? override : protocolDefault;
      return { ex, rows, open: true, insightVisible: false, insight: null, restSeconds };
    });
  }
```

diventa (uniche righe nuove: `(ex, exIdx)` nel `.map`, e `isFirst`/`warmup` nel valore restituito):

```ts
  private buildExercises(restOverrides: Record<string, number>): void {
    const week = this.state.currentWeek;
    const protocolDefault = this.parseRecSeconds(this.day.rec);
    this.exercises = this.day.ex.map((ex, exIdx) => {
      const { sets, reps } = this.workoutData.getExSetsReps(ex, week);
      const rows: SerieRow[] = Array.from({ length: sets }, (_, i) => ({
        reps: String(reps[i] ?? ''),
        load: '',
        done: false,
        ripPlaceholder: String(reps[i] ?? ''),
        loadPlaceholder: ''
      }));
      const override = restOverrides[this.restKey(ex.name)];
      const restSeconds = override && override > 0 ? override : protocolDefault;
      return { ex, rows, open: true, insightVisible: false, insight: null, restSeconds, isFirst: exIdx === 0, warmup: null };
    });
  }
```

- [ ] **Step 3: Calcola `warmup` in `loadInsights()`**

Il metodo attuale (righe 170-235) itera con `this.exercises.forEach((vm) => {...})`. La riga di apertura del forEach:

```ts
    this.exercises.forEach((vm) => {
      const exName = vm.ex.name;

      // Collect max loads per session for this exercise
      const maxLoads: number[] = [];
```

resta invariata (non serve l'indice qui: `vm.isFirst` e' gia' stato impostato in `buildExercises()`).

Subito PRIMA della chiusura del forEach — cioe' subito dopo il blocco esistente:

```ts
      let suggestion: string | null = null;
      if (vm.ex.scheme === 'wave' && maxLoads.length > 0) {
        const lastMax = maxLoads[maxLoads.length - 1];
        const suggested = lastMax + 2.5;
        suggestion = `Prova <b>${suggested} kg</b> — +2.5 kg rispetto all'ultima volta`;
      }

      if (lastText || sparkSvg || suggestion) {
        vm.insight = { lastText, sparkSvg, delta, deltaClass, suggestion };
        vm.insightVisible = true;
      }
    });
```

aggiungi il calcolo del riscaldamento, cosi' (unico blocco nuovo: le righe fra `suggestion` e la chiusura):

```ts
      let suggestion: string | null = null;
      if (vm.ex.scheme === 'wave' && maxLoads.length > 0) {
        const lastMax = maxLoads[maxLoads.length - 1];
        const suggested = lastMax + 2.5;
        suggestion = `Prova <b>${suggested} kg</b> — +2.5 kg rispetto all'ultima volta`;
      }

      if (lastText || sparkSvg || suggestion) {
        vm.insight = { lastText, sparkSvg, delta, deltaClass, suggestion };
        vm.insightVisible = true;
      }

      if (vm.isFirst && maxLoads.length > 0) {
        const lastMax = maxLoads[maxLoads.length - 1];
        const round5 = (kg: number) => Math.round(kg / 5) * 5;
        const w1 = round5(lastMax * 0.4);
        const w2 = round5(lastMax * 0.5);
        const w3 = round5(lastMax * 0.6);
        vm.warmup = `Riscaldamento: <b>${w1} kg</b> x8, <b>${w2} kg</b> x5, <b>${w3} kg</b> x3`;
      }
    });
```

- [ ] **Step 4: Aggiorna il template**

(Revisione post-implementazione: l'utente ha chiesto di lasciare la
nota in cima invariata per tutti gli esercizi, e di aggiungere il
riscaldamento in fondo alla card invece di sostituire la nota — vedi
spec aggiornata.)

La nota in cima (`scheda-detail.component.html:9`) **non cambia**:

```html
  <p class="note" *ngIf="vm.ex.note">{{ vm.ex.note }}</p>
```

Il riscaldamento va aggiunto dentro `ex-insights`, subito dopo il
`.suggestion-chip` esistente. Attuale:

```html
      <div class="suggestion-chip" *ngIf="vm.insight.suggestion" [innerHTML]="vm.insight.suggestion"></div>
    </ng-container>
```

diventa:

```html
      <div class="suggestion-chip" *ngIf="vm.insight.suggestion" [innerHTML]="vm.insight.suggestion"></div>
      <div class="suggestion-chip" *ngIf="vm.isFirst && vm.warmup" [innerHTML]="vm.warmup"></div>
    </ng-container>
```

- [ ] **Step 5: Verifica compilazione e test invariati**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx ng test --watch=false && npx ng build`
Expected: nessun errore TypeScript/template; stesso numero di test verdi di prima (nessun test tocca questo file); build completata senza errori.

- [ ] **Step 6: Verifica manuale**

Run: `npx ng serve`, apri un giorno il cui primo esercizio ha gia' una sessione storica salvata con un carico: la card del primo esercizio deve mostrare "Riscaldamento: X kg x8, Y kg x5, Z kg x3" al posto della nota (se ne aveva una), con X/Y/Z pari al 40/50/60% del carico massimo dell'ultima sessione, arrotondati ai 5 kg. Gli altri esercizi del giorno devono continuare a mostrare la loro nota (se presente), invariata. Il blocco "Ultimo/Progressione/Prova X kg" sotto la tabella deve restare invariato su tutti gli esercizi, incluso il primo. Un giorno il cui primo esercizio non ha mai storico non deve mostrare ne' nota ne' riscaldamento su quell'esercizio.

- [ ] **Step 7: Commit**

```bash
git add src/app/pages/scheda-detail/scheda-detail.component.ts src/app/pages/scheda-detail/scheda-detail.component.html
git commit -m "feat: suggerimento di riscaldamento sul primo esercizio del giorno"
```

---

## Self-Review Notes

- **Spec coverage:** identificazione del primo esercizio (`isFirst`) → Step 2; calcolo riscaldamento con le percentuali/arrotondamento esatti richiesti dallo spec → Step 3; sostituzione della nota solo sul primo esercizio, nota invariata sugli altri → Step 4; nessun impatto sul blocco `ex-insights` (nessun task lo tocca) → coperto per assenza di modifica. Nessun gap rispetto allo spec.
- **Placeholder scan:** nessun TBD/TODO; ogni step ha codice completo.
- **Type consistency:** `ExerciseVM.isFirst: boolean`/`warmup: string | null` definiti nello Step 1 e usati identici (stessi nomi) negli Step 2/3/4.
