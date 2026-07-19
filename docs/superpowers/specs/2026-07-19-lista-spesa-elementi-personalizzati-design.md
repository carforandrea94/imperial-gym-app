# Elementi personalizzati nella lista della spesa

## Problema

La "Lista della spesa" (`lista-spesa.component.ts`) è interamente derivata dal
piano alimentare (`dietData.diet`): non esiste modo di aggiungere un
elemento che non fa parte della dieta (es. detersivo, sale, un ingrediente
dimenticato nel piano).

## Requisiti approvati

- Un campo di testo **sempre visibile** subito sotto la barra di riepilogo
  ("X/Y presi"), placeholder "Aggiungi alimento…". Invio o tap su "+"
  aggiunge l'elemento e svuota il campo, pronto per il prossimo inserimento.
- Ogni elemento personalizzato ha **solo un nome** (testo libero, niente
  campo quantità separato — chi vuole una quantità la scrive nel nome
  stesso, es. "Farina 1kg").
- Gli elementi personalizzati compaiono in una **sezione separata sotto**
  la lista derivata dalla dieta, etichettata "Aggiunti da te". Stessa riga
  visiva (`.daycard`/`.shop-item`/`.shop-check`) degli elementi della dieta,
  con in più un'**icona elimina** per riga (gli elementi della dieta non
  ce l'hanno, si rigenerano sempre dal piano e non avrebbe senso
  eliminarli singolarmente).
- Tap sulla riga spunta/toglie la spunta, esattamente come gli elementi
  della dieta.
- **"Svuota spuntati"** (bottone esistente) toglie la spunta a **tutto**
  (dieta + personalizzati) ma **non elimina** gli elementi personalizzati:
  restano nella lista per il prossimo giro di spesa finché non vengono
  eliminati esplicitamente con l'icona elimina.
- Ogni elemento personalizzato ha un proprio ID (non il nome come chiave):
  si possono aggiungere due elementi con lo stesso nome, sono righe
  distinte e indipendenti (utile per errori di battitura o ripetizioni
  intenzionali).

## Persistenza

Nuovo campo in `AppState` (`src/app/services/app-state.service.ts`):

```ts
shoppingCustomItems: { id: string; name: string; checked: boolean }[];
```

Default `[]` in `emptyState()`. Come gli altri campi array/oggetto già
presenti in `AppState`, viene scritto **per intero** ad ogni modifica
(`appState.patch({ shoppingCustomItems: [...] })`) — nessuna necessità di
scritture per-path dato che l'array è piccolo e già interamente in memoria
nel componente.

L'ID di ogni elemento viene generato lato client al momento
dell'aggiunta (es. `${Date.now()}_${Math.floor(Math.random() * 1000)}`,
stesso stile già usato da `newId()` in `diet.model.ts`), non serve
un contatore persistito o un ID lato server.

## Componente

`ListaSpesaComponent`:

- Nuovo campo `customItems: { id: string; name: string; checked: boolean }[]`,
  caricato da `appState.load()` in `load()` insieme al resto dello stato
  già letto oggi (`shoppingChecked`).
- Nuovo campo `newItemName = ''` (bound al nuovo input).
- Nuovo metodo `addCustomItem()`: ignora stringhe vuote/solo-spazi, crea
  l'elemento, lo aggiunge a `customItems`, persiste l'intero array,
  svuota `newItemName`.
- Nuovo metodo `toggleCustom(item)`: inverte `checked`, persiste l'intero
  array (stesso pattern sincrono già usato da `toggle()` per gli elementi
  dieta — nessun `cdr.detectChanges()` necessario, mutazione sincrona
  dentro un handler `(click)`).
- Nuovo metodo `removeCustom(item)`: filtra via l'elemento, persiste.
- `resetAll()` esistente: esteso per azzerare anche `checked` su ogni
  `customItems` (oltre a svuotare `shoppingChecked` come già fa oggi),
  senza rimuovere nessun elemento personalizzato dall'array.

## UI

Nel template, subito dopo `.shop-summary` e prima della lista dieta
esistente:

```html
<div class="shop-addrow">
  <input type="text" [(ngModel)]="newItemName" (keydown.enter)="addCustomItem()" placeholder="Aggiungi alimento…">
  <button (click)="addCustomItem()">+</button>
</div>
```

(richiede aggiungere `FormsModule` agli `imports` del componente, per
`[(ngModel)]` — oggi non presente perché non c'erano form/input in questa
pagina).

Dopo la lista dieta esistente (`*ngIf="items.length > 0"`), una nuova
sezione, visibile solo se ci sono elementi personalizzati:

```html
<ng-container *ngIf="customItems.length > 0">
  <p class="sectiontitle">Aggiunti da te</p>
  <div class="grouplist">
    <div class="daycard press-fx shop-item" [class.checked]="item.checked" *ngFor="let item of customItems" (click)="toggleCustom(item)">
      <div class="shop-check" [class.on]="item.checked">
        <svg *ngIf="item.checked" ...>...</svg>
      </div>
      <div class="info">
        <div class="lbl">{{ item.name }}</div>
      </div>
      <button class="delete-btn" (click)="removeCustom(item); $event.stopPropagation()" title="Elimina">
        <svg ...icona cestino, gia' usata altrove.../>
      </button>
    </div>
  </div>
</ng-container>
```

Riusa `.daycard`/`.shop-item`/`.shop-check`/`.delete-btn` esistenti senza
modificarli. Nuova sola classe CSS per la riga di input, `.shop-addrow`.

## Cosa NON cambia

- La generazione della lista dieta (`buildItems()`, appena corretta per
  includere anche `FoodItem.alt`) resta invariata.
- `.shop-item`/`.shop-check`/`.delete-btn`/`.daycard` non vengono
  modificate, solo riusate.
- Nessun impatto su altre pagine o su `AppState` oltre al nuovo campo
  additivo.

## Test plan

- Verifica manuale: aggiunta di un elemento (invio e tap su "+"), spunta/
  spunta-via, eliminazione, "Svuota spuntati" toglie la spunta senza
  eliminare i personalizzati, persistenza dopo refresh pagina, doppio
  elemento con lo stesso nome trattato come righe distinte.
- `npx ng build` e `npx ng test --watch=false` puliti.
