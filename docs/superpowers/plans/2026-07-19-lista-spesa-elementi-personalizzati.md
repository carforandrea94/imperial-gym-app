# Elementi personalizzati nella lista della spesa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettere di aggiungere manualmente elementi personalizzati alla "Lista della spesa", oltre a quelli derivati automaticamente dal piano alimentare.

**Architecture:** Nuovo campo `shoppingCustomItems` in `AppState` (stesso documento Firestore già usato per il resto dello stato di sessione), un array di `{id, name, checked}` scritto per intero ad ogni modifica. Il componente `ListaSpesaComponent` carica/salva questo array accanto a `shoppingChecked` già esistente; la UI aggiunge un campo di input sempre visibile e una sezione "Aggiunti da te" separata dalla lista dieta, con eliminazione per riga.

**Tech Stack:** Angular 21 standalone component, `FormsModule` per `[(ngModel)]` (non ancora usato in questa pagina).

## Global Constraints

- Ogni elemento personalizzato ha solo un nome (testo libero) — nessun campo quantità separato.
- Ogni elemento personalizzato ha un proprio `id` generato al momento dell'aggiunta (non il nome come chiave): si possono aggiungere due elementi con lo stesso nome, restano righe distinte.
- Gli elementi personalizzati compaiono in una sezione separata **sotto** la lista dieta, etichettata "Aggiunti da te", con un'icona elimina per riga — gli elementi della dieta non hanno eliminazione (si rigenerano sempre dal piano).
- "Svuota spuntati" toglie la spunta a **tutto** (dieta + personalizzati) ma non elimina nessun elemento personalizzato.
- Riuso di `.daycard`/`.shop-item`/`.shop-check`/`.delete-btn` esistenti, invariati — solo una nuova classe CSS dedicata `.shop-addrow`/`.shop-addbtn` per la riga di input.

---

## File Structure

- `src/app/services/app-state.service.ts` — nuovo campo `shoppingCustomItems` in `AppState`/`emptyState()`.
- `src/app/pages/lista-spesa/lista-spesa.component.ts` — nuovo stato/metodi per gli elementi personalizzati.
- `src/app/pages/lista-spesa/lista-spesa.component.html` — riga di input + sezione "Aggiunti da te".
- `src/styles.css` — nuova classe `.shop-addrow`/`.shop-addbtn`.

---

### Task 1: Elementi personalizzati nella lista della spesa

**Files:**
- Modify: `src/app/services/app-state.service.ts`
- Modify: `src/app/pages/lista-spesa/lista-spesa.component.ts`
- Modify: `src/app/pages/lista-spesa/lista-spesa.component.html`
- Modify: `src/styles.css`

**Interfaces:**
- Nessuna interfaccia consumata da/prodotta per altre task (unica task del piano).

- [ ] **Step 1: Aggiungi il campo `shoppingCustomItems` ad `AppState`**

In `src/app/services/app-state.service.ts`, trova:

```ts
export interface AppState {
  workoutDrafts: Record<string, { rows: WorkoutDraftRow[] }[]>;
  restOverrides: Record<string, number>;
  measureDraft: Record<string, Record<string, string | null>> | null;
  shoppingChecked: Record<string, boolean>;
  workoutViewMode: 'list' | 'slider';
  dietViewMode: 'list' | 'slider';
  mealsCompletion: { date: string; done: Record<string, boolean> } | null;
}

function emptyState(): AppState {
  return { workoutDrafts: {}, restOverrides: {}, measureDraft: null, shoppingChecked: {}, workoutViewMode: 'list', dietViewMode: 'list', mealsCompletion: null };
}
```

Sostituisci con:

```ts
export interface AppState {
  workoutDrafts: Record<string, { rows: WorkoutDraftRow[] }[]>;
  restOverrides: Record<string, number>;
  measureDraft: Record<string, Record<string, string | null>> | null;
  shoppingChecked: Record<string, boolean>;
  shoppingCustomItems: { id: string; name: string; checked: boolean }[];
  workoutViewMode: 'list' | 'slider';
  dietViewMode: 'list' | 'slider';
  mealsCompletion: { date: string; done: Record<string, boolean> } | null;
}

function emptyState(): AppState {
  return { workoutDrafts: {}, restOverrides: {}, measureDraft: null, shoppingChecked: {}, shoppingCustomItems: [], workoutViewMode: 'list', dietViewMode: 'list', mealsCompletion: null };
}
```

- [ ] **Step 2: Aggiorna `ListaSpesaComponent` — import e interfaccia**

In `src/app/pages/lista-spesa/lista-spesa.component.ts`, trova:

```ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DietDataService } from '../../services/diet-data.service';
import { AppStateService } from '../../services/app-state.service';
import { FoodItem } from '../../models/diet.model';

interface ShoppingItem {
  key: string;
  name: string;
  qtys: string[];
  sources: string[]; // "Nome piano · Pasto"
  checked: boolean;
}

@Component({
  selector: 'app-lista-spesa',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './lista-spesa.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class ListaSpesaComponent implements OnInit {
  items: ShoppingItem[] = [];
  loading = true;
  errorMsg = '';

  get checkedCount() { return this.items.filter(i => i.checked).length; }
```

Sostituisci con:

```ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DietDataService } from '../../services/diet-data.service';
import { AppStateService } from '../../services/app-state.service';
import { FoodItem } from '../../models/diet.model';

interface ShoppingItem {
  key: string;
  name: string;
  qtys: string[];
  sources: string[]; // "Nome piano · Pasto"
  checked: boolean;
}

interface CustomShoppingItem {
  id: string;
  name: string;
  checked: boolean;
}

@Component({
  selector: 'app-lista-spesa',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lista-spesa.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class ListaSpesaComponent implements OnInit {
  items: ShoppingItem[] = [];
  customItems: CustomShoppingItem[] = [];
  newItemName = '';
  loading = true;
  errorMsg = '';

  get checkedCount() {
    return this.items.filter(i => i.checked).length + this.customItems.filter(i => i.checked).length;
  }
```

- [ ] **Step 3: Carica `shoppingCustomItems` in `load()`**

Trova:

```ts
    try {
      const appState = await Promise.race([this.appState.load(), timeout]);
      this.buildItems(appState.shoppingChecked ?? {});
    } catch (e: any) {
```

Sostituisci con:

```ts
    try {
      const appState = await Promise.race([this.appState.load(), timeout]);
      this.buildItems(appState.shoppingChecked ?? {});
      this.customItems = appState.shoppingCustomItems ?? [];
    } catch (e: any) {
```

- [ ] **Step 4: Aggiungi i metodi per gli elementi personalizzati e aggiorna `resetAll()`**

Trova (fine del file):

```ts
  async resetAll(): Promise<void> {
    this.items.forEach(i => { i.checked = false; });
    await this.appState.patch({ shoppingChecked: {} });
  }
}
```

Sostituisci con:

```ts
  addCustomItem(): void {
    const name = this.newItemName.trim();
    if (!name) return;
    this.customItems.push({ id: `${Date.now()}_${Math.floor(Math.random() * 1000)}`, name, checked: false });
    this.newItemName = '';
    this.appState.patch({ shoppingCustomItems: this.customItems });
  }

  toggleCustom(item: CustomShoppingItem): void {
    item.checked = !item.checked;
    this.appState.patch({ shoppingCustomItems: this.customItems });
  }

  removeCustom(item: CustomShoppingItem, event: MouseEvent): void {
    event.stopPropagation();
    this.customItems = this.customItems.filter(i => i.id !== item.id);
    this.appState.patch({ shoppingCustomItems: this.customItems });
  }

  async resetAll(): Promise<void> {
    this.items.forEach(i => { i.checked = false; });
    this.customItems.forEach(i => { i.checked = false; });
    await this.appState.patch({ shoppingChecked: {}, shoppingCustomItems: this.customItems });
  }
}
```

Nota: `toggleCustom`/`addCustomItem` non chiamano `this.cdr.detectChanges()` — sono mutazioni sincrone dentro handler `(click)`/`(keydown.enter)`, che in questa app zoneless ottengono già un ciclo di change detection automatico dal binding stesso (stesso pattern di `toggle()` già esistente in questo file). `removeCustom` riceve l'evento per chiamare `event.stopPropagation()` (la riga ha anche `(click)="toggleCustom(item)"`, quindi senza fermare la propagazione l'eliminazione attiverebbe anche la spunta) — stesso pattern già usato da `deleteEntry` in `misure-storico.component.ts`.

- [ ] **Step 5: Aggiorna il template — riga di input e sommario**

In `src/app/pages/lista-spesa/lista-spesa.component.html`, trova:

```html
<ng-container *ngIf="!loading && !errorMsg">
  <div class="shop-summary">
    <span>{{ checkedCount }} / {{ items.length }} presi</span>
    <button class="confirmbtn cancel shop-resetbtn" (click)="resetAll()" *ngIf="checkedCount > 0">Svuota spuntati</button>
  </div>

  <div *ngIf="items.length === 0" class="history-empty">
    Nessun alimento trovato nei tuoi piani alimentari.<br>
    Aggiungi alimenti alla dieta per vederli qui.
  </div>
```

Sostituisci con:

```html
<ng-container *ngIf="!loading && !errorMsg">
  <div class="shop-summary">
    <span>{{ checkedCount }} / {{ items.length + customItems.length }} presi</span>
    <button class="confirmbtn cancel shop-resetbtn" (click)="resetAll()" *ngIf="checkedCount > 0">Svuota spuntati</button>
  </div>

  <div class="shop-addrow">
    <input type="text" [(ngModel)]="newItemName" (keydown.enter)="addCustomItem()" placeholder="Aggiungi alimento…">
    <button class="shop-addbtn" (click)="addCustomItem()">+</button>
  </div>

  <div *ngIf="items.length === 0 && customItems.length === 0" class="history-empty">
    Nessun alimento trovato nei tuoi piani alimentari.<br>
    Aggiungi alimenti alla dieta per vederli qui, oppure aggiungine uno qui sopra.
  </div>
```

- [ ] **Step 6: Aggiungi la sezione "Aggiunti da te"**

Trova (fine del blocco, subito prima della chiusura `</ng-container>`):

```html
  <div *ngIf="items.length > 0" class="grouplist">
    <div class="daycard press-fx shop-item" [class.checked]="item.checked" *ngFor="let item of items" (click)="toggle(item)">
      <div class="shop-check" [class.on]="item.checked">
        <svg *ngIf="item.checked" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div class="info">
        <div class="lbl">{{ item.name }}</div>
        <div class="meta">
          <ng-container *ngIf="item.qtys.length">{{ item.qtys.join(' + ') }} · </ng-container>{{ item.sources.join(', ') }}
        </div>
      </div>
    </div>
  </div>
</ng-container>
```

Sostituisci con:

```html
  <div *ngIf="items.length > 0" class="grouplist">
    <div class="daycard press-fx shop-item" [class.checked]="item.checked" *ngFor="let item of items" (click)="toggle(item)">
      <div class="shop-check" [class.on]="item.checked">
        <svg *ngIf="item.checked" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div class="info">
        <div class="lbl">{{ item.name }}</div>
        <div class="meta">
          <ng-container *ngIf="item.qtys.length">{{ item.qtys.join(' + ') }} · </ng-container>{{ item.sources.join(', ') }}
        </div>
      </div>
    </div>
  </div>

  <ng-container *ngIf="customItems.length > 0">
    <p class="sectiontitle">Aggiunti da te</p>
    <div class="grouplist">
      <div class="daycard press-fx shop-item" [class.checked]="item.checked" *ngFor="let item of customItems" (click)="toggleCustom(item)">
        <div class="shop-check" [class.on]="item.checked">
          <svg *ngIf="item.checked" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div class="info">
          <div class="lbl">{{ item.name }}</div>
        </div>
        <button class="delete-btn" (click)="removeCustom(item, $event)" title="Elimina">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
          </svg>
        </button>
      </div>
    </div>
  </ng-container>
</ng-container>
```

- [ ] **Step 7: Aggiungi lo stile della riga di input**

In `src/styles.css`, subito dopo la riga `.shop-check.on{border-color:var(--accent);background:var(--accent);}`, aggiungi:

```css
.shop-addrow{display:flex;gap:8px;margin-bottom:16px;}
.shop-addrow input{flex:1;padding:12px 14px;border-radius:14px;border:1px solid var(--content-glass-border);background:var(--content-glass-bg);color:var(--label);font-family:'Inter',sans-serif;font-size:14px;}
.shop-addrow input::placeholder{color:var(--label-3);}
.shop-addbtn{width:46px;height:46px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:var(--imp-red);color:#04140D;font-size:20px;font-weight:700;cursor:pointer;flex-shrink:0;}
.shop-addbtn:active{filter:brightness(0.92);}
```

- [ ] **Step 8: Verifica che il progetto compili e i test passino**

Run: `npx ng build`
Expected: nessun errore.

Run: `npx ng test --watch=false`
Expected: tutti i test passano, nessuna regressione (nessun test nuovo aggiunto — nessuna logica pura isolabile in questa task oltre a manipolazioni banali di array già coperte a livello di build/regressione, coerente con l'assenza di uno spec file per `ListaSpesaComponent` già oggi).

- [ ] **Step 9: Verifica visiva manuale**

Avvia l'app (`npx ng serve`), apri "Lista della spesa":
- Il campo "Aggiungi alimento…" è sempre visibile sotto il riepilogo.
- Scrivendo un nome e premendo invio (o toccando "+"), l'elemento appare nella sezione "Aggiunti da te" sotto la lista dieta, il campo si svuota.
- Tap sulla riga la spunta/la spunta-via; il conteggio "X/Y presi" si aggiorna includendo anche i personalizzati.
- L'icona elimina rimuove la riga senza spuntarla per errore.
- "Svuota spuntati" toglie la spunta a tutto (dieta + personalizzati) ma non elimina i personalizzati.
- Aggiungendo due elementi con lo stesso nome, restano due righe distinte.
- Ricaricando la pagina, gli elementi personalizzati e il loro stato persistono.

- [ ] **Step 10: Commit**

```bash
git add src/app/services/app-state.service.ts src/app/pages/lista-spesa/lista-spesa.component.ts src/app/pages/lista-spesa/lista-spesa.component.html src/styles.css
git commit -m "Aggiunge elementi personalizzati alla lista della spesa"
```

---

## Self-Review Notes

- **Spec coverage:** campo AppState additivo ✅, input sempre visibile ✅, solo nome (nessuna quantità) ✅, sezione "Aggiunti da te" separata con eliminazione per riga ✅, "Svuota spuntati" esteso senza eliminare ✅, ID proprio per riga (non il nome come chiave) ✅.
- **Placeholder scan:** nessun TBD/TODO; ogni step mostra il codice esatto prima/dopo.
- **Type consistency:** `CustomShoppingItem { id, name, checked }` (Step 2) usato identicamente in `AppState.shoppingCustomItems` (Step 1), nel template (Step 6, `*ngFor="let item of customItems"`) e in tutti i metodi (Step 4).
- **Scope:** task singola — l'intera feature vive in un solo componente + un campo `AppState`, nessuna logica pura abbastanza complessa da giustificare l'estrazione in un file di utilità separato (a differenza di `toggleSelection`/`computeScaledDimensions` in feature precedenti, qui le operazioni sono manipolazioni dirette di array senza casi limite non ovvi).
