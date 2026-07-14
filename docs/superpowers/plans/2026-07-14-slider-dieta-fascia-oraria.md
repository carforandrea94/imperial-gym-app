# Slider Dieta per Fascia Oraria Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lo slider della schermata Dieta parte dal pasto corrispondente alla fascia oraria corrente (dedotta da parole chiave nel nome del pasto), invece di partire sempre dal primo pasto.

**Architecture:** Nuova utility pura `findCurrentMealIndex(meals, now?)` in `src/app/core/utils/meal-time.util.ts`, che confronta l'ora corrente (o quella passata nei test) contro 5 fasce orarie fisse e cerca tra i nomi dei pasti quello che contiene la parola chiave della fascia. `DietaDetailComponent` la richiama al posto dell'attuale `sliderIndex = 0` quando si entra in modalita' slider.

**Tech Stack:** Angular 21 standalone component, Vitest (`npx ng test`).

## Global Constraints

- Fasce orarie esatte (minuti dalla mezzanotte, copertura completa delle 24 ore senza buchi):
  - `colazione`: 05:00–10:29 (300–629)
  - `spuntino`: 10:30–11:59 (630–719)
  - `pranzo`: 12:00–15:29 (720–929)
  - `merenda`: 15:30–18:59 (930–1139)
  - `cena`: 19:00–04:59 del giorno dopo (1140–1439 e 0–299)
- Riconoscimento case-insensitive per sottostringa nel nome del pasto (es. "Colazione dolce" riconosce "colazione").
- Se nessun pasto ha un nome che corrisponde alla parola chiave della fascia corrente, restituisci l'indice `0` (stesso comportamento di oggi, nessuna regressione).
- Nessuna modifica al modello `Diet`/`NamedMeal`, nessuna nuova UI lato coach.
- Nessun nuovo test dedicato per `DietaDetailComponent` (convenzione del progetto: nessun file sotto `src/app/pages/**` ha uno `.spec.ts`); verifica tramite `npx tsc --noEmit -p tsconfig.app.json`, `npx ng test --watch=false`, `npx ng build`.

---

### Task 1: `findCurrentMealIndex` in `meal-time.util.ts` (TDD)

**Files:**
- Create: `src/app/core/utils/meal-time.util.ts`
- Create: `src/app/core/utils/meal-time.util.spec.ts`

**Interfaces:**
- Consumes: `NamedMeal` (gia' esistente, `src/app/models/diet.model.ts:37-42`, campo rilevante: `name: string`).
- Produces: `findCurrentMealIndex(meals: NamedMeal[], now?: Date): number` — usato dal Task 2 come `findCurrentMealIndex(this.plan?.meals ?? [])`.

- [ ] **Step 1: Scrivi i test falliti in `src/app/core/utils/meal-time.util.spec.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { findCurrentMealIndex } from './meal-time.util';
import { NamedMeal, newNamedMeal } from '../../models/diet.model';

function mealsWithNames(names: string[]): NamedMeal[] {
  return names.map(n => newNamedMeal(n));
}

describe('findCurrentMealIndex', () => {
  it('alle 08:00 sceglie il pasto che contiene "colazione"', () => {
    const meals = mealsWithNames(['Colazione', 'Pranzo', 'Cena']);
    const now = new Date(2026, 0, 1, 8, 0);
    expect(findCurrentMealIndex(meals, now)).toBe(0);
  });

  it('alle 13:00 sceglie il pasto che contiene "pranzo"', () => {
    const meals = mealsWithNames(['Colazione', 'Pranzo', 'Cena']);
    const now = new Date(2026, 0, 1, 13, 0);
    expect(findCurrentMealIndex(meals, now)).toBe(1);
  });

  it('alle 02:00 (dopo mezzanotte) sceglie il pasto che contiene "cena"', () => {
    const meals = mealsWithNames(['Colazione', 'Pranzo', 'Cena']);
    const now = new Date(2026, 0, 1, 2, 0);
    expect(findCurrentMealIndex(meals, now)).toBe(2);
  });

  it('riconosce la parola chiave anche come sottostringa del nome', () => {
    const meals = mealsWithNames(['Colazione dolce', 'Pranzo leggero']);
    const now = new Date(2026, 0, 1, 8, 0);
    expect(findCurrentMealIndex(meals, now)).toBe(0);
  });

  it('se nessun pasto ha un nome riconosciuto, restituisce 0', () => {
    const meals = mealsWithNames(['Pre-workout', 'Post-workout']);
    const now = new Date(2026, 0, 1, 8, 0);
    expect(findCurrentMealIndex(meals, now)).toBe(0);
  });

  it('con nessun pasto restituisce 0 senza lanciare errori', () => {
    const now = new Date(2026, 0, 1, 8, 0);
    expect(findCurrentMealIndex([], now)).toBe(0);
  });

  it('alle 18:00 sceglie il pasto che contiene "merenda"', () => {
    const meals = mealsWithNames(['Merenda', 'Cena']);
    const now = new Date(2026, 0, 1, 18, 0);
    expect(findCurrentMealIndex(meals, now)).toBe(0);
  });

  it('alle 11:00 sceglie il pasto che contiene "spuntino"', () => {
    const meals = mealsWithNames(['Colazione', 'Spuntino', 'Pranzo']);
    const now = new Date(2026, 0, 1, 11, 0);
    expect(findCurrentMealIndex(meals, now)).toBe(1);
  });
});
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `npx ng test --watch=false`
Expected: FAIL — il file `meal-time.util.ts` non esiste ancora (errore di import/modulo non trovato).

- [ ] **Step 3: Crea `src/app/core/utils/meal-time.util.ts`**

```ts
import { NamedMeal } from '../../models/diet.model';

interface TimeBand {
  keyword: string;
  startMinutes: number;
  endMinutes: number; // > 1440 per le fasce che attraversano la mezzanotte
}

const TIME_BANDS: TimeBand[] = [
  { keyword: 'colazione', startMinutes: 5 * 60, endMinutes: 10 * 60 + 29 },
  { keyword: 'spuntino', startMinutes: 10 * 60 + 30, endMinutes: 11 * 60 + 59 },
  { keyword: 'pranzo', startMinutes: 12 * 60, endMinutes: 15 * 60 + 29 },
  { keyword: 'merenda', startMinutes: 15 * 60 + 30, endMinutes: 18 * 60 + 59 },
  { keyword: 'cena', startMinutes: 19 * 60, endMinutes: 24 * 60 + 4 * 60 + 59 }
];

function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function inBand(minutes: number, band: TimeBand): boolean {
  if (band.endMinutes <= 24 * 60) {
    return minutes >= band.startMinutes && minutes <= band.endMinutes;
  }
  return minutes >= band.startMinutes || minutes <= band.endMinutes - 24 * 60;
}

/**
 * Trova l'indice del pasto la cui fascia oraria contiene l'orario attuale,
 * in base a una parola chiave nel nome del pasto. Se nessun pasto ha un
 * nome riconosciuto per la fascia corrente, restituisce 0.
 */
export function findCurrentMealIndex(meals: NamedMeal[], now: Date = new Date()): number {
  if (meals.length === 0) return 0;
  const minutes = minutesSinceMidnight(now);
  const band = TIME_BANDS.find(b => inBand(minutes, b));
  if (!band) return 0;
  const idx = meals.findIndex(m => m.name.toLowerCase().includes(band.keyword));
  return idx === -1 ? 0 : idx;
}
```

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `npx ng test --watch=false`
Expected: PASS — tutti gli 8 test in `meal-time.util.spec.ts` verdi, totale suite invariato piu' 8 nuovi test rispetto a prima di questo task.

- [ ] **Step 5: Verifica compilazione**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx ng build`
Expected: nessun errore.

- [ ] **Step 6: Commit**

```bash
git add src/app/core/utils/meal-time.util.ts src/app/core/utils/meal-time.util.spec.ts
git commit -m "feat: aggiunge findCurrentMealIndex per la fascia oraria dello slider dieta (TDD)"
```

---

### Task 2: integra `findCurrentMealIndex` in `DietaDetailComponent`

**Files:**
- Modify: `src/app/pages/dieta-detail/dieta-detail.component.ts:1-49`

**Interfaces:**
- Consumes: `findCurrentMealIndex(meals: NamedMeal[], now?: Date): number` (Task 1, gia' completato).
- Produces: nessuna nuova interfaccia — modifica solo il comportamento interno del costruttore, nessun consumer esterno.

Nessuno `.spec.ts` da creare per questo task (vedi Global Constraints).

- [ ] **Step 1: Aggiungi l'import e sostituisci la logica dell'`effect()` nel costruttore**

In `src/app/pages/dieta-detail/dieta-detail.component.ts`, aggiungi questo import insieme agli altri in cima al file:

```ts
import { findCurrentMealIndex } from '../../core/utils/meal-time.util';
```

Poi sostituisci il costruttore attuale:

```ts
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public dietData: DietDataService,
    public state: DietStateService,
    private cdr: ChangeDetectorRef
  ) {
    // Il toggle vive nella navbar (fuori da questa pagina): quando si passa
    // a "slider" da un'altra vista/pagina, riparte sempre dalla prima card.
    effect(() => {
      if (this.state.viewMode() === 'slider') {
        this.sliderIndex = 0;
        setTimeout(() => this.scrollToIndex(0), 0);
      }
    });
  }
```

con:

```ts
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public dietData: DietDataService,
    public state: DietStateService,
    private cdr: ChangeDetectorRef
  ) {
    // Il toggle vive nella navbar (fuori da questa pagina): quando si passa
    // a "slider" da un'altra vista/pagina, parte dal pasto della fascia
    // oraria corrente (findCurrentMealIndex), non sempre dalla prima card.
    effect(() => {
      if (this.state.viewMode() === 'slider') {
        this.sliderIndex = findCurrentMealIndex(this.plan?.meals ?? []);
        setTimeout(() => this.scrollToIndex(this.sliderIndex), 0);
      }
    });
  }
```

- [ ] **Step 2: Verifica compilazione e test invariati**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx ng test --watch=false && npx ng build`
Expected: nessun errore TypeScript; la suite di test riporta lo stesso numero di test verdi lasciato dal Task 1 (nessun test tocca `dieta-detail`, quindi il conteggio non deve cambiare); build completata senza errori.

- [ ] **Step 3: Verifica manuale (dev server)**

Run: `npx ng serve` (o equivalente gia' in uso), poi apri la schermata Dieta di un piano con piu' pasti (es. Colazione/Pranzo/Cena) in modalita' slider, all'ora corrente del dispositivo:
- Lo slider deve aprirsi gia' sulla card del pasto che corrisponde alla fascia oraria attuale (es. se sono le 13:00, deve aprirsi su "Pranzo").
- Cambiare manualmente slide deve continuare a funzionare come prima.
- Passare dalla vista lista alla vista slider (toggle in navbar) deve riapplicare la stessa logica (riparte dal pasto della fascia oraria corrente, non necessariamente dall'ultimo slide visitato).
- Un piano con pasti dai nomi non riconosciuti (es. solo "Pre-workout"/"Post-workout") deve continuare a partire dal primo pasto, senza errori in console.

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/dieta-detail/dieta-detail.component.ts
git commit -m "feat: lo slider dieta parte dal pasto della fascia oraria corrente"
```

---

## Self-Review Notes

- **Spec coverage:** 5 fasce orarie esatte, matching per sottostringa case-insensitive, fallback a 0 se nessun pasto riconosciuto, fascia "Cena" che attraversa la mezzanotte → tutti coperti dai test del Task 1. Integrazione nell'`effect()` esistente senza toccare altro comportamento del componente → Task 2. Nessuna modifica al modello `Diet`/`NamedMeal` ne' nuova UI coach → nessun task le tocca. Tutto coperto, nessun gap.
- **Placeholder scan:** nessun TBD/TODO; ogni step ha codice completo.
- **Type consistency:** `findCurrentMealIndex(meals: NamedMeal[], now?: Date): number` — stessa firma tra Task 1 (definizione, test) e Task 2 (uso in `dieta-detail.component.ts`). `NamedMeal` importato da `../../models/diet.model` in entrambi i task con lo stesso percorso relativo (verificato: `meal-time.util.ts` vive in `core/utils/`, stesso livello di profondita' di `dieta-detail.component.ts` in `pages/dieta-detail/`, quindi entrambi usano `../../models/diet.model`).
