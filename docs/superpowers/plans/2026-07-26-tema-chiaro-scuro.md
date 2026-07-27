# Tema chiaro/scuro con toggle in Account — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere un tema chiaro reale (applicato a tutta l'app, non un'anteprima) attivabile da un toggle "Notte"/"Giorno" in una nuova sezione "Impostazioni" della pagina Account, sincronizzato su Firestore, con default che segue `prefers-color-scheme` finche' l'utente non sceglie esplicitamente.

**Architecture:** Pattern token CSS + attributo `data-theme` su `<html>`: un nuovo blocco `:root[data-theme="light"]` in `src/styles.css` ridefinisce tutti i custom property colore esistenti (nessun nome di token cambia). Un nuovo `ThemeService` (stesso pattern di `WorkoutStateService.viewMode`) espone un `signal<ThemeMode>`, lo sincronizza con `AppStateService`/Firestore e applica l'attributo `data-theme`. Un nuovo token `--accent-contrast` risolve i punti dove del testo scuro hardcoded (`#000`/`#04140D`) e' oggi affiancato a uno sfondo derivato da `--accent`, che nel tema chiaro diventa un blu troppo scuro per quel testo.

**Tech Stack:** Angular 21 standalone components, signals (`signal`/`effect`), Vitest (`@angular/build:unit-test`) per i test — niente Jasmine/`jasmine.createSpyObj`, si mockano oggetti/funzioni a mano.

## Global Constraints

- Nessun nome di custom property CSS esistente cambia — solo nuovi valori sotto `:root[data-theme="light"]` e il nuovo token `--accent-contrast`.
- Persistenza: sincronizzata su Firestore via `AppStateService.patchField('themeMode', ...)`, con cache `localStorage['themePreference']`.
- Default per chi non ha mai scelto: segue `window.matchMedia('(prefers-color-scheme: light)')`; non si scrive mai un valore esplicito su Firestore finche' l'utente non chiama `setMode()` almeno una volta.
- Palette chiara approvata (dal mockup `https://claude.ai/code/artifact/32b13674-0aa9-4a36-be0d-363d73f72df9` e dalla spec `docs/superpowers/specs/2026-07-26-tema-chiaro-scuro-design.md`): `--bg:#F6F7FA`, `--content-glass-bg:#FFFFFF`, `--label:#14171C`, `--accent`(`--imp-red`)`:#3E63E0`, `--imp-amber:#2E9A5C`, `--macro-carb:#B8862A`, `--macro-protein:#C85C52`, `--sys-cyan:#0A8FC4`.
- Tipografia (Inter + IBM Plex Mono) invariata in entrambi i temi.
- Test runner: Vitest via `npm test` (= `ng test`). Build: `npm run build` (= `ng build`).

---

## Task 1: `ThemeService` + campo `themeMode` in `AppState`

**Files:**
- Modify: `src/app/services/app-state.service.ts:14-27`
- Create: `src/app/services/theme.service.ts`
- Create: `src/app/services/theme.service.spec.ts`

**Interfaces:**
- Consumes: `AppStateService.load(): Promise<AppState>`, `AppStateService.patchField(path: string, value: unknown): Promise<void>` (gia' esistenti, invariati); `AuthService.authReady: Signal<boolean>`, `AuthService.currentUser: Signal<UserProfile | null>` (gia' esistenti, invariati).
- Produces: `export type ThemeMode = 'dark' | 'light';` (in `app-state.service.ts`, riesportato da nessun altro file — Task 4 lo importa da `./theme.service` insieme al servizio). `ThemeService.mode: Signal<ThemeMode>`, `ThemeService.setMode(mode: ThemeMode): void` — usati da Task 4 (Account UI) e Task 3 (bootstrap wiring, che inietta il servizio ma non chiama metodi).

- [ ] **Step 1: Aggiungi `ThemeMode` e il campo `themeMode` ad `AppState`**

In `src/app/services/app-state.service.ts`, modifica l'interfaccia e la funzione `emptyState()`:

```ts
export type ThemeMode = 'dark' | 'light';

export interface AppState {
  workoutDrafts: Record<string, { rows: WorkoutDraftRow[] }[]>;
  restOverrides: Record<string, number>;
  measureDraft: Record<string, Record<string, string | null>> | null;
  shoppingChecked: Record<string, boolean>;
  shoppingCustomItems: { id: string; name: string; checked: boolean }[];
  workoutViewMode: 'list' | 'slider';
  dietViewMode: 'list' | 'slider';
  mealsCompletion: { date: string; done: Record<string, boolean> } | null;
  themeMode: ThemeMode | null;
}

function emptyState(): AppState {
  return { workoutDrafts: {}, restOverrides: {}, measureDraft: null, shoppingChecked: {}, shoppingCustomItems: [], workoutViewMode: 'list', dietViewMode: 'list', mealsCompletion: null, themeMode: null };
}
```

`themeMode: null` = l'utente non ha mai scelto esplicitamente (segue l'OS). Nessun'altra riga del file cambia.

- [ ] **Step 2: Scrivi i test per `ThemeService` (falliranno: il file non esiste ancora)**

Crea `src/app/services/theme.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

function stubMatchMedia(matchesLight: boolean): void {
  (window as any).matchMedia = (query: string) => ({
    matches: query === '(prefers-color-scheme: light)' ? matchesLight : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('usa il valore in cache se presente, ignorando la preferenza di sistema', () => {
    localStorage.setItem('themePreference', 'light');
    stubMatchMedia(false);
    const appStateStub = {} as any;
    const authStub = { authReady: () => false, currentUser: () => null } as any;
    const service = TestBed.runInInjectionContext(() => new ThemeService(appStateStub, authStub));
    expect(service.mode()).toBe('light');
  });

  it('senza cache segue la preferenza di sistema (chiaro)', () => {
    stubMatchMedia(true);
    const appStateStub = {} as any;
    const authStub = { authReady: () => false, currentUser: () => null } as any;
    const service = TestBed.runInInjectionContext(() => new ThemeService(appStateStub, authStub));
    expect(service.mode()).toBe('light');
  });

  it('senza cache segue la preferenza di sistema (scuro)', () => {
    stubMatchMedia(false);
    const appStateStub = {} as any;
    const authStub = { authReady: () => false, currentUser: () => null } as any;
    const service = TestBed.runInInjectionContext(() => new ThemeService(appStateStub, authStub));
    expect(service.mode()).toBe('dark');
  });

  it('setMode aggiorna signal, localStorage e chiama patchField', () => {
    stubMatchMedia(false);
    const calls: [string, unknown][] = [];
    const appStateStub = {
      patchField: (path: string, value: unknown) => { calls.push([path, value]); return Promise.resolve(); }
    } as any;
    const authStub = { authReady: () => false, currentUser: () => null } as any;
    const service = TestBed.runInInjectionContext(() => new ThemeService(appStateStub, authStub));

    service.setMode('light');

    expect(service.mode()).toBe('light');
    expect(localStorage.getItem('themePreference')).toBe('light');
    expect(calls).toEqual([['themeMode', 'light']]);
  });

  it("setMode e' un no-op se il tema richiesto e' gia' quello attivo", () => {
    stubMatchMedia(false);
    const calls: [string, unknown][] = [];
    const appStateStub = {
      patchField: (path: string, value: unknown) => { calls.push([path, value]); return Promise.resolve(); }
    } as any;
    const authStub = { authReady: () => false, currentUser: () => null } as any;
    const service = TestBed.runInInjectionContext(() => new ThemeService(appStateStub, authStub));

    service.setMode('dark');

    expect(calls).toEqual([]);
  });

  it('applica data-theme sul document al costrutto e a ogni cambio', () => {
    stubMatchMedia(false);
    const appStateStub = { patchField: () => Promise.resolve() } as any;
    const authStub = { authReady: () => false, currentUser: () => null } as any;
    const service = TestBed.runInInjectionContext(() => new ThemeService(appStateStub, authStub));
    TestBed.flushEffects();

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    service.setMode('light');
    TestBed.flushEffects();

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('sincronizza da Firestore quando il tema salvato differisce da quello attivo', async () => {
    stubMatchMedia(false);
    let loadPromise!: Promise<any>;
    const appStateStub = {
      load: () => (loadPromise = Promise.resolve({ themeMode: 'light' } as any))
    } as any;
    const authStub = { authReady: () => true, currentUser: () => ({ uid: 'u1' }) } as any;
    const service = TestBed.runInInjectionContext(() => new ThemeService(appStateStub, authStub));
    TestBed.flushEffects();

    await loadPromise;

    expect(service.mode()).toBe('light');
    expect(localStorage.getItem('themePreference')).toBe('light');
  });

  it("non tocca il tema se Firestore non ha un valore salvato (l'utente non ha mai scelto)", async () => {
    stubMatchMedia(false);
    let loadPromise!: Promise<any>;
    const appStateStub = {
      load: () => (loadPromise = Promise.resolve({ themeMode: null } as any))
    } as any;
    const authStub = { authReady: () => true, currentUser: () => ({ uid: 'u1' }) } as any;
    const service = TestBed.runInInjectionContext(() => new ThemeService(appStateStub, authStub));
    TestBed.flushEffects();

    await loadPromise;

    expect(service.mode()).toBe('dark');
  });
});
```

- [ ] **Step 3: Esegui i test e verifica che falliscano (il servizio non esiste)**

Run: `npm test -- --run src/app/services/theme.service.spec.ts`
Expected: FAIL — `Cannot find module './theme.service'` (o equivalente errore di risoluzione modulo).

- [ ] **Step 4: Implementa `ThemeService`**

Crea `src/app/services/theme.service.ts`:

```ts
import { Injectable, signal, effect } from '@angular/core';
import { AppStateService, ThemeMode } from './app-state.service';
import { AuthService } from '../core/services/auth.service';

const THEME_CACHE_KEY = 'themePreference';

@Injectable({ providedIn: 'root' })
export class ThemeService {

  /**
   * Tema chiaro/scuro: inizializzato dalla cache locale (se l'utente ha
   * gia' scelto esplicitamente in passato) o dalla preferenza di sistema,
   * poi allineato al valore salvato sull'account non appena disponibile.
   */
  mode = signal<ThemeMode>(this.initialMode());

  constructor(private appState: AppStateService, private auth: AuthService) {
    effect(() => {
      document.documentElement.setAttribute('data-theme', this.mode());
    });

    // Aspetta che l'autenticazione sia risolta prima di leggere l'account:
    // altrimenti currentUser() e' ancora null (crash) all'avvio dell'app.
    effect(() => {
      if (!this.auth.authReady() || !this.auth.currentUser()) return;
      this.appState.load().then(state => {
        if (state.themeMode && state.themeMode !== this.mode()) {
          this.mode.set(state.themeMode);
          localStorage.setItem(THEME_CACHE_KEY, state.themeMode);
        }
      });
    });
  }

  private initialMode(): ThemeMode {
    const cached = localStorage.getItem(THEME_CACHE_KEY);
    if (cached === 'dark' || cached === 'light') return cached;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  /**
   * Se l'utente non ha mai scelto esplicitamente un tema, non scriviamo
   * mai un valore su Firestore: l'app continua a seguire la preferenza
   * di sistema anche se cambia in futuro. Solo la prima scelta manuale
   * "fissa" la preferenza sull'account.
   */
  setMode(mode: ThemeMode): void {
    if (this.mode() === mode) return;
    this.mode.set(mode);
    localStorage.setItem(THEME_CACHE_KEY, mode);
    this.appState.patchField('themeMode', mode);
  }
}
```

- [ ] **Step 5: Esegui i test e verifica che passino**

Run: `npm test -- --run src/app/services/theme.service.spec.ts`
Expected: PASS — 8/8 test.

- [ ] **Step 6: Commit**

```bash
git add src/app/services/app-state.service.ts src/app/services/theme.service.ts src/app/services/theme.service.spec.ts
git commit -m "feat: ThemeService con persistenza Firestore e default da preferenza di sistema"
```

---

## Task 2: Retheme completo di `styles.css`

**Files:**
- Modify: `src/styles.css` (blocco `:root` righe 1-43, e 15 selettori sparsi nel resto del file — elencati sotto)

**Interfaces:**
- Consumes: nessuno (solo CSS, nessuna dipendenza da Task 1).
- Produces: token `--accent-contrast` (usato da nessun altro file TS/HTML — e' referenziato solo da CSS dentro questo stesso file), blocco `:root[data-theme="light"]` attivato dall'attributo che `ThemeService` (Task 1) applica su `<html>`.

Questo task e' puro CSS: nessun test automatico possibile (il progetto non ha test di regressione visiva). La verifica e' `npm run build` (nessun errore di sintassi) + i grep di verifica indicati nei singoli step.

- [ ] **Step 1: Aggiungi il token `--accent-contrast` al tema scuro esistente**

In `src/styles.css`, dentro il blocco `:root { ... }` (righe 1-43), sostituisci la riga 38:

```css
  --content-glass-border: rgba(255,255,255,0.12);
```

con:

```css
  --content-glass-border: rgba(255,255,255,0.12);
  --accent-contrast:#04140D; /* testo su sfondo derivato da --accent: scuro finche' l'accento resta un blu pastello chiaro */
```

- [ ] **Step 2: Aggiungi il blocco `:root[data-theme="light"]`**

Subito dopo la riga 43 (la `}` di chiusura del blocco `:root`), e prima della riga 45 (`*, *::before, *::after { ... }`), inserisci:

```css

/* ===== Tema chiaro (data-theme="light") ===== */
:root[data-theme="light"] {
  --bg:#F6F7FA;
  --bg-card:#FFFFFF;
  --bg-card-2:#FFFFFF;
  --separator:rgba(20,23,28,0.12);
  --label:#14171C;
  --label-2:rgba(20,23,28,0.72);
  --label-3:rgba(20,23,28,0.50);
  --imp-red:#3E63E0;
  --imp-red-dim:rgba(62,99,224,0.12);
  --imp-amber:#2E9A5C;
  --imp-amber-dim:rgba(46,154,92,0.14);
  --macro-carb:#B8862A;
  --macro-protein:#C85C52;
  --sys-cyan:#0A8FC4;
  --sys-cyan-dim:rgba(10,143,196,0.14);
  --accent-contrast:#FFFFFF;
  --state-success-rgb: 62,99,224;
  --state-success-deep: #9FB0D9;
  --state-success-deep-rgb: 159,176,217;
  --state-danger: #A32E3E;
  --state-danger-rgb: 163,46,62;
  --state-danger-deep: #6E1F29;
  --state-danger-deep-rgb: 110,31,41;
  --state-danger-text: #A32E3E;
  --glass-bg: rgba(255,255,255,0.55);
  --glass-border: rgba(20,23,28,0.12);
  --content-glass-bg: #FFFFFF;
  --content-glass-border: rgba(20,23,28,0.10);
}

/* Sfondo vivace chiaro: stessa tecnica del tema scuro (vedi body::before
   sotto), ma con tinte pastello cosi' il vetro liquido rifrange qualcosa
   di chiaro invece di un blob quasi nero che intorbidirebbe le card bianche. */
:root[data-theme="light"] body::before {
  background: linear-gradient(200deg,
    #EAF0FF 0%,
    #F5F3FF 40%,
    #FAFBFD 75%,
    #F6F7FA 100%);
}
```

Nota: `--accent`, `--accent-dim`, `--on`, `--on-dim`, `--state-success`, `--sys-red` **non** vanno ridefiniti qui: nel blocco scuro sono gia' formule (`--accent: var(--imp-red);` ecc.), quindi seguono automaticamente i nuovi valori di `--imp-red`/`--imp-red-dim`/`--state-danger` appena ridefiniti sopra.

- [ ] **Step 3: Sostituisci ogni testo scuro hardcoded affiancato a uno sfondo derivato da `--accent`/`--state-success` con `var(--accent-contrast)`**

Sostituisci, in `src/styles.css`, ciascuna di queste righe esattamente (stessa riga, solo il valore di `color` cambia):

1. Riga 112 — `.saveworkout-icon{background:var(--imp-red);border-color:rgba(255,255,255,.14);color:#04140D;box-shadow:inset 0 1px 0 rgba(255,255,255,.3);transition:filter .2s ease,background .2s ease;}` → sostituisci `color:#04140D` con `color:var(--accent-contrast)`.
2. Riga 115 — `.saveworkout-icon.saved{background:var(--state-success);color:#000;}` → sostituisci `color:#000` con `color:var(--accent-contrast)`.
3. Riga 161 — `.viewtogglebtn.active{background:var(--accent);color:#04140D;}` → sostituisci `color:#04140D` con `color:var(--accent-contrast)`.
4. Riga 185 — `.ex-counter.complete{color:#000;background:var(--accent);border-color:var(--accent);}` → sostituisci `color:#000` con `color:var(--accent-contrast)`.
5. Riga 207 — `.set-check.done{background:var(--accent);border-color:var(--accent);color:#000;}` → sostituisci `color:#000` con `color:var(--accent-contrast)`.
6. Riga 209 — `.meal-check.done{background:var(--accent);border-color:var(--accent);color:#000;}` → sostituisci `color:#000` con `color:var(--accent-contrast)`.
7. Riga 289 — `.protocol-status.ps-active{color:#04140D;background:var(--accent);}` → sostituisci `color:#04140D` con `color:var(--accent-contrast)`.
8. Riga 305 — `.shop-check{width:24px;height:24px;border-radius:7px;border:2px solid var(--content-glass-border);flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#04140D;transition:border-color .2s ease,background .2s ease;}` → sostituisci `color:#04140D` con `color:var(--accent-contrast)`.
9. Riga 310 — `.shop-addbtn{width:46px;height:46px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:var(--imp-red);color:#04140D;font-size:20px;font-weight:700;cursor:pointer;flex-shrink:0;}` → sostituisci `color:#04140D` con `color:var(--accent-contrast)`.
10. Riga 362 — `.savebtn{width:100%;padding:16px;min-height:52px;border-radius:20px;border:1px solid rgba(255,255,255,.14);background:var(--imp-red);color:#04140D;font-family:'Inter',sans-serif;font-weight:700;letter-spacing:-.005em;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 8px 22px rgba(0,0,0,.3);transition:filter .2s ease;}` → sostituisci `color:#04140D` con `color:var(--accent-contrast)`.
11. Riga 382 — `.rocker .lbl.active{color:#04140D;}` → sostituisci `color:#04140D` con `color:var(--accent-contrast)`.
12. Righe 610-613 —
    ```css
    .savebtn {
      background: var(--imp-red);
      color: #04140D;
    }
    ```
    → sostituisci `color: #04140D;` con `color: var(--accent-contrast);`.
13. Riga 615 — `.savebtn.saved { background: rgba(var(--state-success-rgb),0.85); color: #04220f; }` → sostituisci `color: #04220f` con `color: var(--accent-contrast)`.
14. Riga 622 — `.confirmbtn.restsave { background: var(--accent); color: #000; }` → sostituisci `color: #000` con `color: var(--accent-contrast)`.
15. Riga 624 — `.confirmbtn.confirm { background: var(--accent); color: #000; }` → sostituisci `color: #000` con `color: var(--accent-contrast)`.

**Non toccare** `.apptoast{...background:rgba(48,209,88,0.92);color:#04220f;...}` (riga 645): il suo sfondo e' un verde hardcoded indipendente da `--accent`/`--state-success`, non cambia con il tema — il testo scuro resta corretto in entrambi i temi.

- [ ] **Step 4: Verifica che non resti nessun altro spot hardcoded fuori scope**

Run: `grep -n "color:#000\|color: #000\|color:#04140D\|color: #04140D\|color: #04220f\|color:#04220f" src/styles.css`
Expected: **una sola riga** in output — quella di `.apptoast` (riga ~645, `color:#04220f` sul verde hardcoded indipendente) — nessun'altra occorrenza.

- [ ] **Step 5: Verifica che il progetto compili**

Run: `npm run build`
Expected: build completata senza errori (nessun errore di sintassi CSS).

- [ ] **Step 6: Commit**

```bash
git add src/styles.css
git commit -m "feat: retheme completo tema chiaro (:root[data-theme=light]) + token --accent-contrast"
```

---

## Task 3: Bootstrap — anti-flash e istanziazione precoce di `ThemeService`

**Files:**
- Modify: `src/index.html`
- Modify: `src/app/app.ts:1-59`

**Interfaces:**
- Consumes: `ThemeService` (Task 1) — solo per forzarne l'istanziazione all'avvio, nessun metodo chiamato direttamente da `App`.
- Produces: nessuno (task terminale per il bootstrap; Task 4 non dipende da questo, ma va eseguito comunque perche' altrimenti `ThemeService` non verrebbe mai istanziato finche' nessun componente lo inietta).

- [ ] **Step 1: Aggiungi lo script anti-flash in `index.html`**

In `src/index.html`, subito dopo `<meta charset="utf-8">` (riga 4) e prima di `<title>` (riga 5), inserisci:

```html
  <script>
    (function () {
      try {
        var cached = localStorage.getItem('themePreference');
        var mode = cached === 'dark' || cached === 'light'
          ? cached
          : (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
        document.documentElement.setAttribute('data-theme', mode);
      } catch (e) {
        // localStorage/matchMedia non disponibili (es. modalita' privata): resta sul tema scuro di default.
      }
    })();
  </script>
```

La chiave `'themePreference'` deve restare identica a `THEME_CACHE_KEY` in `theme.service.ts` (Task 1) — sono la stessa cache, letta prima ancora che Angular parta.

- [ ] **Step 2: Inietta `ThemeService` in `App` per forzarne l'istanziazione all'avvio**

In `src/app/app.ts`, aggiungi l'import (dopo la riga 19, `import { MeasureCategoryStateService } from './services/measure-category-state.service';`):

```ts
import { ThemeService } from './services/theme.service';
```

Poi aggiungi il parametro al costruttore (riga 49-59), da:

```ts
  constructor(
    private router: Router,
    private workoutData: WorkoutDataService,
    public workoutState: WorkoutStateService,
    public dietState: DietStateService,
    public auth: AuthService,
    private swUpdate: SwUpdate,
    public historyEditState: HistoryEditStateService,
    public protocolBuilderState: ProtocolBuilderStateService,
    public measureState: MeasureCategoryStateService
  ) {}
```

a:

```ts
  constructor(
    private router: Router,
    private workoutData: WorkoutDataService,
    public workoutState: WorkoutStateService,
    public dietState: DietStateService,
    public auth: AuthService,
    private swUpdate: SwUpdate,
    public historyEditState: HistoryEditStateService,
    public protocolBuilderState: ProtocolBuilderStateService,
    public measureState: MeasureCategoryStateService,
    private theme: ThemeService
  ) {}
```

`theme` non e' usato altrove in `App` (ne' nel costruttore ne' nel template): l'unico scopo e' che Angular lo istanzi (e quindi ne esegua il costruttore, con i suoi due `effect()`) non appena `App` viene creato all'avvio, esattamente come gia' avviene oggi per `WorkoutStateService`/`DietStateService`.

- [ ] **Step 3: Verifica che il progetto compili e i test esistenti passino**

Run: `npm run build`
Expected: build completata senza errori.

Run: `npm test -- --run`
Expected: PASS — tutta la suite esistente (nessuna regressione), incluso `theme.service.spec.ts` da Task 1.

- [ ] **Step 4: Commit**

```bash
git add src/index.html src/app/app.ts
git commit -m "feat: applica il tema salvato prima del bootstrap e istanzia ThemeService all'avvio"
```

---

## Task 4: Sezione "Impostazioni" in Account

**Files:**
- Modify: `src/app/pages/account/account.component.html:1-9` (inserimento dopo la riga 9)
- Modify: `src/app/pages/account/account.component.ts:1-48`
- Modify: `src/styles.css` (nuova regola dopo la riga 161)

**Interfaces:**
- Consumes: `ThemeService.mode: Signal<ThemeMode>`, `ThemeService.setMode(mode: ThemeMode): void` (Task 1).
- Produces: nessuno (ultimo task funzionale del piano).

- [ ] **Step 1: Aggiungi la variante `.theme-toggle` al toggle segmentato esistente**

In `src/styles.css`, subito dopo la riga 161 (`.viewtogglebtn.active{background:var(--accent);color:var(--accent-contrast);}` — gia' aggiornata dal Task 2), inserisci:

```css
/* Variante del toggle lista/slider per l'impostazione Notte/Giorno in
   Account: due etichette di testo invece di due icone strette, quindi
   larghezza automatica con padding orizzontale al posto dei 30px fissi. */
.theme-toggle .viewtogglebtn{width:auto;padding:6px 14px;font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:600;}
```

- [ ] **Step 2: Inietta `ThemeService` in `AccountComponent`**

In `src/app/pages/account/account.component.ts`, aggiungi l'import (dopo la riga 3, `import { AuthService } from '../../core/services/auth.service';`):

```ts
import { ThemeService } from '../../services/theme.service';
```

Poi modifica il costruttore (riga 48), da:

```ts
  constructor(public auth: AuthService, private cdr: ChangeDetectorRef) {}
```

a:

```ts
  constructor(public auth: AuthService, private cdr: ChangeDetectorRef, public theme: ThemeService) {}
```

- [ ] **Step 3: Aggiungi la card "Impostazioni" nel template**

In `src/app/pages/account/account.component.html`, subito dopo la riga 9 (`</div>`, chiusura della card profilo) e prima della riga 11 (`<div class="infocard" *ngIf="showIosNotificationHint" ...>`), inserisci:

```html

<p class="sectiontitle">Impostazioni</p>
<div class="infocard">
  <div class="account-row">
    <span class="account-row-label">Tema</span>
    <div class="viewtoggle theme-toggle">
      <button class="viewtogglebtn" [class.active]="theme.mode() === 'dark'"
              (click)="theme.setMode('dark')">Notte</button>
      <button class="viewtogglebtn" [class.active]="theme.mode() === 'light'"
              (click)="theme.setMode('light')">Giorno</button>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Verifica che il progetto compili e i test esistenti passino**

Run: `npm run build`
Expected: build completata senza errori.

Run: `npm test -- --run`
Expected: PASS — tutta la suite esistente (nessuna regressione).

- [ ] **Step 5: Verifica manuale in browser (Playwright, Chromium pre-installato)**

Avvia `ng serve` in background, poi con Playwright/Chromium (`/opt/pw-browsers/chromium`):
1. Vai su `/account`, conferma che appaia la card "Impostazioni" con i due bottoni "Notte"/"Giorno".
2. Clicca "Giorno": conferma che l'intera app (sfondo, navbar, tabbar) passi al tema chiaro senza reload, e che il bottone "Giorno" diventi quello attivo (pill blu).
3. Clicca "Notte": conferma il ritorno al tema scuro.
4. Naviga su `/scheda` e `/dieta` con tema chiaro attivo: conferma che le card esercizio/pasto abbiano sfondo bianco, testo leggibile, e che i pulsanti pieni (es. "Completa allenamento", spunte set/pasto) abbiano testo bianco leggibile sul blu (non nero invisibile).
5. Ricarica la pagina (F5) con tema chiaro attivo: conferma che non ci sia flash del tema scuro prima che appaia quello chiaro.

Questo passo non e' automatizzabile (nessuna suite di regressione visiva nel progetto) — documenta nel report qualunque anomalia visiva trovata.

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/account/account.component.ts src/app/pages/account/account.component.html src/styles.css
git commit -m "feat: sezione Impostazioni in Account con toggle tema Notte/Giorno"
```

---

## Dopo l'ultimo task

Dispatch del final code-reviewer whole-branch (modello piu' capace disponibile) su tutto il branch, poi `superpowers:finishing-a-development-branch`.
