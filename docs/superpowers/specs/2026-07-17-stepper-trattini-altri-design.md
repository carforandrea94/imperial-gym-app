# Design: stepper a trattini — slider pasti e indicatore settimana

Data: 2026-07-17

## Contesto

Lo stepper a trattini appena introdotto per la vista slider degli
esercizi (spec `2026-07-17-stepper-trattini-scheda-design.md`, PR #53)
va esteso agli altri 2 indicatori "a pallini" rimasti nell'app,
confermati con l'utente:

1. **Slider dei pasti** (`dieta-detail.component.html`) — stessa
   identica struttura dello slider esercizi appena convertito (label
   "Pasto X di Y" + pallini di navigazione sotto un carosello di
   card).
2. **Indicatore settimana** (`scheda-list.component.html`,
   `.weekdots`) — un indicatore di progresso statico (non un
   carosello navigabile), gia' con classi `.completed`/`.active`
   concettualmente identiche a quelle appena introdotte per gli
   esercizi.

## A. Slider pasti (`dieta-detail.component.html`)

Trattamento identico allo slider esercizi: rimuovi la label
`.exslider-counter` ("Pasto X di Y"), sposta l'indicatore in cima,
converti da pallini a trattini.

A differenza degli esercizi, un pasto non ha un concetto di
"completato" — solo lo stato "corrente" esiste. **Riusa le classi
gia' esistenti** `.exslider-dashes`/`.exslider-dash` (create per lo
slider esercizi, gia' generiche, nessuna nuova classe CSS necessaria):
basta il binding `[class.active]`, senza `[class.done]` (che
semplicemente non si applica qui).

Il blocco attuale (`dieta-detail.component.html:86-106`):

```html
<div class="exslider-wrap" *ngIf="plan && state.viewMode() === 'slider'">
  <div class="exslider-counter">Pasto {{ sliderIndex + 1 }} di {{ meals.length }}</div>

  <div class="exslider" #sliderEl (scroll)="onSliderScroll()">
    <div class="meal mealslide exslide" *ngFor="let vm of meals">
      <div class="meal-summary noclick">
        <span>{{ vm.meal.name }}</span>
      </div>

      <div class="content-inner">
        <ng-container *ngTemplateOutlet="mealDetail; context: { vm: vm }"></ng-container>
      </div>
    </div>
  </div>

  <div class="exslider-dots" *ngIf="meals.length > 1">
    <span *ngFor="let vm of meals; let i = index"
      class="exslider-dot" [class.active]="i === sliderIndex"
      (click)="scrollToIndex(i)"></span>
  </div>
</div>
```

diventa:

```html
<div class="exslider-wrap" *ngIf="plan && state.viewMode() === 'slider'">
  <div class="exslider-dashes" *ngIf="meals.length > 1">
    <span *ngFor="let vm of meals; let i = index"
      class="exslider-dash" [class.active]="i === sliderIndex"
      (click)="scrollToIndex(i)"></span>
  </div>

  <div class="exslider" #sliderEl (scroll)="onSliderScroll()">
    <div class="meal mealslide exslide" *ngFor="let vm of meals">
      <div class="meal-summary noclick">
        <span>{{ vm.meal.name }}</span>
      </div>

      <div class="content-inner">
        <ng-container *ngTemplateOutlet="mealDetail; context: { vm: vm }"></ng-container>
      </div>
    </div>
  </div>
</div>
```

### Pulizia: rimozione delle classi CSS ormai morte

Dopo questa modifica, nessun template nell'app usa piu'
`.exslider-counter`/`.exslider-dots`/`.exslider-dot`/`.exslider-dot.active`
(`scheda-detail` le ha gia' abbandonate nella PR #53, `dieta-detail` le
abbandona qui). Le 4 regole vanno rimosse da `src/styles.css` (righe
164, 169-171) — nessun'altra pagina le usa (verificato con grep
sull'intero `src/app`, solo questi 2 file le referenziavano).

## B. Indicatore settimana (`scheda-list.component.html`, `.weekdots`)

Nessuna modifica di markup o logica — e' un indicatore di progresso
statico, non un carosello, e la label "Settimana X di Y" (con le info
aggiuntive su wave/giorno) resta invariata. Cambia solo la **forma**
dei pallini in `src/styles.css`, da cerchio a trattino, mantenendo
identica la logica `.completed`/`.active` gia' esistente:

Attuale (`src/styles.css:143-146`):

```css
.weekdots{display:flex;justify-content:center;gap:5px;margin-top:8px;}
.weekdots span{width:6px;height:6px;border-radius:50%;background:var(--content-glass-border);transition:background .2s ease,transform .2s ease;}
.weekdots span.completed{background:var(--accent);}
.weekdots span.active{background:var(--accent);transform:scale(1.4);}
```

diventa (stessa struttura, solo forma trattino invece di cerchio;
l'ingrandimento `scale(1.4)` di `.active` diventa un allungamento
della larghezza, coerente con lo stepper esercizi):

```css
.weekdots{display:flex;justify-content:center;gap:5px;margin-top:8px;}
.weekdots span{width:12px;height:3px;border-radius:2px;background:var(--content-glass-border);transition:background .2s ease,width .2s ease;}
.weekdots span.completed{background:var(--accent);}
.weekdots span.active{background:var(--accent);width:22px;}
```

## Cosa NON cambia

- Nessuna modifica a `scheda-detail.component.html`/`.ts` (gia' fatto
  nella PR #53) — questa spec copre solo `dieta-detail` e
  `scheda-list`.
- La label "Settimana X di Y" e le informazioni aggiuntive
  (`.wk-sub`) in `scheda-list` restano invariate.
- Nessuna nuova logica di stato in nessuno dei 2 file — solo markup
  (A) e CSS (A, B).

## Test

Nessun test automatico dedicato (nessun `.spec.ts` esistente per
questi componenti), ma verifica tramite `npx tsc --noEmit -p
tsconfig.app.json`, `npx ng test --watch=false` (conteggio invariato),
`npx ng build`, e verifica manuale: la vista slider della dieta (pasti)
non mostra piu' la label "Pasto X di Y", i trattini sono in cima e
funzionano per navigare tra i pasti (click); nella lista scheda, i
pallini della settimana sono ora trattini, con la settimana corrente
piu' lunga e quelle passate/completate colorate, esattamente come
prima ma con la nuova forma.
