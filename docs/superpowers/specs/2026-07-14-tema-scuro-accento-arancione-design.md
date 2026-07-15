# Design: sfondo scurito + nuovo accento arancione

Data: 2026-07-14

## Contesto

L'utente ha fornito uno screenshot di un'altra app fitness ("Track your
daily balance") come riferimento di stile: sfondo quasi nero fisso, card
piatte con bordo sottile, accenti verde (passi/progresso) + arancione
(calorie), titoli bold molto grandi.

Confermato con l'utente l'ampiezza del cambiamento ("via di mezzo"): non
un redesign completo (lo sfondo animato e il vetro liquido delle card
restano come concetto), ma uno scurimento del gradiente di sfondo verso
toni quasi neri, piu' vicini al riferimento, e l'introduzione di un nuovo
accento arancione (in aggiunta al verde lime gia' primario), scelto
dall'utente come "palette completamente nuova, verde+arancione".

Colori campionati dall'immagine di riferimento via analisi pixel (PIL):
arancione del testo "325" (Calorie) ≈ `#E7B56F`; sfondo schermo del
riferimento ≈ `#0C0B10`/`#151723`.

## Sfondo

`body::before` (`src/styles.css`) mantiene identici `position:fixed`,
`inset:-20%`, `filter:blur(16px) saturate(108%)` e l'animazione `bgDrift`
(26s, invariata) — cambia solo il gradiente di colore, da quello vivace
lime/teal/navy a una versione scurita:

```css
background: linear-gradient(200deg,
  #1C2A22 0%,
  #16202A 40%,
  #10131C 75%,
  #0C0D14 100%);
```

La variabile `--bg` (`:root`, oggi `#181624`) diventa `#0C0D14`, coerente
con l'ultimo stop del gradiente (stesso pattern gia' in uso: l'ultimo stop
del gradiente coincide sempre con `--bg`). `--bg` e' usata anche come base
`html, body { background: var(--bg); }` e nel fade `.navbar::before`
(`linear-gradient(to bottom, var(--bg) 0%, var(--bg) 55%, rgba(10,13,19,0)
100%)`) — nessuna modifica di codice li', il nuovo valore si propaga
automaticamente.

`<meta name="theme-color">` in `index.html` (oggi `#181624`) diventa
`#0C0D14` per restare coerente con `--bg` — stesso dettaglio che era stato
mancato nella migrazione palette precedente e corretto solo in revisione
finale; questa volta e' incluso da subito.

`body::after` (la texture di linee ondulate, gia' shippata) **non cambia**
— stessa opacita' 0.06, stesso data-URI, stessa animazione `bgDrift` in
sincrono col nuovo gradiente scurito.

## Card / effetto vetro

**Nessuna modifica.** `--content-glass-bg`, `--glass-bg`,
`--content-glass-border`, e tutte le regole che li usano (`.meal`, `.ex`,
`.daycard`, `.weekpicker`, `.daymeta`, `.tabbar`, `.rocker`,
`.resttimer`, ecc. — blur, bordi, ombre inset) restano esattamente come
sono. Solo lo sfondo dietro le card cambia; l'effetto vetro liquido resta
identico.

## Nuovo accento arancione

Nuove variabili in `:root`:

```css
--imp-amber: #E7B56F;
--imp-amber-dim: rgba(231,181,111,0.18);
```

Al loro posto vengono **rimosse** le variabili della palette precedente
che oggi risultano senza alcun consumatore in tutto il codice (verificato
con grep su `src/`, zero occorrenze fuori dalle loro stesse definizioni in
`styles.css`):

- `--imp-crimson`, `--imp-crimson-dim` (teal, accento secondario mai
  effettivamente disegnato a schermo)
- `--imp-ember`, `--imp-ember-dim` (blu-navy, accento terziario mai
  effettivamente disegnato a schermo)
- `--sys-teal`, `--sys-teal-dim` (alias di `--imp-crimson-dim`, morte)
- `--sys-blue`, `--sys-blue-dim` (alias di `--imp-ember`/`-dim`, morte)
- `--off`, `--off-dim` (alias di `--imp-crimson`/`-dim`, morte — il
  `.rocker` usa gia' solo `var(--accent)` per il knob, indipendentemente
  dallo stato on/off, quindi `--off`/`--off-dim` non hanno mai avuto un
  consumatore reale)

**Applicazione concreta** (l'unico punto visivo toccato): l'etichetta di
categoria "Grassi" nella schermata Dieta del cliente
(`dieta-detail.component.html`, classe `.fooditem-category`, usata in 2
punti — la vista combinazione principale e l'accordion "Alternative").
Aggiunto `[class.fat]="cat === 'fat'"` a entrambi i `<p
class="fooditem-category">`, e una nuova regola:

```css
.fooditem-category.fat{color:var(--imp-amber);}
```

"Carboidrati" e "Proteine" restano verdi (`var(--accent)`, invariato).
Nessun'altra modifica: `.meal-preview-catlabel` (usata solo lato coach in
`coach-protocol-builder.component.html`) non viene toccata — fuori scope,
il redesign riguarda la vista cliente.

## Cosa NON cambia

- Nessuna modifica a `--imp-red`/`--imp-red-dim` (verde lime, accento
  primario/successo) ne' a `--state-success*`/`--state-danger*` (stati
  successo/errore, gia' coerenti dalla palette precedente).
- Nessuna modifica strutturale a card/blur/bordi (vedi sopra).
- Nessuna modifica a `body::after` (texture onde).
- Nessuna modifica alla vista coach (`coach-protocol-builder.component.html`).
- Nessuna modifica a `.rocker` (il knob usa gia' solo `var(--accent)`,
  indipendente da on/off — rimuovere `--off`/`--off-dim` non cambia il suo
  aspetto, dato che non li consumava).

## Test

Nessun test automatico (modifica puramente di stile CSS + due binding di
classe in un template, nessuna logica applicativa nuova). Verifica tramite
`npx tsc --noEmit -p tsconfig.app.json`, `npx ng test --watch=false`
(conteggio invariato), `npx ng build`, grep di conferma che le variabili
rimosse non abbiano piu' occorrenze in nessun file sotto `src/`, e verifica
visiva manuale: sfondo scurito coerente col mockup approvato, "Grassi"
arancione mentre "Carboidrati"/"Proteine" restano verdi, nessuna
regressione visibile su card/vetro/texture onde.
