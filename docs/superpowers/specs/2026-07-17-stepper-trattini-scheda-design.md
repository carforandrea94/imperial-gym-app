# Design: stepper a trattini nella vista slider di scheda-detail

Data: 2026-07-17

## Contesto

La vista slider degli esercizi (`scheda-detail.component.html`, quando
`state.viewMode() === 'slider'`) mostra oggi:

- una label testuale in cima, `.exslider-counter`: "Esercizio {{
  sliderIndex + 1 }} di {{ exercises.length }}"
  (`scheda-detail.component.html:96`)
- un indicatore di paginazione a pallini in fondo, `.exslider-dots`/
  `.exslider-dot` (`scheda-detail.component.html:126-130`), un pallino
  per esercizio, quello corrente colorato e ingrandito.

L'utente ha chiesto (confermato con mockup visivi in questa
conversazione): rimuovere la label testuale, spostare l'indicatore in
cima al suo posto, e cambiarne la forma da pallini a trattini
orizzontali.

## Attenzione: classi CSS condivise con dieta-detail

`.exslider-counter`/`.exslider-dots`/`.exslider-dot` sono usate anche
da `dieta-detail.component.html` per lo slider dei pasti ("Pasto X di
Y"). Questa modifica riguarda **solo** la vista slider degli esercizi
— `dieta-detail` non deve cambiare. Si usano quindi classi CSS **nuove
e dedicate**, non le classi condivise: `.exslider-dashes` (contenitore)
e `.exslider-dash` (singolo trattino), usate solo in
`scheda-detail.component.html`. Le classi condivise restano invariate
per `dieta-detail`.

## Comportamento dei trattini

Un trattino per esercizio, in ordine. Stati (verificato visivamente e
approvato dall'utente):

- **Esercizio corrente** (`i === sliderIndex`): trattino piu' lungo
  (24px invece di 12px) e colorato (`var(--accent)`) — **sempre**,
  indipendentemente dal completamento.
- **Esercizio completato** (tutte le serie spuntate — gia' disponibile
  tramite `isComplete(vm)`, `scheda-detail.component.ts:303-305`) ma
  NON corrente: trattino colorato (`var(--accent)`), larghezza normale
  (12px).
- **Esercizio non completato e non corrente**: trattino grigio
  (`var(--content-glass-border)`, stesso colore neutro gia' usato dai
  pallini oggi), larghezza normale.

Nessuna nuova logica di completamento: `isComplete(vm)` esiste gia' ed
e' gia' usato altrove nel componente.

## Markup

In `scheda-detail.component.html`, il blocco attuale (righe 95-131):

```html
<div class="exslider-wrap" *ngIf="day && !loading && !errorMsg && state.viewMode() === 'slider'">
  <div class="exslider-counter">Esercizio {{ sliderIndex + 1 }} di {{ exercises.length }}</div>

  <div class="exslider" #sliderEl (scroll)="onSliderScroll()">
    ...
  </div>

  <div class="exslider-dots" *ngIf="exercises.length > 1">
    <span *ngFor="let vm of exercises; let i = index"
      class="exslider-dot" [class.active]="i === sliderIndex"
      (click)="scrollToIndex(i)"></span>
  </div>
</div>
```

diventa (label rimossa, trattini spostati in cima, nuove classi,
nuovo `[class.done]`):

```html
<div class="exslider-wrap" *ngIf="day && !loading && !errorMsg && state.viewMode() === 'slider'">
  <div class="exslider-dashes" *ngIf="exercises.length > 1">
    <span *ngFor="let vm of exercises; let i = index"
      class="exslider-dash" [class.active]="i === sliderIndex" [class.done]="isComplete(vm)"
      (click)="scrollToIndex(i)"></span>
  </div>

  <div class="exslider" #sliderEl (scroll)="onSliderScroll()">
    ...
  </div>
</div>
```

(il contenuto interno di `.exslider` — righe 98-124 — non cambia).

## CSS

Nuovo blocco in `src/styles.css`, accanto alle regole
`.exslider-counter`/`.exslider-dots`/`.exslider-dot` esistenti (che
restano invariate per `dieta-detail`):

```css
.exslider-dashes{display:flex;justify-content:center;gap:6px;margin-bottom:14px;}
.exslider-dash{width:12px;height:3px;border-radius:2px;background:var(--content-glass-border);cursor:pointer;transition:all .18s ease;}
.exslider-dash.done{background:var(--accent);}
.exslider-dash.active{width:24px;background:var(--accent);}
```

(`.active` da solo basta a colorare e allungare il trattino corrente
anche quando non e' `done`; `.done` colora senza allungare quando non
e' anche `active`.)

## Cosa NON cambia

- `dieta-detail.component.html` e le sue classi condivise
  (`.exslider-counter`/`.exslider-dots`/`.exslider-dot`) restano
  identiche.
- Il contenuto interno delle card dell'esercizio (`.exslider` righe
  98-124) non cambia.
- Nessuna nuova logica di completamento — riuso di `isComplete(vm)`
  gia' esistente.
- La vista lista (`state.viewMode() === 'list'`) non e' toccata da
  questa modifica.

## Test

Nessun test automatico dedicato (nessun `.spec.ts` esistente per
questo componente in questo progetto), ma verifica tramite `npx tsc
--noEmit -p tsconfig.app.json`, `npx ng test --watch=false` (conteggio
invariato), `npx ng build`, e verifica manuale: nella vista slider
della scheda, la label "Esercizio X di Y" non compare piu'; i trattini
sono in cima, quello dell'esercizio corrente e' piu' lungo e colorato
anche se non ancora completato; gli esercizi con tutte le serie
spuntate hanno il trattino colorato anche quando non sono quello
corrente; la vista slider della dieta (pasti) resta invariata (pallini,
label "Pasto X di Y" ancora presente).
