# Design: sezione "Integrazione" nei pasti

Data: 2026-07-20

## Contesto

Il coach fornisce, oltre a scheda allenamento e dieta, un PDF di integrazione
(es. `integrazione_.docx.pdf`) con dosaggi e orari degli integratori:

```
INTEGRAZIONE
vitamina C+B: una dose a colazione
creatina: 5gr a colazione
Omega 3,6,9: dose giornaliera prevista da dividere tra pranzo e cena
pre-workout: 30 minuti prima
  arginina 3g
  carnitina 2g
  termogenico dosaggio consigliato
intra-workout
  10gr durante l'allenamento da sorseggiare in 500/700ml d'acqua
post-workout:
  5 gr di creatina da assumere nel pasto
magnesio 400mg da assumere dopo cena
bromelina assumere la dose consigliata a pranzo e cena
```

Richiesta: mostrare queste indicazioni dentro l'app, pasto per pasto, in una
sezione "Integrazione" dopo "Grassi" — stesso stile delle altre etichette
macro (Carboidrati/Proteine/Grassi), nessun'altra modifica al layout dei
pasti esistente. Mockup approvato:
`https://claude.ai/code/artifact/94764901-8c57-4d61-b346-43a4d8395437`.

## Mappatura concordata con l'utente

Alcune voci del PDF non hanno un pasto "ovvio" (pre/intra/post-workout).
Chiarito con l'utente, che ha risolto anche l'ambiguità sulla creatina
(citata due volte nel PDF, a colazione e post-workout: sono **due dosi
distinte**, non la stessa dose spostata — 10g totali nei giorni di
allenamento):

| Pasto | Solo giorni ON? | Voci Integrazione |
|---|---|---|
| Colazione | No (ON+OFF) | Vitamina C+B — 1 dose; Creatina — 5 g |
| Pranzo | No (ON+OFF) | Omega 3,6,9 — quota giornaliera; Bromelina — dose consigliata |
| Merenda | Solo ON (righe aggiuntive) | Arginina — 3 g; Carnitina — 2 g; Termogenico — dose consigliata |
| Cena | No (ON+OFF), + righe extra solo ON | Omega 3,6,9 — quota giornaliera; Bromelina — dose consigliata; Magnesio — 400 mg, dopo cena; **solo ON:** Creatina — 5 g |
| Intra-Workout (pasto nuovo) | Solo ON | Intra-workout — 10 g / 500-700 ml acqua |

Questa tabella non e' codificata da nessuna parte: e' il contenuto che il
coach inserisce a mano nel builder (vedi sotto), non generato da un parser.

## Perche' niente parser PDF automatico

La proposta iniziale includeva un parser per il file "integrazione" (gia'
supportato in upload da `coach-protocol-import.component.ts`, oggi il testo
finisce solo come nota libera in `supplementNotesSource`). Scartata dopo
aver visto che risolvere correttamente anche solo *questo* PDF ha richiesto
un chiarimento umano non deducibile dal testo (la doppia creatina: stessa
dose spostata o due dosi distinte?). Un parser automatico avrebbe dovuto
indovinare, con un rischio concreto di dosaggi sbagliati — inaccettabile per
un piano di integrazione. Restano quindi solo le modifiche a modello, vista
cliente ed editor coach; il coach inserisce le voci a mano guardando il PDF,
stesso principio già in uso per correggere alimenti mal riconosciuti
dall'import dieta.

## Modello dati

`src/app/models/diet.model.ts` — nuovo campo opzionale su `NamedMeal`:

```ts
export interface SupplementItem {
  name: string;
  qty: string;
}

export interface NamedMeal {
  id: string;
  name: string;
  combinations: MealCombination[];
  alternatives: MacroAlternatives;
  supplements?: SupplementItem[];
}
```

Nessuna modifica a `FoodCategory`/`MealCombination`/`MacroAlternatives`: gli
alimenti carb/protein/fat restano com'erano. L'integrazione e' una lista
separata perche' semanticamente diversa dagli "alimenti" (piu' voci
contemporanee per lo stesso pasto, non alternative intercambiabili) — non
adatta al modello "un alimento per categoria" gia' esistente.

`newNamedMeal()` non inizializza `supplements` (resta `undefined` finche'
il coach non ne aggiunge una): coerente con come oggi `note`/`text` su
`Exercise` sono gia' opzionali e assenti finche' non impostati.

## Vista cliente (`dieta-detail.component.html`)

Dopo la sezione Grassi della combinazione attiva, se `vm.meal.supplements`
ha elementi:

```html
<ng-container *ngIf="vm.meal.supplements?.length">
  <p class="fooditem-category integration">Integrazione</p>
  <div class="fooditem" *ngFor="let s of vm.meal.supplements">
    <div class="row">
      <span class="fname">{{ s.name }}</span>
      <span class="fqty">{{ s.qty }}</span>
    </div>
  </div>
</ng-container>
```

Stesso `fooditem`/`row`/`fname`/`fqty` gia' usati per gli alimenti (nessun
nuovo componente di layout). Nuova regola CSS in `styles.css`:

```css
.fooditem-category.integration{color:var(--sys-cyan);}
```

`--sys-cyan` (`#64D2FF`) e' gia' definita e non usata da nessuna etichetta
macro — nessun nuovo colore da introdurre.

## Editor coach (`coach-protocol-builder`)

Nella vista di modifica pasto, sotto le sezioni esistenti (combinazioni +
alternative per macro), nuovo blocco "Integrazione" con lo stesso pattern
gia' in uso per le alternative (`addAltItem`/`removeAltItem`):

```ts
addSupplement(meal: NamedMeal): void {
  if (!meal.supplements) meal.supplements = [];
  meal.supplements.push({ name: '', qty: '' });
}

removeSupplement(meal: NamedMeal, item: SupplementItem): void {
  meal.supplements = (meal.supplements ?? []).filter(s => s !== item);
}
```

```html
<p class="sectiontitle" style="margin-top:18px">Integrazione</p>
<div class="fooditem" *ngFor="let s of meal.supplements ?? []">
  <div class="builder-row2">
    <input type="text" [(ngModel)]="s.name" placeholder="Nome (es. Creatina)" />
    <input type="text" [(ngModel)]="s.qty" placeholder="Dose (es. 5 g)" />
    <button class="delete-btn" (click)="removeSupplement(meal, s)">✕</button>
  </div>
</div>
<button class="confirmbtn cancel" (click)="addSupplement(meal)">+ Aggiungi integratore</button>
```

Il coach aggiunge un pasto "Intra-Workout" nel piano Giorno ON con il
bottone "+ Aggiungi pasto" gia' esistente (`addMeal`), poi ci inserisce la
riga Integrazione come per gli altri — nessuna logica speciale "solo nei
piani ON" da scrivere: e' semplicemente un pasto che il coach crea solo li',
esattamente come farebbe con qualunque altro pasto specifico di un piano.

## Cosa NON cambia

- `FoodCategory`/`MealCombination`/`MacroAlternatives`/alimenti esistenti.
- `pdf-import.service.ts` (nessuna modifica, nessun parser nuovo).
- `supplementNotesSource`/`infoNote` (restano come nota libera, indipendenti
  da questa nuova sezione strutturata).
- Layout/stile delle card pasto per tutto il resto (nessuna card cambia
  forma, solo eventuale sezione aggiuntiva in coda).

## Test

- `dieta-detail.component`: nessun nuovo test dedicato — la sezione
  Integrazione riusa lo stesso binding/stile di Grassi, stesso livello di
  copertura gia' accettato oggi per le sezioni equivalenti in questo
  componente (nessun test esistente sulle sezioni macro).
- `coach-protocol-builder.component`: nessun nuovo test dedicato per lo
  stesso motivo (il componente non ha oggi test propri; `addSupplement`/
  `removeSupplement` sono mutazioni dirette equivalenti a `addAltItem`/
  `removeAltItem`, gia' non testate).
