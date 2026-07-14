# Design: fix ombra negli slider + carosello "peek"

Data: 2026-07-14

## Contesto

L'utente ha segnalato con screenshot un artefatto visivo — un contorno
rettangolare "fantasma" (angoli piu' squadrati del previsto) visibile
dietro le card dello slider Dieta, sia in alto sia in basso, piu'
evidente ora con la nuova palette piu' chiara. Con una seconda immagine
di riferimento ha chiarito di voler ottenere un carosello "peek": la
card corrente centrata, con una porzione visibile della card
precedente/successiva ai lati, come effetto voluto (non un bug).

## Causa dell'ombra: bug noto di Safari, gia' risolto altrove nell'app

Le card `.meal` (Dieta) e `.ex` (Scheda) combinano `overflow:hidden`,
`border-radius` e `backdrop-filter` sullo stesso elemento — una
combinazione con cui Safari a volte non ritaglia correttamente gli
angoli arrotondati durante il rendering/scroll, mostrando un contorno
rettangolare visibile ai bordi (esattamente l'artefatto nello
screenshot). Questa app ha gia' risolto lo stesso problema altrove
(`.resttimer`, riga 422 di `styles.css`) con questo trucco CSS:

```css
-webkit-mask-image:-webkit-radial-gradient(white,black);
mask-image:radial-gradient(white,black);
```

**Fix**: applico lo stesso trucco, verbatim, a `.meal` e `.ex` (le
classi base, non solo le varianti slider — la stessa combinazione di
proprieta' che causa il bug e' presente anche nella vista lista/accordion,
quindi il fix si applica ovunque queste card compaiono, senza effetti
collaterali visibili: e' lo stesso trattamento gia' in produzione su
`.resttimer`, non un effetto nuovo).

## Carosello "peek"

Ambito confermato: **sia** lo slider Dieta (pasti) **sia** lo slider
Scheda (esercizi) — condividono gia' lo stesso CSS (`.exslider`/
`.exslide`), quindi lo stesso trattamento in entrambi.

Oggi ogni slide occupa il 100% della larghezza del contenitore
scrollabile (`.exslide{flex:0 0 100%;width:100%;...}`), quindi nessuna
card adiacente e' mai visibile. Per mostrare un pezzo (~28px) della
card precedente/successiva su entrambi i lati quando una card e'
centrata:

```css
.exslider{
  display:flex;
  gap:12px;
  overflow-x:auto;
  scroll-snap-type:x mandatory;
  -webkit-overflow-scrolling:touch;
  scrollbar-width:none;
  padding:0 28px 2px;
}
.exslide{
  flex:0 0 calc(100% - 56px);
  width:calc(100% - 56px);
  scroll-snap-align:center;
  scroll-snap-stop:always;
}
```

`28px` di padding su ciascun lato del contenitore + `56px` (28×2) in
meno sulla larghezza di ogni slide: quando una slide e' agganciata al
centro (scroll-snap), il padding del contenitore rivela esattamente
28px della card adiacente su ciascun lato, coerente con l'immagine di
riferimento fornita.

## Cosa NON cambia

- Nessuna nuova interazione: le card che si intravedono ai lati
  **non** diventano cliccabili per saltare a quella slide — la
  navigazione resta solo scroll/swipe orizzontale piu' i pallini
  (`.exslider-dots`) gia' esistenti.
- Nessuna modifica al contatore testuale ("Pasto X di Y" / equivalente
  per gli esercizi), ne' alla logica di calcolo dell'indice corrente
  (`onSliderScroll`/`scrollToIndex`, gia' esistenti in
  `dieta-detail.component.ts` e `scheda-detail.component.ts`) — il
  meccanismo di rilevamento della slide piu' vicina (
  `findClosestSlideIndex` in `horizontal-slider.util.ts`) continua a
  funzionare invariato con slide piu' strette.
- Nessuna modifica al contenuto/stile interno delle card (`.meal-summary`,
  `.content-inner`, badge, ecc.) — solo dimensioni/spaziatura del
  contenitore slider e il fix del ritaglio degli angoli.
- La vista lista/accordion (non-slider) di Dieta e Scheda beneficia
  comunque del fix dell'ombra (stesse classi base `.meal`/`.ex`), ma non
  ha alcun carosello "peek" (quello si applica solo dentro
  `.exslider`/`.exslide`, gia' usato solo in modalita' slider).

## Test

Nessun test automatico (modifica puramente di stile CSS, nessuna
logica applicativa). Verifica tramite `npx tsc --noEmit -p
tsconfig.app.json`, `npx ng test --watch=false` (conteggio invariato),
`npx ng build`, e verifica visiva manuale su dispositivo/simulatore
Safari (dove l'ombra era visibile): lo slider Dieta e lo slider Scheda
mostrano entrambi ~28px della card precedente/successiva ai lati
quando una card e' centrata, e l'artefatto rettangolare non e' piu'
visibile ne' nella vista slider ne' nella vista lista.
