# Design: texture di linee ondulate sullo sfondo animato

Data: 2026-07-14

## Contesto

Con la nuova palette (PR #38, gia' mergiata) lo sfondo animato dell'app e'
un unico `body::before` con un gradiente lineare a 6 tappe, sfocato
(`filter:blur(16px) saturate(108%)`) e animato con una deriva lenta
(`bgDrift`, 26s, alternata). L'utente ha fornito un'immagine di
riferimento (lo stesso wallpaper usato per estrarre la palette) e ha
chiesto di aggiungere la texture di sottili linee ondulate visibile in
quell'immagine, confermando esplicitamente di volerla ("Si', aggiungi le
linee ondulate").

Il blur di 16px su `body::before` cancellerebbe qualunque texture sottile
se applicata sullo stesso layer — la texture deve quindi vivere su un
layer separato, senza blur.

## Approccio

Nuovo pseudo-elemento `body::after`, fratello di `body::before` (stesso
`position:fixed;inset:-20%` cosi' segue lo stesso movimento, stesso
`z-index:0` — essendo generato dopo `::before` nell'ordine di documento,
si dispone gia' sopra di esso senza bisogno di un valore di stacking
diverso, e resta comunque sotto `.wrap` che ha `z-index:1`).

Contenuto: un pattern SVG inline (data-URI), ripetuto in tile, con 3
linee curve orizzontali (bezier morbide) che si susseguono verticalmente.
Il tile e' costruito per essere seamless in orizzontale (ogni curva parte
e finisce alla stessa altezza Y con la stessa pendenza a inizio/fine
tratto), cosi' la ripetizione `repeat` non mostra giunte visibili.

```css
body::after {
  content: '';
  position: fixed;
  inset: -20%;
  pointer-events: none;
  z-index: 0;
  background-image: url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='240'%20height='240'%20viewBox='0%200%20240%20240'%3E%3Cpath%20d='M0,40%20C30,20%2060,60%20120,40%20C180,20%20210,60%20240,40'%20stroke='white'%20stroke-width='1.2'%20fill='none'%20stroke-linecap='round'/%3E%3Cpath%20d='M0,120%20C30,100%2060,140%20120,120%20C180,100%20210,140%20240,120'%20stroke='white'%20stroke-width='1.2'%20fill='none'%20stroke-linecap='round'/%3E%3Cpath%20d='M0,200%20C30,180%2060,220%20120,200%20C180,180%20210,220%20240,200'%20stroke='white'%20stroke-width='1.2'%20fill='none'%20stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: repeat;
  background-size: 240px 240px;
  opacity: 0.08;
  mix-blend-mode: soft-light;
  animation: bgDrift 26s var(--spring-soft) infinite alternate;
}
```

Note sui valori:
- `opacity: 0.08` + `mix-blend-mode: soft-light`: le linee bianche restano
  appena percettibili, si fondono nel gradiente sottostante invece di
  sembrare un overlay piatto. Questo e' il parametro piu' facile da
  tarare a vista (vedi Test) senza rigenerare l'SVG.
- Stessa animazione `bgDrift` (identica durata/easing/keyframes di
  `body::before`): la texture si muove in sincrono con il gradiente,
  percepita come parte dello stesso sfondo invece che un layer scollegato.
- `background-size: 240px 240px` corrisponde esattamente al `viewBox`
  dell'SVG (240x240) — 1 tile SVG = 1 tile CSS, nessuno scaling.

## Cosa NON cambia

- `body::before` (gradiente + blur + `bgDrift`) resta invariato — nessuna
  modifica ai suoi valori.
- Nessuna nuova variabile CSS, nessun nuovo elemento nel DOM (solo un
  altro pseudo-elemento, stesso pattern strutturale di `::before`).
- Rispetto del `prefers-reduced-motion` gia' gestito per `::before`: la
  regola esistente

  ```css
  @media (prefers-reduced-motion: reduce) {
    body::before { animation: none; }
  }
  ```

  si estende a `body::after` nello stesso blocco, cosi' anche la texture
  smette di muoversi quando l'utente ha impostato la preferenza di
  sistema.
- Nessun impatto su altri elementi: `pointer-events:none` e `z-index:0`
  (sotto `.wrap`) replicano esattamente il trattamento di `body::before`,
  quindi la texture resta puramente decorativa e non interferisce con
  click/tap su nessun contenuto.

## Test

Nessun test automatico (modifica puramente decorativa di CSS, nessuna
logica applicativa). Verifica tramite `npx tsc --noEmit -p
tsconfig.app.json`, `npx ng test --watch=false` (conteggio invariato),
`npx ng build`, e verifica visiva manuale: le linee ondulate devono essere
visibili ma sottili (non devono "rumoreggiare" sopra i contenuti), devono
muoversi in sincrono con il resto dello sfondo, e devono sparire con
`prefers-reduced-motion` attivo. Se l'opacita' risultasse troppo
marcata/debole rispetto all'immagine di riferimento, l'unico valore da
ritoccare e' `opacity` su `body::after` (nessuna altra modifica
necessaria).
