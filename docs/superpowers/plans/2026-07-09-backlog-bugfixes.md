# Backlog Bugfixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 20 bugs found by the 2026-07-09 full-repo audit (cross-account data leaks, Firestore race conditions, stale route params, PDF parser gaps, timezone bugs, missing error handling), one PR per task.

**Architecture:** Six independent clusters, each touching a distinct subsystem. Executed as six sequential PRs on the single designated branch `claude/diet-protocol-template-vh6wi7` (git-restart-from-main before each), not as parallel branches — confirmed with the user. Each PR waits for the user's explicit go-ahead before merging — confirmed with the user, no exceptions this round either.

**Tech Stack:** Angular 21 standalone components, Firebase/Firestore (`firebase` JS SDK v9 modular API), Vitest for unit tests.

## Global Constraints

- Never merge a PR without the user's explicit confirmation, even though this is a bugfix backlog — the standing rule for this whole session, reconfirmed for this round.
- One shared branch (`claude/diet-protocol-template-vh6wi7`), restarted from `origin/main` before each task's work begins (repo has been merging every PR so far; check `git merge-base --is-ancestor origin/main HEAD` and restart if needed, per this session's established pattern).
- Every task must pass before commit: `npx tsc --noEmit -p tsconfig.json`, `npx ng test --no-watch` (21 existing tests must keep passing, plus any new ones added), `rm -rf dist && npx ng build --configuration production`.
- Follow existing code conventions: Italian comments only where they explain non-obvious *why*, `ZoneFixService.run()` wrapping for any new Firestore calls that need to reach back into Angular's zone, no new abstractions beyond what each fix needs.
- Before editing any file, read its current content fresh (files may have shifted since the audit) — do not blind-patch based on the audit's line numbers alone.

---

### Task 1: Session hygiene — cross-account leak + pairing-code collision

**Bugs fixed:** #1 (cross-account stale-data leak), #12 (pairing-code collision).

**Files:**
- Modify: `src/app/pages/account/account.component.ts` (`logout()` method)
- Modify: `src/app/core/services/auth.service.ts` (`registerCoach()`, add `generateUniqueCoachCode()`)
- Modify: `src/app/services/protocol-bootstrap.service.ts` (remove now-dead `reset()`)

**Design decision (bug #1):** Rather than hunting down and manually resetting every mutable singleton field across `AppStateService`, `ProtocolBootstrapService`, `WorkoutDataService`, `DietDataService` (fragile — easy to miss one, which is how this bug happened), force a **full browser navigation** on logout instead of an Angular route change. A full page load tears down and re-instantiates every singleton service from scratch, which is the robust way to guarantee no cross-account leakage without auditing every service by hand.

- [ ] **Step 1: Change `logout()` to force a full reload**

In `src/app/pages/account/account.component.ts`, replace:
```ts
  async logout(): Promise<void> {
    await this.auth.logout();
    this.router.navigate(['/login']);
  }
```
with:
```ts
  async logout(): Promise<void> {
    await this.auth.logout();
    // Reload completo (non router.navigate) cosi' tutti i singleton
    // (AppStateService, ProtocolBootstrapService, WorkoutDataService,
    // DietDataService, ecc.) ripartono da zero: evita che i dati
    // dell'account precedente restino in memoria per il prossimo login.
    window.location.href = '/login';
  }
```
`Router` may become an unused import if nothing else in the file uses `this.router` — check and remove the import/constructor param only if actually unused elsewhere in the same file.

- [ ] **Step 2: Remove the now-permanently-dead `reset()` from `ProtocolBootstrapService`**

In `src/app/services/protocol-bootstrap.service.ts`, delete:
```ts
  /** Forza un nuovo caricamento (es. dopo che il coach ha attivato un nuovo protocollo). */
  reset(): void {
    this.loaded = false;
  }
```
It was already unreferenced before this change (confirmed by the audit); the full-reload fix in Step 1 removes the last plausible reason to add a call site for it later.

- [ ] **Step 3: Add coach pairing-code uniqueness check**

In `src/app/core/services/auth.service.ts`, add a private method (near `generateCode`, after the imports/constants, inside the class):
```ts
  /** Genera un codice coach garantito univoco, riprovando in caso di rara collisione. */
  private async generateUniqueCoachCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = generateCode();
      const snap = await getDoc(doc(this.fb.db, 'coachCodes', code));
      if (!snap.exists()) return code;
    }
    throw new Error('Impossibile generare un codice coach univoco, riprova.');
  }
```
Then in `registerCoach()`, replace:
```ts
      const pairingCode = generateCode();
```
with:
```ts
      const pairingCode = await this.generateUniqueCoachCode();
```
(This runs inside the existing `this.zoneFix.run((async () => { ... })())` wrapper already present in `registerCoach()` — no new wrapping needed.)

- [ ] **Step 4: Verify**

Run:
```bash
npx tsc --noEmit -p tsconfig.json
npx ng test --no-watch
rm -rf dist && npx ng build --configuration production
```
Expected: no errors, 21/21 tests pass, build succeeds.

- [ ] **Step 5: Manual reasoning check (no new automated test — matches existing project convention of manual/production verification for auth flows)**

Confirm by reading the diff: `logout()` no longer calls `router.navigate`; a second coach registering while a code collision (simulated by temporarily lowering `CODE_CHARS` in a scratch test, not committed) would retry instead of silently overwriting another coach's code.

- [ ] **Step 6: Commit**
```bash
git add src/app/pages/account/account.component.ts src/app/core/services/auth.service.ts src/app/services/protocol-bootstrap.service.ts
git commit -m "fix: evita perdita di dati tra account e collisione codice coach"
```

---

### Task 2: Firestore reliability — ensureDoc race + delete() error handling

**Bugs fixed:** #2 (`AppStateService.ensureDoc()` race condition), #13 (`workout-sessions.service.ts` `delete()` unhandled rejection).

**Files:**
- Modify: `src/app/services/app-state.service.ts` (`ensureDoc()`)
- Modify: `src/app/services/workout-sessions.service.ts` (`delete()`)
- Modify: `src/app/pages/history-detail/history-detail.component.ts` (delete call site)
- Modify: `src/app/pages/history-list/history-list.component.ts` (delete call site)

**Design decision (bug #2):** Replace the non-atomic `getDoc` → conditional `setDoc` with a Firestore transaction, so the check-and-create is atomic. Do **not** switch to `setDoc(ref, emptyState(), {merge:true})` unconditionally — that would silently wipe existing nested fields (`workoutDrafts`, etc.) on every call, a worse bug than the one being fixed.

- [ ] **Step 1: Make `ensureDoc()` atomic via transaction**

In `src/app/services/app-state.service.ts`, add `runTransaction` to the import from `'firebase/firestore'`:
```ts
import { doc, getDoc, setDoc, updateDoc, deleteField, runTransaction } from 'firebase/firestore';
```
Replace:
```ts
  private async ensureDoc(): Promise<void> {
    const snap = await getDoc(this.ref());
    if (!snap.exists()) {
      await setDoc(this.ref(), emptyState());
    }
  }
```
with:
```ts
  private async ensureDoc(): Promise<void> {
    // Transazione invece di getDoc+setDoc separati: se due chiamate concorrenti
    // (es. cambio vista + autosalvataggio bozza) trovano entrambe il doc
    // mancante, solo una delle due lo crea davvero; l'altra la vede gia'
    // esistente e non sovrascrive nulla.
    await runTransaction(this.fb.db, async (tx) => {
      const snap = await tx.get(this.ref());
      if (!snap.exists()) {
        tx.set(this.ref(), emptyState());
      }
    });
  }
```

- [ ] **Step 2: Add error handling to `delete()`**

In `src/app/services/workout-sessions.service.ts`, replace:
```ts
  delete(id: string): Promise<void> {
    return this.zoneFix.run(deleteDoc(doc(this.col(), id)));
  }
```
with:
```ts
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
```
(Matches the existing `save()` method's try/catch-and-return-boolean style in the same file.)

- [ ] **Step 3: Update call sites to handle the boolean result**

Read `src/app/pages/history-detail/history-detail.component.ts` and `src/app/pages/history-list/history-list.component.ts` fresh (current line numbers may have shifted from the audit's #91/#74). Find the `await this.sessionsSvc.delete(...)` (or equivalent field name) call in each, and change the pattern from firing-and-forgetting to checking the returned boolean, e.g.:
```ts
    const ok = await this.sessionsSvc.delete(key);
    if (ok) {
      this.router.navigate(['/scheda/storico']); // or whatever the existing success path already does
    } else {
      // riusa il pattern errorMsg gia' presente nella pagina, se c'e';
      // altrimenti aggiungi un messaggio inline coerente con lo stile delle altre pagine
      this.errorMsg = 'Errore durante l'eliminazione. Riprova.';
    }
```
Match whatever `errorMsg`/loading pattern each page already uses (both pages already have `loading`/`errorMsg` fields per the earlier audit of this repo — reuse them, don't invent a new pattern).

- [ ] **Step 4: Verify**
```bash
npx tsc --noEmit -p tsconfig.json
npx ng test --no-watch
rm -rf dist && npx ng build --configuration production
```

- [ ] **Step 5: Commit**
```bash
git add src/app/services/app-state.service.ts src/app/services/workout-sessions.service.ts src/app/pages/history-detail/history-detail.component.ts src/app/pages/history-list/history-list.component.ts
git commit -m "fix: race condition su AppStateService.ensureDoc e gestione errori eliminazione sessione"
```

---

### Task 3: Coach routing — stale route params + confirm-dialog queueing

**Bugs fixed:** #3 (route params read once via snapshot), #10 (confirm dialog drops earlier request).

**Files:**
- Modify: `src/app/pages/coach-client-detail/coach-client-detail.component.ts`
- Modify: `src/app/pages/coach-protocol-builder/coach-protocol-builder.component.ts`
- Modify: `src/app/pages/coach-protocol-new/coach-protocol-new.component.ts`
- Modify: `src/app/pages/coach-protocol-import/coach-protocol-import.component.ts`
- Modify: `src/app/components/confirm-dialog/confirm-dialog.component.ts`

**Design decision (bug #3):** Each of the four pages currently reads `route.snapshot.paramMap.get(...)` once in `ngOnInit`/constructor. Replace with a `route.paramMap` subscription (`Subscription`, unsubscribed in `ngOnDestroy`) that re-runs the page's existing load method whenever the param changes. Read each file fresh first — the exact current load-method name and constructor shape must come from the live file, not the audit summary.

- [ ] **Step 1: Fix `coach-client-detail.component.ts`**

Read the file. Identify the existing `ngOnInit` that reads `clientId` from `route.snapshot.paramMap.get('clientId')` and the method that performs the data load using it. Replace the one-shot snapshot read with:
```ts
  private paramSub: Subscription | null = null;

  ngOnInit(): void {
    this.paramSub = this.route.paramMap.subscribe(params => {
      this.clientId = params.get('clientId') ?? '';
      this.load(); // or whatever the existing load method is actually called
    });
  }

  ngOnDestroy(): void {
    this.paramSub?.unsubscribe();
  }
```
Import `Subscription` from `'rxjs'` if not already imported. If the component doesn't yet implement `OnDestroy`, add it to the `@Component` class's `implements` clause.

- [ ] **Step 2: Fix `coach-protocol-builder.component.ts`, `coach-protocol-new.component.ts`, `coach-protocol-import.component.ts`**

Same pattern as Step 1, applied to each: subscribe to `route.paramMap` instead of reading `route.snapshot.paramMap` once, re-triggering that page's existing load logic on change, unsubscribing in `ngOnDestroy`. Each of these three pages reads two params (`clientId` + `protocolId` for the builder; `clientId` alone for the other two) — subscribe once and re-derive both from the same `paramMap` emission.

- [ ] **Step 3: Fix confirm-dialog request queueing**

In `src/app/components/confirm-dialog/confirm-dialog.component.ts`, replace the whole class body with:
```ts
export class ConfirmDialogComponent implements OnInit, OnDestroy {
  visible = false;
  message = '';
  private currentResolve: ((v: boolean) => void) | null = null;
  private queue: ConfirmRequest[] = [];
  private sub: Subscription | null = null;

  constructor(private svc: ConfirmDialogService) {}

  ngOnInit(): void {
    this.sub = this.svc.request$.subscribe((req: ConfirmRequest) => {
      if (this.visible) {
        this.queue.push(req);
      } else {
        this.show(req);
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private show(req: ConfirmRequest): void {
    this.message = req.message;
    this.currentResolve = req.resolve;
    this.visible = true;
  }

  answer(result: boolean): void {
    this.visible = false;
    this.currentResolve?.(result);
    this.currentResolve = null;
    const next = this.queue.shift();
    if (next) {
      setTimeout(() => this.show(next), 250);
    }
  }

  onOverlayClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('confirmoverlay')) {
      this.answer(false);
    }
  }
}
```
(Keep the existing `@Component` decorator/template exactly as-is — only the class body changes. The 250ms delay before showing the next queued request lets the closing animation finish before the next dialog opens.)

- [ ] **Step 4: Verify**
```bash
npx tsc --noEmit -p tsconfig.json
npx ng test --no-watch
rm -rf dist && npx ng build --configuration production
```

- [ ] **Step 5: Commit**
```bash
git add src/app/pages/coach-client-detail/coach-client-detail.component.ts src/app/pages/coach-protocol-builder/coach-protocol-builder.component.ts src/app/pages/coach-protocol-new/coach-protocol-new.component.ts src/app/pages/coach-protocol-import/coach-protocol-import.component.ts src/app/components/confirm-dialog/confirm-dialog.component.ts
git commit -m "fix: route param non aggiornati su navigazione interna e conferme eliminazione in coda"
```

---

### Task 4: Date/timezone correctness

**Bugs fixed:** #4 (UTC "today" computation), #11 (date-only strings parsed as UTC then shown local).

**Files:**
- Modify: `src/app/pages/scheda-detail/scheda-detail.component.ts` (`saveWorkout()`, `isoDate` computation; `loadInsights()`, "Ultimo (dd/mm)" text)
- Modify: `src/app/pages/misure/misure.component.ts` (save-date computation)
- Modify: `src/app/pages/history-list/history-list.component.ts` (date display)
- Modify: `src/app/pages/history-detail/history-detail.component.ts` (date display)

**Design decision:** Two distinct sub-bugs, both timezone-related but opposite direction:
1. **Computing "today" for saving** must use *local* date components, not `toISOString()` (which is UTC). Add a small shared helper rather than duplicating the fix inline in two places.
2. **Displaying an already-stored `YYYY-MM-DD` string** must be parsed as local midnight (append `'T00:00:00'` before `new Date(...)`), exactly like `misure-storico.component.ts` and `misure-storico-detail.component.ts` already correctly do — copy that existing pattern.

- [ ] **Step 1: Add a local-date-string helper**

Check whether `src/app/core/utils/` already has a suitable place; if not, add to `src/app/core/utils/sanitize.util.ts` or create `src/app/core/utils/date.util.ts` (prefer a new tiny file — this doesn't belong with "sanitize" semantically):
```ts
/** Data di oggi in formato YYYY-MM-DD, in ora locale (non UTC come farebbe toISOString()). */
export function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}
```

- [ ] **Step 2: Use it in `scheda-detail.component.ts`**

Read the file fresh. Replace:
```ts
    const isoDate = new Date().toISOString().split('T')[0];
```
with (adding the import at the top of the file):
```ts
    const isoDate = todayLocalISO();
```

- [ ] **Step 3: Use it in `misure.component.ts`**

Same replacement, same import, in whichever method currently does `new Date().toISOString().split('T')[0]` for the save date (per the audit, `misure.component.ts:56`; confirm exact location by reading the file fresh).

- [ ] **Step 4: Fix local-midnight parsing of stored dates**

In `src/app/pages/history-list/history-list.component.ts`, `src/app/pages/history-detail/history-detail.component.ts`, and `src/app/pages/scheda-detail/scheda-detail.component.ts` (inside `loadInsights()`, the "Ultimo (dd/mm)" text), find every `new Date(session.date)` (or equivalent stored-date-string variable) used purely for *display* formatting, and change to `new Date(session.date + 'T00:00:00')` — matching the existing correct pattern already used in `misure-storico.component.ts:48` and `misure-storico-detail.component.ts:49`. Do not touch any `new Date(...)` call that isn't parsing one of these stored `YYYY-MM-DD` strings.

- [ ] **Step 5: Verify**
```bash
npx tsc --noEmit -p tsconfig.json
npx ng test --no-watch
rm -rf dist && npx ng build --configuration production
```

- [ ] **Step 6: Commit**
```bash
git add src/app/core/utils/date.util.ts src/app/pages/scheda-detail/scheda-detail.component.ts src/app/pages/misure/misure.component.ts src/app/pages/history-list/history-list.component.ts src/app/pages/history-detail/history-detail.component.ts
git commit -m "fix: data odierna calcolata in ora locale, date storiche interpretate come mezzanotte locale"
```

---

### Task 5: PDF parser hardening

**Bugs fixed:** #5, #6, #7, #8, #9, #17, #18, #19 (all in `src/app/services/pdf-import.service.ts`).

**Files:**
- Modify: `src/app/services/pdf-import.service.ts`
- Modify: `src/app/services/pdf-import.service.spec.ts` (add regression tests — this file already has an established TDD pattern for exactly this kind of parser bug, e.g. the earlier "Giorno ON/OFF repeated header" regression test)

This task follows real TDD, since `pdf-import.service.spec.ts` is the one place in this repo with a mature test harness for the exact kind of bug being fixed here.

- [ ] **Step 1: Regression test for #5 (workout DAY N header repeat) — write failing test first**

Read `pdf-import.service.spec.ts` fully first to match its existing `SAMPLE_TEXT`-building conventions. Add a test that inserts a repeated "DAY 2: ..." page-header line mid-way through Day 2's exercise list (mirroring the existing diet regression test's structure), asserting the parsed result has exactly one Day 2 entry with all its exercises, not two.

- [ ] **Step 2: Run it, confirm it fails**
```bash
npx ng test --no-watch -- pdf-import.service.spec
```
Expected: FAIL (duplicate Day 2 entry, or exercises split across two entries).

- [ ] **Step 3: Fix #5 — guard the DAY header handler like the diet parser already does**

In `parseWorkoutTemplate`, find the `DAY_HEADER_RE` match branch. Apply the same fix already proven for the diet parser: compare against the current day before resetting/pushing a new one.
```ts
    const dayMatch = line.match(DAY_HEADER_RE);
    if (dayMatch) {
      // stesso fix del parser dieta: "DAY N" e' anche intestazione ripetuta
      // a inizio pagina, non solo inizio sezione — se e' lo stesso giorno
      // gia' in corso, e' solo un ri-attraversamento di pagina.
      const dayLabel = /* however the existing code currently derives the day label/id from dayMatch */;
      const existingDay = days.find(d => /* however existing code matches day identity */);
      if (existingDay !== currentDay) {
        finalizePending();
        currentDay = existingDay ?? /* however the existing code currently constructs a new day object */;
        if (!existingDay) days.push(currentDay);
      }
      continue;
    }
```
(The exact surrounding variable names must come from reading the live file — this mirrors the diet parser's already-shipped fix, adapt to the workout parser's actual variable names.)

- [ ] **Step 4: Run test, confirm it passes; run full suite**
```bash
npx ng test --no-watch
```
Expected: all pass, including the new one.

- [ ] **Step 5: Regression test for #6 + #7 (CONTINUA_RE never checked in workout parser, and doesn't match real ellipsis) — write failing tests first**

Add two tests: (a) insert a `"…Continua Day 2"` line (real Unicode ellipsis, U+2026) mid-exercise-list in a workout sample and assert it's skipped, not parsed as a bogus scheme line; (b) same with literal `"...Continua Day 2"` (three dots) to confirm the existing three-dot form still works once fixed.

- [ ] **Step 6: Run, confirm failure**

- [ ] **Step 7: Fix #6 + #7**

Fix the regex first — in the shared `CONTINUA_RE` definition:
```ts
const CONTINUA_RE = /^[.…]{2,}\s*continua\b/i;
```
Broaden to accept either three-or-more literal dots, or one-or-more real ellipsis characters, or a mix:
```ts
const CONTINUA_RE = /^(?:\.{2,}|…+)\s*continua\b/i;
```
Then add the missing check inside `parseWorkoutTemplate`'s line loop (wherever `pendingExercise`/scheme-line handling happens), mirroring how the diet parser already uses `CONTINUA_RE` at line ~417:
```ts
    if (CONTINUA_RE.test(line)) continue;
```
placed before the line reaches the `if (pendingExercise)` branch that would otherwise misinterpret it as a scheme line.

- [ ] **Step 8: Run tests, confirm pass**

- [ ] **Step 9: Regression test for #8 (unrecognized meal header merges into previous meal)**

Add a test with a meal section named something not in `MEAL_HEADER_DEFS` (e.g. `"SPUNTINO SERALE"`) between two recognized meals, asserting its food items do NOT get attached to the preceding meal (either dropped with a clear "unrecognized section" signal, or — better — treated as its own meal using the raw header text as the name).

- [ ] **Step 10: Run, confirm failure**

- [ ] **Step 11: Fix #8**

In the meal-header dispatch logic (where `MEAL_HEADER_DEFS` regexes are tried and the line is otherwise silently dropped), add a fallback branch: if a line looks like a section header (short, no gram/quantity suffix, not matching `ALTERNATIVE_MARKER_RE` or any known food-line shape) but doesn't match any `MEAL_HEADER_DEFS` entry, start a *new* meal using the raw text as its name instead of falling through silently. Exact heuristic for "looks like a header" must be designed against the live file's existing line-classification helpers — read the file fully before writing this branch.

- [ ] **Step 12: Run tests, confirm pass**

- [ ] **Step 13: Regression test for #9 (wave detection depends on specific Italian phrasing)**

Add a test with an alternate wave-cycle phrasing (e.g. `"4X10 4X10 4X8 4X8 5X6 5X6… ricomincia dal ciclo 1"` instead of `"...riprendi da 4X10 aumentando il carico"`), asserting it still produces an 8-week `weekPlan` instead of one flat summed scheme.

- [ ] **Step 14: Run, confirm failure**

- [ ] **Step 15: Fix #9**

Broaden `WAVE_MARKER_RE` to also match cycle-restart phrasing without requiring "riprendi"/"aumentando" literally — read the current regex and `parseSchemeLine`'s wave branch first, then add alternation for phrases like `ricomincia`, `ripeti dal ciclo`, `torna al ciclo` alongside the existing accepted phrases, keeping the existing ones working (this is additive, not a replacement).

- [ ] **Step 16: Run tests, confirm pass**

- [ ] **Step 17: Fix #17, #18, #19 (smaller, no dedicated new test required beyond a quick assertion each)**

- #17: In `extractDietNotes`, add an explicit stop condition for the "Consigli di base" section — stop consuming lines once a recognized page-boundary marker (`CONTINUA_RE`, a repeated "Giorno ON/OFF" header, or a blank-then-header transition — read the current filter list first) is hit, instead of consuming every remaining line through end-of-document.
- #18: In `MISURA_RE`, change `cucchiai(?:ni|no)?` to `cucchiai(?:ni|no)?|cucchiaio` (or equivalent alternation covering the singular form) so `"1 cucchiaio"` matches like `"2 cucchiai"` already does.
- #19: In `SINGLE_SCHEME_RE`, broaden the reps capture group from `\S+` to allow a short multi-word phrase (e.g. `[^\n]+?` non-greedy up to the next known boundary) so `"AL CEDIMENTO"` is captured whole instead of just `"AL"`. Add one test case for this (`"3X AL CEDIMENTO"` should produce `reps = "AL CEDIMENTO"`, not put "CEDIMENTO" in `note`).

- [ ] **Step 18: Run full suite one more time**
```bash
npx ng test --no-watch
```
Expected: all pass (21 existing + new regression tests for #5, #6/#7, #8, #9, #19).

- [ ] **Step 19: Verify build**
```bash
npx tsc --noEmit -p tsconfig.json
rm -rf dist && npx ng build --configuration production
```

- [ ] **Step 20: Commit**
```bash
git add src/app/services/pdf-import.service.ts src/app/services/pdf-import.service.spec.ts
git commit -m "fix: irrobustisce il parser scheda/dieta (intestazioni ripetute, continua pagina, wave, unita' di misura)"
```

---

### Task 6: Client-page polish

**Bugs fixed:** #14 (`scheda-list` hardcoded 8 weeks), #15 (draft autosave resurrection after save), #16 (missing error handling in `misure-analytics`/`misure-storico-detail`).

**Files:**
- Modify: `src/app/pages/scheda-list/scheda-list.component.ts` and `.html`
- Modify: `src/app/pages/scheda-detail/scheda-detail.component.ts` (`saveWorkout()`, draft timer cancellation)
- Modify: `src/app/pages/misure/misure.component.ts` (`saveMeasures()`, draft timer cancellation)
- Modify: `src/app/pages/misure-analytics/misure-analytics.component.ts` and `.html`
- Modify: `src/app/pages/misure-storico-detail/misure-storico-detail.component.ts` and `.html`

- [ ] **Step 1: Fix #14 — derive week count from the active protocol**

Read `scheda-list.component.ts` and `scheda-info.component.ts` fresh (the audit notes `scheda-info` already does this correctly — copy its exact approach). Replace the hardcoded `weeks = [1,2,3,4,5,6,7,8]` (and the template's fixed 8 dots) with a derivation from `this.workoutData.WEEK_PLAN.length` (or wherever `scheda-info` reads the real count from), so both the "Settimana X di N" text and the week-dots render use the real protocol length.

- [ ] **Step 2: Fix #15 — cancel the draft timer on successful save**

In `scheda-detail.component.ts`'s `saveWorkout()`, after `await this.appState.deleteFieldPath(...)` succeeds, add:
```ts
        if (this.draftTimer) { clearTimeout(this.draftTimer); this.draftTimer = null; }
```
before setting `saveStatus` to `'saved'` (so a debounced draft write already in flight can't fire and recreate `workoutDrafts.{dayId}` right after it was deleted). Apply the equivalent fix in `misure.component.ts`'s `saveMeasures()` around its own `clearDraft()` call and `draftTimer` field.

- [ ] **Step 3: Fix #16 — add the loading/errorMsg/retry pattern to `misure-analytics` and `misure-storico-detail`**

Read both files fresh, then apply the exact same pattern already used in `history-list.component.ts`/`misure-storico.component.ts` (loading/errorMsg fields, `Promise.race` with a 12s timeout, try/catch/finally with `cdr.detectChanges()`, retry button in the template calling the load method again). `misure-analytics.component.ts`'s existing `loading` field is currently dead (never read in the template) — wire it into the template's `*ngIf` conditions instead of leaving it unused.

- [ ] **Step 4: Verify**
```bash
npx tsc --noEmit -p tsconfig.json
npx ng test --no-watch
rm -rf dist && npx ng build --configuration production
```

- [ ] **Step 5: Commit**
```bash
git add src/app/pages/scheda-list/ src/app/pages/scheda-detail/scheda-detail.component.ts src/app/pages/misure/misure.component.ts src/app/pages/misure-analytics/ src/app/pages/misure-storico-detail/
git commit -m "fix: durata protocollo dinamica, bozza allenamento non riappare dopo il salvataggio, gestione errori misure"
```

---

## Execution Notes (not part of the TDD steps above)

After each task's commit, per this session's established workflow (not part of this plan's TDD steps, but required before starting the next task):
1. `git push -u origin claude/diet-protocol-template-vh6wi7`
2. Open a PR describing the specific bug(s) fixed, referencing this audit.
3. Subscribe to PR activity, wait for CI green.
4. **Wait for the user's explicit confirmation before merging** — no exceptions.
5. Once merged, `git fetch origin main && git checkout -B claude/diet-protocol-template-vh6wi7 origin/main` before starting the next task (matches this session's established restart-from-main pattern for a single shared branch).
