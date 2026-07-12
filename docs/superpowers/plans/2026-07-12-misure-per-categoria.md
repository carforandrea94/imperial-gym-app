# Card misure per categoria + edit storico con cambio data — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire il form unico "Misure" con 3 card per categoria (Peso, Centimetri, Pliche) che aprono una schermata dedicata di inserimento/modifica, e permettere dallo storico la modifica di una misurazione inclusa la sua data.

**Architettura:** Un componente riutilizzabile (`MisuraCategoriaComponent`, route `/misure/:categoria`) gestisce sia l'inserimento rapido di oggi sia — con `?date=` — la modifica di una voce storica per una sola categoria. Il modello dati resta una voce storico per data con tutti i campi; il servizio guadagna metodi mirati per leggere/scrivere solo i campi di una categoria, con una logica dedicata di collisione per lo spostamento tra date.

**Tech Stack:** Angular 21 standalone components, Firebase/Firestore JS SDK v9, Vitest.

## Global Constraints

- L'app gira **senza zone.js** (confermato in sessioni precedenti): qualunque stato aggiornato dentro un `await`/`setTimeout` che non passi attraverso una chiamata gia' avvolta da `ZoneFixService` deve chiamare esplicitamente `ChangeDetectorRef.detectChanges()` per essere visibile — pattern gia' usato in `history-list.component.ts`, `misure-storico.component.ts`, `misure-storico-detail.component.ts`.
- Copy UI in italiano, coerente con il resto dell'app.
- Nessuna nuova classe CSS: riusare `infocard`, `measure-card`, `measure-grid`, `measure-field`, `measure-input-wrap`, `unit`, `savebar`, `savebtn`, `autherror`, `sectiontitle`, `history-empty`, `daycard`, `badge`, `info`, `lbl`, `chev`, `grouplist`, `press-fx` (tutte gia' definite in `src/styles.css`).
- Route dinamiche (`misure/:categoria`) vanno dichiarate **dopo** le route statiche sorelle (`misure/storico`, `misure/analytics`) nell'array di `app.routes.ts`, altrimenti intercetterebbero quei path per errore.
- Convenzione di test del progetto: nessun test automatico per UI/routing (verifica tramite `tsc`/`ng build`/`ng test` esistenti). Eccezione: la logica di spostamento/collisione tra date in `moveCategoryEntry` e' l'unico punto realmente rischioso di questa feature (rischio di perdita silenziosa di dati storici) e riceve test mirati in TDD.
- Verifica ad ogni task: `npx tsc --noEmit -p tsconfig.app.json`, `npx ng test --watch=false`, `npx ng build`.
- Commit in italiano, prefissi `feat:`/`fix:`/`docs:` coerenti con lo storico del progetto.

---

### Task 1: Modello misure per categoria + aggiornamento pagine esistenti che lo usano

**Files:**
- Modify: `src/app/models/measurement.model.ts`
- Modify: `src/app/pages/misure-analytics/misure-analytics.component.ts`
- Modify: `src/app/pages/misure-analytics/misure-analytics.component.html`
- Modify: `src/app/pages/misure-storico-detail/misure-storico-detail.component.ts`
- Modify: `src/app/pages/misure-storico-detail/misure-storico-detail.component.html`
- Modify: `src/app/pages/misure/misure.component.ts`
- Modify: `src/app/pages/misure/misure.component.html`

**Interfaces:**
- Produces: `MeasureCategory = 'peso' | 'centimetri' | 'pliche'`; `PESO_FIELDS`, `PLICHE_FIELDS`, `CENTIMETRI_FIELDS: MeasureField[]`; `CATEGORY_FIELDS: Record<MeasureCategory, MeasureField[]>`; `CATEGORY_LABELS: Record<MeasureCategory, string>`; `CATEGORY_UNIT_BADGE: Record<MeasureCategory, string>`; `ALL_MEASURE_FIELDS` (invariato nel comportamento, ora senza `altezza`).
- Consumes: nessuna dipendenza da task precedenti (primo task).

- [ ] **Step 1: Riscrivere il modello misure**

Sostituire interamente il contenuto di `src/app/models/measurement.model.ts`:

```ts
export interface MeasurementEntry {
  date: string; // ISO yyyy-mm-dd
  peso: string | null;
  plicaPetto: string | null;
  plicaAddome: string | null;
  plicaVita: string | null;
  plicaGambaSx: string | null;
  plicaGambaDx: string | null;
  cmPetto: string | null;
  cmAddome: string | null;
  cmVita: string | null;
  cmGambaSx: string | null;
  cmGambaDx: string | null;
  cmBicipiteSx: string | null;
  cmBicipiteDx: string | null;
  cmPolpaccioSx: string | null;
  cmPolpaccioDx: string | null;
  cmCavigliaSx: string | null;
  cmCavigliaDx: string | null;
}

export type MeasurementKey = Exclude<keyof MeasurementEntry, 'date'>;

export interface MeasureField {
  key: MeasurementKey;
  label: string;
  unit: string;
}

export type MeasureCategory = 'peso' | 'centimetri' | 'pliche';

export const PESO_FIELDS: MeasureField[] = [
  { key: 'peso', label: 'Peso', unit: 'kg' }
];

export const PLICHE_FIELDS: MeasureField[] = [
  { key: 'plicaPetto', label: 'Plica petto', unit: 'mm' },
  { key: 'plicaAddome', label: 'Plica addome', unit: 'mm' },
  { key: 'plicaVita', label: 'Plica vita', unit: 'mm' },
  { key: 'plicaGambaSx', label: 'Plica gamba Sx', unit: 'mm' },
  { key: 'plicaGambaDx', label: 'Plica gamba Dx', unit: 'mm' }
];

export const CENTIMETRI_FIELDS: MeasureField[] = [
  { key: 'cmPetto', label: 'Petto', unit: 'cm' },
  { key: 'cmAddome', label: 'Addome', unit: 'cm' },
  { key: 'cmVita', label: 'Vita', unit: 'cm' },
  { key: 'cmGambaSx', label: 'Gamba Sx', unit: 'cm' },
  { key: 'cmGambaDx', label: 'Gamba Dx', unit: 'cm' },
  { key: 'cmBicipiteSx', label: 'Bicipite Sx', unit: 'cm' },
  { key: 'cmBicipiteDx', label: 'Bicipite Dx', unit: 'cm' },
  { key: 'cmPolpaccioSx', label: 'Polpaccio Sx', unit: 'cm' },
  { key: 'cmPolpaccioDx', label: 'Polpaccio Dx', unit: 'cm' },
  { key: 'cmCavigliaSx', label: 'Caviglia Sx', unit: 'cm' },
  { key: 'cmCavigliaDx', label: 'Caviglia Dx', unit: 'cm' }
];

export const CATEGORY_FIELDS: Record<MeasureCategory, MeasureField[]> = {
  peso: PESO_FIELDS,
  centimetri: CENTIMETRI_FIELDS,
  pliche: PLICHE_FIELDS
};

export const CATEGORY_LABELS: Record<MeasureCategory, string> = {
  peso: 'Peso',
  centimetri: 'Centimetri',
  pliche: 'Pliche'
};

export const CATEGORY_UNIT_BADGE: Record<MeasureCategory, string> = {
  peso: 'kg',
  centimetri: 'cm',
  pliche: 'mm'
};

export const ALL_MEASURE_FIELDS: MeasureField[] = [
  ...PESO_FIELDS, ...PLICHE_FIELDS, ...CENTIMETRI_FIELDS
];

export function emptyMeasurementEntry(date: string): MeasurementEntry {
  const entry = { date } as MeasurementEntry;
  ALL_MEASURE_FIELDS.forEach(f => { (entry as any)[f.key] = null; });
  return entry;
}
```

Nota: il campo `altezza` viene rimosso perche' non e' referenziato in nessun altro punto del codebase (nessun calcolo BMI o simile). Documenti storici gia' salvati su Firestore possono ancora contenere un valore `altezza`: Firestore e' schemaless, non causa errori, semplicemente non viene piu' letto ne' scritto.

- [ ] **Step 2: Aggiornare `misure-analytics.component.ts`**

In `src/app/pages/misure-analytics/misure-analytics.component.ts`, sostituire il blocco import (righe 5-11):

```ts
import {
  MeasureField,
  MeasurementKey,
  PESO_FIELDS,
  PLICHE_FIELDS,
  CENTIMETRI_FIELDS
} from '../../models/measurement.model';
```

E sostituire (righe 80-82):

```ts
      this.group1 = buildGroup(PESO_FIELDS);
      this.group2 = buildGroup(PLICHE_FIELDS);
      this.group3 = buildGroup(CENTIMETRI_FIELDS);
```

(nessun'altra riga del file cambia: `group1[0].field` come fallback resta valido, ora con un solo campo `peso`).

- [ ] **Step 3: Rinominare i titoli sezione in `misure-analytics.component.html`**

In `src/app/pages/misure-analytics/misure-analytics.component.html`:
- riga 38: `<p class="sectiontitle">Corpo</p>` → `<p class="sectiontitle">Peso</p>`
- riga 64: `<p class="sectiontitle">Circonferenze</p>` → `<p class="sectiontitle">Centimetri</p>`
- riga 51 (`Pliche`) resta invariata.

- [ ] **Step 4: Aggiornare `misure-storico-detail.component.ts`**

In `src/app/pages/misure-storico-detail/misure-storico-detail.component.ts`, sostituire il blocco import (righe 6-12):

```ts
import {
  MeasurementEntry,
  MeasureField,
  PESO_FIELDS,
  PLICHE_FIELDS,
  CENTIMETRI_FIELDS
} from '../../models/measurement.model';
```

E sostituire (righe 68-70):

```ts
      this.rows1 = this.buildRows(PESO_FIELDS, this.entry, prev);
      this.rows2 = this.buildRows(PLICHE_FIELDS, this.entry, prev);
      this.rows3 = this.buildRows(CENTIMETRI_FIELDS, this.entry, prev);
```

- [ ] **Step 5: Rinominare i titoli sezione in `misure-storico-detail.component.html`**

In `src/app/pages/misure-storico-detail/misure-storico-detail.component.html`:
- riga 17: `<p class="sectiontitle">Corpo</p>` → `<p class="sectiontitle">Peso</p>`
- riga 49: `<p class="sectiontitle">Circonferenze</p>` → `<p class="sectiontitle">Centimetri</p>`
- riga 33 (`Pliche`) resta invariata.

- [ ] **Step 6: Riscrivere la pagina Misure come 3 card per categoria**

Sostituire interamente `src/app/pages/misure/misure.component.ts`:

```ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MeasureCategory, CATEGORY_LABELS, CATEGORY_UNIT_BADGE } from '../../models/measurement.model';

interface CategoryTile {
  id: MeasureCategory;
  label: string;
  badge: string;
}

@Component({
  selector: 'app-misure',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './misure.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class MisureComponent {
  categories: CategoryTile[] = (['peso', 'centimetri', 'pliche'] as MeasureCategory[]).map(id => ({
    id,
    label: CATEGORY_LABELS[id],
    badge: CATEGORY_UNIT_BADGE[id]
  }));

  constructor(private router: Router) {}

  goTo(id: MeasureCategory): void {
    this.router.navigate(['/misure', id]);
  }
}
```

Sostituire interamente `src/app/pages/misure/misure.component.html`:

```html
<p class="sectiontitle">Misure</p>
<div class="grouplist">
  <div class="daycard press-fx" *ngFor="let c of categories" (click)="goTo(c.id)">
    <div class="badge">{{ c.badge }}</div>
    <div class="info">
      <div class="lbl">{{ c.label }}</div>
    </div>
    <span class="chev">›</span>
  </div>
</div>
```

Questo rimuove da questa pagina ogni dipendenza da `MeasurementDataService`/`FormsModule`/bozze: quella logica si sposta interamente nel nuovo componente categoria (Task 4). Il metodo `goToHistory()` del vecchio file viene eliminato: non era referenziato da nessun template (era gia' morto — la navigazione allo storico passa dalla barra in alto in `app.ts`).

- [ ] **Step 7: Verificare che il progetto compili**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: nessun errore. (Il servizio `measurement-data.service.ts` mantiene ancora `saveEntry()`/`loadDraft()`/`saveDraft()`/`clearDraft()` con le vecchie firme senza argomenti: restano temporaneamente senza chiamanti, non e' un errore di compilazione. Verranno rimossi/sostituiti nel Task 3.)

Run: `npx ng test --watch=false`
Expected: 29/29 test passati (nessuno di questi file e' coperto da test automatici oggi).

Run: `npx ng build`
Expected: build completata senza errori.

- [ ] **Step 8: Commit**

```bash
git add src/app/models/measurement.model.ts \
  src/app/pages/misure-analytics/misure-analytics.component.ts \
  src/app/pages/misure-analytics/misure-analytics.component.html \
  src/app/pages/misure-storico-detail/misure-storico-detail.component.ts \
  src/app/pages/misure-storico-detail/misure-storico-detail.component.html \
  src/app/pages/misure/misure.component.ts \
  src/app/pages/misure/misure.component.html
git commit -m "feat: modello misure per categoria (Peso/Centimetri/Pliche), rimuove altezza, pagina Misure a 3 card"
```

---

### Task 2: Bozza per categoria in AppStateService

**Files:**
- Modify: `src/app/services/app-state.service.ts:17`

**Interfaces:**
- Consumes: nessuno.
- Produces: `AppState.measureDraft: Record<string, Record<string, string | null>> | null` (era `Record<string, string | null> | null`) — usato dal Task 3 tramite `patchField('measureDraft.<categoria>', ...)` / `deleteFieldPath('measureDraft.<categoria>')`, gia' esistenti su `AppStateService` e invariati.

- [ ] **Step 1: Cambiare il tipo del campo `measureDraft`**

In `src/app/services/app-state.service.ts`, riga 17, sostituire:

```ts
  measureDraft: Record<string, string | null> | null;
```

con:

```ts
  measureDraft: Record<string, Record<string, string | null>> | null;
```

(`emptyState()` gia' imposta `measureDraft: null`, resta valido con il nuovo tipo. `patchField`/`deleteFieldPath` sono generici su dot-path e non richiedono modifiche.)

- [ ] **Step 2: Verificare la compilazione**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add src/app/services/app-state.service.ts
git commit -m "feat: bozza misure per categoria invece di bozza unica condivisa"
```

---

### Task 3: Metodi per categoria in MeasurementDataService (con test TDD sullo spostamento tra date)

**Files:**
- Modify: `src/app/services/measurement-data.service.ts`
- Create: `src/app/services/measurement-data.service.spec.ts`

**Interfaces:**
- Consumes: `AppState.measureDraft: Record<string, Record<string, string | null>> | null` (Task 2); `MeasureCategory`, `CATEGORY_FIELDS`, `ALL_MEASURE_FIELDS`, `MeasurementEntry`, `MeasurementKey` (Task 1).
- Produces (usati dal Task 4):
  - `loadDraft(category: MeasureCategory): Promise<Record<string, string | null> | null>`
  - `saveDraft(category: MeasureCategory, values: Record<string, string | null>): Promise<void>`
  - `clearDraft(category: MeasureCategory): Promise<void>`
  - `getCategoryValues(category: MeasureCategory, date: string): Promise<Record<string, string | null>>`
  - `saveCategoryToday(category: MeasureCategory, values: Record<string, string | null>): Promise<boolean>`
  - `moveCategoryEntry(category: MeasureCategory, oldDate: string, newDate: string, values: Record<string, string | null>): Promise<'ok' | 'collision' | 'error'>`
  - `loadHistory()`, `deleteEntry()`, `getLastValues()`, `getPreviousEntry()`, `buildTrendSVG()` invariati (gia' usati da altre pagine).
- Rimuove: `saveEntry()` (nessun chiamante rimasto dopo il Task 1), `loadDraft()`/`saveDraft()`/`clearDraft()` senza argomenti (sostituiti dalle versioni per categoria sopra).

- [ ] **Step 1: Scrivere il test che fallisce per lo spostamento senza collisioni**

Creare `src/app/services/measurement-data.service.spec.ts`:

```ts
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockDocs = new Map<string, any>();

vi.mock('firebase/firestore', () => ({
  collection: (_db: any, ...segments: string[]) => ({ path: segments.join('/') }),
  doc: (_col: any, id: string) => ({ id }),
  getDoc: async (ref: { id: string }) => {
    const data = mockDocs.get(ref.id);
    return { exists: () => data !== undefined, data: () => data };
  },
  getDocs: async () => ({
    docs: Array.from(mockDocs.entries()).map(([id, data]) => ({ id, data: () => data }))
  }),
  setDoc: async (ref: { id: string }, data: any, opts?: { merge?: boolean }) => {
    const existing = mockDocs.get(ref.id) ?? {};
    mockDocs.set(ref.id, opts?.merge ? { ...existing, ...data } : data);
  },
  updateDoc: async (ref: { id: string }, data: any) => {
    const existing = mockDocs.get(ref.id) ?? {};
    mockDocs.set(ref.id, { ...existing, ...data });
  },
  deleteDoc: async (ref: { id: string }) => {
    mockDocs.delete(ref.id);
  }
}));

import { MeasurementDataService } from './measurement-data.service';

describe('MeasurementDataService.moveCategoryEntry', () => {
  let service: MeasurementDataService;

  beforeEach(() => {
    mockDocs.clear();
    const fbStub = { db: {} } as any;
    const authStub = { currentUser: () => ({ uid: 'u1' }) } as any;
    const appStateStub = {} as any;
    const zoneFixStub = { run: (p: Promise<any>) => p } as any;
    service = new MeasurementDataService(fbStub, authStub, appStateStub, zoneFixStub);
  });

  it('sposta i campi della categoria in una nuova data senza collisioni, pulendo l\'origine', async () => {
    mockDocs.set('2026-07-01', { date: '2026-07-01', peso: '80', cmVita: '90' });

    const result = await service.moveCategoryEntry('peso', '2026-07-01', '2026-07-05', { peso: '80' });

    expect(result).toBe('ok');
    expect(mockDocs.get('2026-07-05')).toMatchObject({ peso: '80' });
    expect(mockDocs.get('2026-07-01')).toMatchObject({ peso: null, cmVita: '90' });
  });

  it('blocca lo spostamento se la data di destinazione ha gia\' valori della stessa categoria', async () => {
    mockDocs.set('2026-07-01', { date: '2026-07-01', peso: '80' });
    mockDocs.set('2026-07-05', { date: '2026-07-05', peso: '82' });

    const result = await service.moveCategoryEntry('peso', '2026-07-01', '2026-07-05', { peso: '80' });

    expect(result).toBe('collision');
    expect(mockDocs.get('2026-07-01')).toMatchObject({ peso: '80' });
    expect(mockDocs.get('2026-07-05')).toMatchObject({ peso: '82' });
  });

  it('elimina la voce di origine se resta senza valori in nessuna categoria dopo lo spostamento', async () => {
    mockDocs.set('2026-07-01', { date: '2026-07-01', peso: '80' });

    await service.moveCategoryEntry('peso', '2026-07-01', '2026-07-05', { peso: '80' });

    expect(mockDocs.has('2026-07-01')).toBe(false);
  });

  it('con la stessa data, aggiorna solo i campi della categoria senza toccare le altre', async () => {
    mockDocs.set('2026-07-01', { date: '2026-07-01', peso: '80', cmVita: '90' });

    const result = await service.moveCategoryEntry('peso', '2026-07-01', '2026-07-01', { peso: '81' });

    expect(result).toBe('ok');
    expect(mockDocs.get('2026-07-01')).toMatchObject({ peso: '81', cmVita: '90' });
  });
});
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npx ng test --watch=false`
Expected: FAIL — `measurement-data.service.spec.ts` fallisce (il metodo `moveCategoryEntry` non esiste ancora sul servizio).

- [ ] **Step 3: Riscrivere `measurement-data.service.ts`**

Sostituire interamente `src/app/services/measurement-data.service.ts` (la sola sezione `buildTrendSVG`/`formatAxisNum`/`formatShortDate` resta identica a quella esistente, copiata qui invariata):

```ts
import { Injectable } from '@angular/core';
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection } from 'firebase/firestore';
import { FirebaseService } from '../core/services/firebase.service';
import { AuthService } from '../core/services/auth.service';
import { AppStateService } from './app-state.service';
import {
  MeasurementEntry,
  MeasurementKey,
  MeasureCategory,
  CATEGORY_FIELDS,
  ALL_MEASURE_FIELDS
} from '../models/measurement.model';
import { ZoneFixService } from '../core/utils/zone.util';
import { todayLocalISO } from '../core/utils/date.util';

/**
 * Dati misure su Firestore:
 * - storico: users/{uid}/measurements/{isoDate}
 * - bozza in corso: campo measureDraft.{categoria} del doc users/{uid}/state/app
 */
@Injectable({ providedIn: 'root' })
export class MeasurementDataService {

  constructor(
    private fb: FirebaseService,
    private auth: AuthService,
    private appState: AppStateService,
    private zoneFix: ZoneFixService
  ) {}

  private col() {
    const uid = this.auth.currentUser()!.uid;
    return collection(this.fb.db, 'users', uid, 'measurements');
  }

  async loadDraft(category: MeasureCategory): Promise<Record<string, string | null> | null> {
    const state = await this.appState.load();
    return state.measureDraft?.[category] ?? null;
  }

  async saveDraft(category: MeasureCategory, values: Record<string, string | null>): Promise<void> {
    await this.appState.patchField(`measureDraft.${category}`, values);
  }

  async clearDraft(category: MeasureCategory): Promise<void> {
    await this.appState.deleteFieldPath(`measureDraft.${category}`);
  }

  /** Tutte le voci storiche, ordinate dalla piu' recente. */
  loadHistory(): Promise<MeasurementEntry[]> {
    return this.zoneFix.run((async () => {
      const snap = await getDocs(this.col());
      return snap.docs
        .map(d => d.data() as MeasurementEntry)
        .sort((a, b) => b.date.localeCompare(a.date));
    })());
  }

  deleteEntry(date: string): Promise<boolean> {
    return this.zoneFix.run((async () => {
      try {
        await deleteDoc(doc(this.col(), date));
        return true;
      } catch {
        return false;
      }
    })());
  }

  /** Per ogni campo, l'ultimo valore registrato nello storico (per i placeholder in form). */
  async getLastValues(): Promise<Partial<Record<MeasurementKey, string>>> {
    const history = await this.loadHistory();
    const out: Partial<Record<MeasurementKey, string>> = {};
    for (const field of ALL_MEASURE_FIELDS) {
      for (const entry of history) {
        const v = entry[field.key];
        if (v) { out[field.key] = v; break; }
      }
    }
    return out;
  }

  /** L'ultima voce storica precedente a una certa data (per calcolare le variazioni). */
  async getPreviousEntry(beforeDate?: string): Promise<MeasurementEntry | null> {
    const history = await this.loadHistory();
    if (!beforeDate) return history[0] ?? null;
    return history.find(e => e.date < beforeDate) ?? null;
  }

  /** I soli campi di una categoria per una data specifica (per precompilare il form di modifica). */
  async getCategoryValues(category: MeasureCategory, date: string): Promise<Record<string, string | null>> {
    const history = await this.loadHistory();
    const entry = history.find(e => e.date === date);
    const out: Record<string, string | null> = {};
    for (const f of CATEGORY_FIELDS[category]) {
      out[f.key] = entry?.[f.key] ?? null;
    }
    return out;
  }

  /** Unisce i campi di una categoria nella voce storico di oggi (la crea se non esiste). */
  saveCategoryToday(category: MeasureCategory, values: Record<string, string | null>): Promise<boolean> {
    return this.zoneFix.run((async () => {
      try {
        const date = todayLocalISO();
        await setDoc(doc(this.col(), date), { date, ...values }, { merge: true });
        return true;
      } catch {
        return false;
      }
    })());
  }

  /**
   * Salva i campi di una categoria per una data che puo' essere diversa da
   * quella originale della voce (modifica dallo storico con cambio data).
   * - Stessa data: aggiorna solo i campi di questa categoria in quella voce.
   * - Data diversa: se la voce di destinazione ha gia' valori non nulli per
   *   questa categoria, l'operazione viene bloccata ('collision') per non
   *   sovrascrivere dati esistenti. Altrimenti scrive i campi nella voce di
   *   destinazione (merge) e li rimuove da quella di origine, eliminando
   *   quest'ultima se resta priva di valori in ogni categoria.
   */
  moveCategoryEntry(
    category: MeasureCategory,
    oldDate: string,
    newDate: string,
    values: Record<string, string | null>
  ): Promise<'ok' | 'collision' | 'error'> {
    return this.zoneFix.run((async () => {
      try {
        if (oldDate === newDate) {
          await setDoc(doc(this.col(), newDate), { date: newDate, ...values }, { merge: true });
          return 'ok';
        }

        const targetSnap = await getDoc(doc(this.col(), newDate));
        if (targetSnap.exists()) {
          const targetData = targetSnap.data() as MeasurementEntry;
          const hasCollision = CATEGORY_FIELDS[category].some(f => !!targetData[f.key]);
          if (hasCollision) return 'collision';
        }

        await setDoc(doc(this.col(), newDate), { date: newDate, ...values }, { merge: true });

        const oldSnap = await getDoc(doc(this.col(), oldDate));
        if (oldSnap.exists()) {
          const oldData = oldSnap.data() as MeasurementEntry;
          const cleared: Partial<Record<MeasurementKey, null>> = {};
          CATEGORY_FIELDS[category].forEach(f => { cleared[f.key] = null; });
          const remaining = { ...oldData, ...cleared };
          const stillHasValues = ALL_MEASURE_FIELDS.some(f => !!remaining[f.key]);
          if (stillHasValues) {
            await updateDoc(doc(this.col(), oldDate), cleared as any);
          } else {
            await deleteDoc(doc(this.col(), oldDate));
          }
        }

        return 'ok';
      } catch (e) {
        console.error('Errore spostamento misurazione:', e);
        return 'error';
      }
    })());
  }

  /**
   * Genera un grafico a linea SVG per l'andamento di un campo nel tempo.
   * points: array di {date, value} gia' ordinato dal piu' vecchio al piu' recente.
   */
  buildTrendSVG(points: { date: string; value: number }[]): string {
    const w = 340, h = 180;
    const padL = 40, padR = 14, padT = 18, padB = 26;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;

    const values = points.map(p => p.value);
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (min === max) { min -= 1; max += 1; }
    const range = max - min;

    const coords = points.map((p, i) => ({
      x: padL + (points.length === 1 ? innerW / 2 : innerW * (i / (points.length - 1))),
      y: padT + innerH - innerH * ((p.value - min) / range)
    }));

    const linePts = coords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
    const areaPts = `${padL.toFixed(1)},${(padT + innerH).toFixed(1)} ${linePts} ${(padL + innerW).toFixed(1)},${(padT + innerH).toFixed(1)}`;

    const dots = coords.map((c, i) => {
      const isLast = i === coords.length - 1;
      return `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${isLast ? 4 : 2.5}" fill="${isLast ? 'var(--accent)' : 'var(--label-2)'}" stroke="var(--bg)" stroke-width="1.5"/>`;
    }).join('');

    const gridYs = [padT, padT + innerH / 2, padT + innerH];
    const gridLabels = [max, (max + min) / 2, min];
    const grid = gridYs.map((gy, i) => `
      <line x1="${padL}" y1="${gy.toFixed(1)}" x2="${padL + innerW}" y2="${gy.toFixed(1)}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
      <text x="${(padL - 8).toFixed(1)}" y="${(gy + 3).toFixed(1)}" text-anchor="end" font-family="IBM Plex Mono, monospace" font-size="9.5" fill="var(--label-3)">${this.formatAxisNum(gridLabels[i])}</text>
    `).join('');

    const firstDate = this.formatShortDate(points[0].date);
    const lastDate = this.formatShortDate(points[points.length - 1].date);
    const xLabels = `
      <text x="${padL}" y="${h - 6}" text-anchor="start" font-family="IBM Plex Mono, monospace" font-size="9.5" fill="var(--label-3)">${firstDate}</text>
      <text x="${padL + innerW}" y="${h - 6}" text-anchor="end" font-family="IBM Plex Mono, monospace" font-size="9.5" fill="var(--label-3)">${lastDate}</text>
    `;

    return `<svg width="100%" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${grid}
      <polygon points="${areaPts}" fill="url(#trendFill)"/>
      <polyline points="${linePts}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}
      ${xLabels}
    </svg>`;
  }

  private formatAxisNum(n: number): string {
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  }

  private formatShortDate(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  }
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npx ng test --watch=false`
Expected: PASS — tutti i test, inclusi i 4 nuovi in `measurement-data.service.spec.ts` (33/33 totali).

- [ ] **Step 5: Verificare tsc e build**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: nessun errore.

Run: `npx ng build`
Expected: build completata senza errori.

- [ ] **Step 6: Commit**

```bash
git add src/app/services/measurement-data.service.ts src/app/services/measurement-data.service.spec.ts
git commit -m "feat: metodi per categoria in MeasurementDataService, con test sullo spostamento/collisione tra date"
```

---

### Task 4: Schermata categoria (inserimento rapido + modifica storico) e routing

**Files:**
- Create: `src/app/pages/misura-categoria/misura-categoria.component.ts`
- Create: `src/app/pages/misura-categoria/misura-categoria.component.html`
- Modify: `src/app/app.routes.ts`
- Modify: `src/app/app.ts`

**Interfaces:**
- Consumes: `MeasurementDataService.{getCategoryValues, saveCategoryToday, moveCategoryEntry, loadDraft, saveDraft, clearDraft, getLastValues}` (Task 3); `MeasureCategory, MeasureField, CATEGORY_FIELDS, CATEGORY_LABELS` (Task 1); `todayLocalISO()` (esistente, `core/utils/date.util.ts`).
- Produces: route `/misure/:categoria` (con query param opzionale `date`); usata dal Task 5 per il link "Modifica" dallo storico.

- [ ] **Step 1: Creare il componente `MisuraCategoriaComponent`**

Creare `src/app/pages/misura-categoria/misura-categoria.component.ts`:

```ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { MeasurementDataService } from '../../services/measurement-data.service';
import { todayLocalISO } from '../../core/utils/date.util';
import { MeasureCategory, MeasureField, CATEGORY_FIELDS, CATEGORY_LABELS } from '../../models/measurement.model';

@Component({
  selector: 'app-misura-categoria',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './misura-categoria.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class MisuraCategoriaComponent implements OnInit, OnDestroy {
  category!: MeasureCategory;
  fields: MeasureField[] = [];
  title = '';

  isEdit = false;
  originalDate = '';
  dateValue = '';
  maxDate = todayLocalISO();

  values: Record<string, string | null> = {};
  placeholders: Record<string, string> = {};

  saveStatus: 'idle' | 'err' = 'idle';
  errorMsg = '';
  loading = true;

  private draftTimer: ReturnType<typeof setTimeout> | null = null;
  private paramSub: Subscription | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private data: MeasurementDataService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.paramSub = this.route.paramMap.subscribe(params => {
      this.category = params.get('categoria') as MeasureCategory;
      this.fields = CATEGORY_FIELDS[this.category];
      this.title = CATEGORY_LABELS[this.category];
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.paramSub?.unsubscribe();
    if (this.draftTimer) clearTimeout(this.draftTimer);
  }

  private emptyValues(): Record<string, string | null> {
    const out: Record<string, string | null> = {};
    this.fields.forEach(f => { out[f.key] = null; });
    return out;
  }

  async load(): Promise<void> {
    this.loading = true;
    this.errorMsg = '';
    const dateParam = this.route.snapshot.queryParamMap.get('date');
    this.isEdit = !!dateParam;

    try {
      if (this.isEdit) {
        this.originalDate = dateParam!;
        this.dateValue = dateParam!;
        this.values = await this.data.getCategoryValues(this.category, dateParam!);
      } else {
        this.dateValue = todayLocalISO();
        this.values = this.emptyValues();
        const lastValues = await this.data.getLastValues();
        this.placeholders = {};
        this.fields.forEach(f => { if (lastValues[f.key]) this.placeholders[f.key] = lastValues[f.key]!; });
        const draft = await this.data.loadDraft(this.category);
        if (draft) this.values = draft;
      }
    } catch (e: any) {
      console.error('Errore caricamento misura:', e);
      this.errorMsg = 'Errore nel caricamento. Riprova.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  onInput(): void {
    if (this.isEdit) return;
    if (this.draftTimer) clearTimeout(this.draftTimer);
    this.draftTimer = setTimeout(() => this.data.saveDraft(this.category, this.values), 500);
  }

  hasAnyValue(): boolean {
    return this.fields.some(f => !!this.values[f.key]);
  }

  getSaveBtnClass(): string {
    return this.saveStatus === 'err' ? 'savebtn err' : 'savebtn';
  }

  getSaveBtnText(): string {
    return this.saveStatus === 'err' ? '✕ Errore salvataggio' : 'Salva';
  }

  async save(): Promise<void> {
    if (!this.hasAnyValue()) return;
    if (this.dateValue > this.maxDate) {
      this.errorMsg = 'Non puoi registrare una misurazione in una data futura.';
      this.cdr.detectChanges();
      return;
    }
    if (this.draftTimer) { clearTimeout(this.draftTimer); this.draftTimer = null; }
    this.errorMsg = '';

    if (!this.isEdit) {
      const ok = await this.data.saveCategoryToday(this.category, this.values);
      if (ok) {
        await this.data.clearDraft(this.category);
        this.router.navigate(['/misure']);
      } else {
        this.saveStatus = 'err';
        this.cdr.detectChanges();
        setTimeout(() => { this.saveStatus = 'idle'; this.cdr.detectChanges(); }, 2000);
      }
      return;
    }

    const result = await this.data.moveCategoryEntry(this.category, this.originalDate, this.dateValue, this.values);
    if (result === 'ok') {
      this.router.navigate(['/misure/storico', this.dateValue]);
    } else if (result === 'collision') {
      this.errorMsg = 'Esiste gia\' una misurazione di questo tipo in questa data.';
      this.cdr.detectChanges();
    } else {
      this.saveStatus = 'err';
      this.cdr.detectChanges();
      setTimeout(() => { this.saveStatus = 'idle'; this.cdr.detectChanges(); }, 2000);
    }
  }
}
```

Creare `src/app/pages/misura-categoria/misura-categoria.component.html`:

```html
<div *ngIf="loading" class="history-empty">Caricamento…</div>

<ng-container *ngIf="!loading">
  <p class="sectiontitle">{{ title }}</p>

  <div class="infocard measure-card" *ngIf="isEdit">
    <div class="measure-field">
      <label>Data</label>
      <div class="measure-input-wrap">
        <input type="date" [(ngModel)]="dateValue" [max]="maxDate" />
      </div>
    </div>
  </div>

  <div class="infocard measure-card">
    <div class="measure-grid cols-2">
      <div class="measure-field" *ngFor="let f of fields">
        <label>{{ f.label }}</label>
        <div class="measure-input-wrap">
          <input type="text" inputmode="decimal"
            [(ngModel)]="values[f.key]"
            [placeholder]="placeholders[f.key] ?? '—'"
            (input)="onInput()" />
          <span class="unit">{{ f.unit }}</span>
        </div>
      </div>
    </div>
  </div>

  <p class="autherror" *ngIf="errorMsg">{{ errorMsg }}</p>

  <div class="savebar">
    <button [class]="getSaveBtnClass()" (click)="save()">
      {{ getSaveBtnText() }}
    </button>
  </div>
</ng-container>
```

- [ ] **Step 2: Aggiungere la route**

In `src/app/app.routes.ts`, inserire dopo il blocco `misure/analytics` (e prima di `misure/storico/:key`):

```ts
  {
    path: 'misure/:categoria',
    canActivate: [authGuard, clientGuard],
    loadComponent: () => import('./pages/misura-categoria/misura-categoria.component').then(m => m.MisuraCategoriaComponent)
  },
```

- [ ] **Step 3: Titolo/back della barra superiore per la nuova route**

In `src/app/app.ts`, aggiungere l'import:

```ts
import { CATEGORY_LABELS, MeasureCategory } from './models/measurement.model';
```

In `updateNav()`, subito dopo il blocco `if (u === '/misure/analytics') { ... return; }`, aggiungere:

```ts
    const categoriaMatch = u.match(/^\/misure\/(peso|centimetri|pliche)$/);
    if (categoriaMatch) {
      const isEdit = /[?&]date=/.test(url);
      this.navTitle = CATEGORY_LABELS[categoriaMatch[1] as MeasureCategory];
      this.navSubtitle = isEdit ? 'Modifica misurazione' : 'Nuova misurazione';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      return;
    }
```

In `onBack()`, subito dopo il blocco `} else if (u === '/misure/storico' || u === '/misure/analytics') { this.router.navigate(['/misure']); }`, aggiungere:

```ts
    } else if (/^\/misure\/(peso|centimetri|pliche)$/.test(u)) {
      this.router.navigate(this.router.url.includes('date=') ? ['/misure/storico'] : ['/misure']);
```

(la struttura `if/else if` esistente resta altrimenti invariata — questo e' un ramo `else if` aggiuntivo nella stessa catena).

- [ ] **Step 4: Verificare tsc, test, build**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: nessun errore.

Run: `npx ng test --watch=false`
Expected: 33/33 test passati (invariato, nessun nuovo test in questo task).

Run: `npx ng build`
Expected: build completata senza errori.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/misura-categoria/misura-categoria.component.ts \
  src/app/pages/misura-categoria/misura-categoria.component.html \
  src/app/app.routes.ts src/app/app.ts
git commit -m "feat: schermata categoria per inserimento rapido e modifica misura con cambio data"
```

---

### Task 5: Azione "Modifica" per categoria nello storico

**Files:**
- Modify: `src/app/pages/misure-storico-detail/misure-storico-detail.component.ts`
- Modify: `src/app/pages/misure-storico-detail/misure-storico-detail.component.html`

**Interfaces:**
- Consumes: route `/misure/:categoria?date=` (Task 4); `MeasureCategory` (Task 1).
- Produces: nessuna nuova interfaccia per altri task (ultimo task del piano).

- [ ] **Step 1: Aggiungere `editCategory()` al componente**

In `src/app/pages/misure-storico-detail/misure-storico-detail.component.ts`, aggiungere `MeasureCategory` all'import esistente del modello (dallo Step 4 del Task 1 l'import e' `MeasurementEntry, MeasureField, PESO_FIELDS, PLICHE_FIELDS, CENTIMETRI_FIELDS`):

```ts
import {
  MeasurementEntry,
  MeasureField,
  MeasureCategory,
  PESO_FIELDS,
  PLICHE_FIELDS,
  CENTIMETRI_FIELDS
} from '../../models/measurement.model';
```

Aggiungere il metodo, subito dopo `hasValue()`:

```ts
  editCategory(category: MeasureCategory): void {
    this.router.navigate(['/misure', category], { queryParams: { date: this.date } });
  }
```

- [ ] **Step 2: Aggiungere i pulsanti "Modifica" nel template**

In `src/app/pages/misure-storico-detail/misure-storico-detail.component.html`, in ciascuno dei 3 blocchi `*ngIf="hasValue(rowsN)"`, aggiungere un pulsante dopo la lista `measure-readrow`, subito prima della chiusura del `div.infocard measure-card`:

Blocco Peso (`rows1`):

```html
      <button class="savebtn" style="margin-top:12px" (click)="editCategory('peso')">Modifica peso</button>
```

Blocco Pliche (`rows2`):

```html
      <button class="savebtn" style="margin-top:12px" (click)="editCategory('pliche')">Modifica pliche</button>
```

Blocco Centimetri (`rows3`):

```html
      <button class="savebtn" style="margin-top:12px" (click)="editCategory('centimetri')">Modifica centimetri</button>
```

(ciascun pulsante va inserito subito dopo il `*ngFor` `measure-readrow` del proprio blocco e prima del tag di chiusura `</div>` dell'`infocard` — stesso pattern gia' usato altrove nel file per il pulsante "Riprova": `class="savebtn" style="margin-top:12px"`).

- [ ] **Step 3: Verificare tsc, test, build**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: nessun errore.

Run: `npx ng test --watch=false`
Expected: 33/33 test passati.

Run: `npx ng build`
Expected: build completata senza errori.

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/misure-storico-detail/misure-storico-detail.component.ts \
  src/app/pages/misure-storico-detail/misure-storico-detail.component.html
git commit -m "feat: azione Modifica per categoria nel dettaglio storico misure"
```

---

## Verifica finale (dopo tutti i task)

Dopo l'ultimo task, avviare il server di sviluppo e verificare manualmente nel browser (non solo tsc/build):
1. `/misure` mostra 3 card (Peso, Centimetri, Pliche).
2. Tap su ciascuna card apre `/misure/<categoria>`, permette di inserire valori e salvare; al salvataggio torna a `/misure` e i valori sono visibili nello storico del giorno.
3. Da `/misure/storico/<data>`, il pulsante "Modifica" di ciascuna categoria apre `/misure/<categoria>?date=<data>` con i valori precompilati e la data modificabile.
4. Cambiare la data di una misurazione verso una data libera la sposta correttamente; verso una data che ha gia' valori della stessa categoria mostra l'errore di collisione senza salvare.
5. La bozza automatica (digitare senza salvare, uscire, tornare) ripropone i valori non salvati in modalita' inserimento rapido.
