# Sezione Integrazione nei pasti — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere una sezione "Integrazione" (nome + dose per riga) dopo "Grassi" in ogni pasto, visibile al cliente e modificabile dal coach nel builder, senza toccare alimenti/combinazioni/alternative esistenti.

**Architecture:** Nuovo campo opzionale `NamedMeal.supplements?: SupplementItem[]` (lista piatta nome+dose, non legata alle combinazioni/alternative esistenti). La vista cliente (`dieta-detail`) lo mostra in sola lettura dopo Grassi; l'editor coach (`coach-protocol-builder`) aggiunge righe con lo stesso pattern già usato per le alternative per macro (`addAltItem`/`removeAltItem`). Nessun parser PDF: i valori li inserisce il coach a mano.

**Tech Stack:** Angular 21 standalone components, template-driven forms (`ngModel`).

## Global Constraints

- Nessuna modifica a `FoodCategory` (`'carb'|'protein'|'fat'`), `MealCombination`, `MacroAlternatives`: restano esattamente come sono oggi.
- `newNamedMeal()` in `src/app/models/diet.model.ts` NON inizializza `supplements` (resta `undefined` finché il coach non aggiunge una voce) — coerente con campi opzionali analoghi già nel progetto (es. `Exercise.note`).
- Colore etichetta "Integrazione": `var(--sys-cyan)` (`#64D2FF`, già definita in `src/styles.css`, non usata da nessuna etichetta macro) — nessun nuovo colore da introdurre.
- Nessuna modifica a `src/app/services/pdf-import.service.ts` — deciso esplicitamente di non costruire un parser automatico per il PDF di integrazione (rischio di dosaggi sbagliati su ambiguità non deducibili dal testo).
- Nessun nuovo file di test: coerente con l'assenza di test dedicati su `dieta-detail.component`/`coach-protocol-builder.component` già esistente in questo progetto. Verifica tramite `ng build` (compilazione pulita) e controllo manuale in browser.

---

### Task 1: Modello dati + vista cliente

**Files:**
- Modify: `src/app/models/diet.model.ts` (nuova interfaccia `SupplementItem`, nuovo campo su `NamedMeal`)
- Modify: `src/app/pages/dieta-detail/dieta-detail.component.html:43-45` (nuovo blocco dopo la sezione Grassi)
- Modify: `src/styles.css` (nuova regola colore etichetta)

**Interfaces:**
- Produces: `export interface SupplementItem { name: string; qty: string; }`, `NamedMeal.supplements?: SupplementItem[]` — usati da Task 2 nell'editor coach.

- [ ] **Step 1: Aggiungi `SupplementItem` e il campo su `NamedMeal`**

In `src/app/models/diet.model.ts`, individua le righe 34-42 (interfaccia `NamedMeal` esistente):

```ts
/** Un pasto con nome libero (Colazione, Spuntino, ma anche "Pre-workout", ecc.).
 *  Ha sempre almeno una combinazione (Base); se ce n'e' piu' di una vengono
 *  mostrate come tab. Le alternative per macro sono separate, sotto i tab. */
export interface NamedMeal {
  id: string;
  name: string;
  combinations: MealCombination[];
  alternatives: MacroAlternatives;
}
```

Sostituiscile con (nuova interfaccia `SupplementItem` aggiunta sopra, nuovo campo opzionale `supplements` su `NamedMeal`):

```ts
export interface SupplementItem {
  name: string;
  qty: string;
}

/** Un pasto con nome libero (Colazione, Spuntino, ma anche "Pre-workout", ecc.).
 *  Ha sempre almeno una combinazione (Base); se ce n'e' piu' di una vengono
 *  mostrate come tab. Le alternative per macro sono separate, sotto i tab.
 *  "supplements" e' una lista piatta indipendente dalle combinazioni: piu'
 *  integratori valgono insieme per lo stesso pasto, non sono alternative
 *  intercambiabili tra loro. */
export interface NamedMeal {
  id: string;
  name: string;
  combinations: MealCombination[];
  alternatives: MacroAlternatives;
  supplements?: SupplementItem[];
}
```

- [ ] **Step 2: Verifica che il progetto compili**

Run: `npx ng build --configuration production`
Expected: build pulita, nessun errore TypeScript (il nuovo campo è opzionale, nessun consumer esistente di `NamedMeal` si rompe).

- [ ] **Step 3: Mostra la sezione Integrazione nella vista cliente**

In `src/app/pages/dieta-detail/dieta-detail.component.html`, individua le righe 40-45 (chiusura del blocco `*ngFor="let cat of foodCategories"` seguita dal commento "Alternative per macro"):

```html
        </ng-container>
      </div>
    </ng-container>
  </ng-container>

  <!-- Alternative per macro, un unico accordion -->
```

Sostituiscile con (aggiunta del nuovo blocco tra la chiusura del loop macro e il commento esistente):

```html
        </ng-container>
      </div>
    </ng-container>
  </ng-container>

  <!-- Integrazione: lista piatta per pasto, non legata alla combinazione selezionata -->
  <ng-container *ngIf="vm.meal.supplements as supplements">
    <p class="fooditem-category integration" *ngIf="supplements.length > 0">Integrazione</p>
    <div class="fooditem" *ngFor="let s of supplements">
      <div class="row">
        <span class="fname">{{ s.name }}</span>
        <span class="fqty">{{ s.qty }}</span>
      </div>
    </div>
  </ng-container>

  <!-- Alternative per macro, un unico accordion -->
```

- [ ] **Step 4: Aggiungi la regola colore per l'etichetta**

In `src/styles.css`, individua le righe 395-398:

```css
.fooditem-category{font-family:'IBM Plex Mono',monospace;font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--label-3);margin:14px 0 4px;}
.fooditem-category.fat{color:var(--imp-amber);}
.fooditem-category.carb{color:var(--macro-carb);}
.fooditem-category.protein{color:var(--macro-protein);}
```

Aggiungi subito dopo:

```css
.fooditem-category.integration{color:var(--sys-cyan);}
```

- [ ] **Step 5: Verifica che il progetto compili di nuovo**

Run: `npx ng build --configuration production`
Expected: build pulita.

- [ ] **Step 6: Verifica manuale in browser**

Avvia l'app (`npx ng serve`), apri come cliente un pasto qualsiasi in "Piano alimentare": senza dati di test per `supplements`, il pasto deve apparire **identico a prima** (nessuna sezione Integrazione visibile, dato che il campo è `undefined`). Questo conferma che l'aggiunta non rompe nulla per i pasti esistenti finché il coach non inserisce dati (Task 2).

- [ ] **Step 7: Commit**

```bash
git add src/app/models/diet.model.ts src/app/pages/dieta-detail/dieta-detail.component.html src/styles.css
git commit -m "feat: aggiunge sezione Integrazione (sola lettura) nei pasti"
```

---

### Task 2: Editor coach per la sezione Integrazione

**Files:**
- Modify: `src/app/pages/coach-protocol-builder/coach-protocol-builder.component.ts` (import, metodi `addSupplement`/`removeSupplement`)
- Modify: `src/app/pages/coach-protocol-builder/coach-protocol-builder.component.html:388-390` (nuovo blocco editor)

**Interfaces:**
- Consumes: `SupplementItem`, `NamedMeal.supplements` (Task 1, `src/app/models/diet.model.ts`).
- Produces: `addSupplement(meal: NamedMeal): void`, `removeSupplement(meal: NamedMeal, item: SupplementItem): void` — nessun altro task li consuma.

- [ ] **Step 1: Aggiungi l'import di `SupplementItem`**

In `src/app/pages/coach-protocol-builder/coach-protocol-builder.component.ts`, riga 10, l'import da `diet.model` è oggi:

```ts
import { FoodItem, DietPlan, NamedMeal, MealCombination, newDietPlan, newNamedMeal, newCombination, FoodCategory, FOOD_CATEGORIES, FOOD_CATEGORY_LABELS } from '../../models/diet.model';
```

Sostituiscila con (aggiunta di `SupplementItem`):

```ts
import { FoodItem, DietPlan, NamedMeal, MealCombination, SupplementItem, newDietPlan, newNamedMeal, newCombination, FoodCategory, FOOD_CATEGORIES, FOOD_CATEGORY_LABELS } from '../../models/diet.model';
```

- [ ] **Step 2: Aggiungi i metodi `addSupplement`/`removeSupplement`**

Nello stesso file, subito dopo `removeAltItem` (righe 327-331):

```ts
  removeAltItem(meal: NamedMeal, cat: FoodCategory, item: FoodItem): void {
    const arr = meal.alternatives[cat];
    const idx = arr.indexOf(item);
    if (idx >= 0) arr.splice(idx, 1);
  }

  addSupplement(meal: NamedMeal): void {
    if (!meal.supplements) meal.supplements = [];
    meal.supplements.push({ name: '', qty: '' });
  }

  removeSupplement(meal: NamedMeal, item: SupplementItem): void {
    if (!meal.supplements) return;
    const idx = meal.supplements.indexOf(item);
    if (idx >= 0) meal.supplements.splice(idx, 1);
  }
```

- [ ] **Step 3: Verifica che il progetto compili**

Run: `npx ng build --configuration production`
Expected: build pulita.

- [ ] **Step 4: Aggiungi il blocco editor nel template**

In `src/app/pages/coach-protocol-builder/coach-protocol-builder.component.html`, individua le righe 386-390 (chiusura del blocco "Alternative" seguita dalla barra di salvataggio):

```html
          </ng-container>
        </ng-container>
      </div>

      <div class="savebar builder-savebar">
```

Sostituiscile con (nuovo blocco "Integrazione" inserito tra la chiusura di "Alternative" e la savebar):

```html
          </ng-container>
        </ng-container>
      </div>

      <p class="sectiontitle" style="margin-top:24px">Integrazione</p>
      <div class="infocard" style="margin-bottom:10px">
        <div class="builder-item" *ngFor="let s of em.supplements ?? []">
          <div class="measure-input-wrap">
            <input type="text" [(ngModel)]="s.name" placeholder="Nome (es. Creatina)" />
          </div>
          <div class="measure-input-wrap builder-qty">
            <input type="text" [(ngModel)]="s.qty" placeholder="Dose (es. 5 g)" />
          </div>
          <button class="delete-btn" (click)="removeSupplement(em, s)">✕</button>
        </div>
        <button class="confirmbtn cancel" style="width:100%;margin-top:6px" (click)="addSupplement(em)">+ Aggiungi integratore</button>
      </div>

      <div class="savebar builder-savebar">
```

- [ ] **Step 5: Verifica che il progetto compili di nuovo**

Run: `npx ng build --configuration production`
Expected: build pulita.

- [ ] **Step 6: Verifica manuale in browser**

Nel builder coach, apri un pasto esistente, clicca "+ Aggiungi integratore", scrivi nome e dose, clicca "Fatto" e poi "Salva bozza": riapri il pasto e verifica che la riga sia rimasta. Poi, lato cliente, apri lo stesso pasto in "Piano alimentare" e verifica che la sezione "Integrazione" (etichetta ciano) compaia con lo stesso nome+dose subito dopo "Grassi".

- [ ] **Step 7: Commit**

```bash
git add src/app/pages/coach-protocol-builder/coach-protocol-builder.component.ts src/app/pages/coach-protocol-builder/coach-protocol-builder.component.html
git commit -m "feat: editor coach per la sezione Integrazione nei pasti"
```

---

## Verifica manuale finale (dati reali di Andrea Carfora)

Dopo i due task, il coach inserisce a mano nel builder, per il protocollo attivo, la mappatura concordata nella spec (`docs/superpowers/specs/2026-07-20-integrazione-pasti-design.md`): Colazione (Vitamina C+B 1 dose, Creatina 5g), Pranzo (Omega 3,6,9 quota giornaliera, Bromelina dose consigliata), Cena (stessi + Magnesio 400mg dopo cena + Creatina 5g solo nel piano ON), Merenda nel piano ON (Arginina 3g, Carnitina 2g, Termogenico dose consigliata), nuovo pasto "Intra-Workout" nel piano ON (Intra-workout 10g/500-700ml).
