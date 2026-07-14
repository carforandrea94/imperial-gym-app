# Design: aggiornamento palette colori (wallpaper verde/teal/navy)

Data: 2026-07-14

## Contesto

L'utente ha fornito un'immagine di riferimento (gradiente astratto verde
lime → verde acqua → teal → blu-teal → indaco → navy scuro, con una
texture di linee ondulate) e ha chiesto di aggiornare la UI dell'app con
questi colori e queste tonalita'.

Colori estratti campionando l'immagine (in ordine dal punto piu' chiaro al
piu' scuro):

| Nome        | Hex       |
|-------------|-----------|
| Lime        | `#6DB458` |
| Verde acqua | `#58AD86` |
| Teal        | `#438582` |
| Blu-teal    | `#32566F` |
| Indaco      | `#272B47` |
| Navy scuro  | `#181624` |

Confermato con l'utente tramite due iterazioni su un mockup visivo
(artifact): (1) l'ambito e' "sfondo + accenti" in tutta l'app, non solo lo
sfondo; (2) anche i colori di stato (verde "salvato", rosso "errore")
seguono la stessa tonalita', non solo i 3 accenti di brand.

## Sfondo animato (`body::before` in `src/styles.css`)

Il blob radiale attuale (5 `radial-gradient` che mescolano verde/blu/ambra
in punti fissi) viene sostituito da un unico `linear-gradient` diagonale
con le 6 tonalita' sopra, stessa animazione di deriva gia' esistente
(`bgDrift`), stesso `filter: blur(16px) saturate(108%)`:

```css
background: linear-gradient(200deg,
    #6DB458 0%,
    #58AD86 20%,
    #438582 42%,
    #32566F 64%,
    #272B47 84%,
    #181624 100%);
```

Nessun'altra proprieta' di `body::before` cambia (posizione, animazione,
media query `prefers-reduced-motion` restano identiche).

## Accenti di brand (3 variabili in `:root`)

Le variabili non vengono rinominate — solo il valore cambia, quindi ogni
punto dell'app che le referenzia (via `var(--accent)`, `var(--imp-red)`
ecc.) si aggiorna automaticamente senza toccare altro codice:

| Variabile        | Oggi                        | Nuovo                       |
|-------------------|-----------------------------|------------------------------|
| `--imp-red` (primario) | `#34D399` | `#6DB458` |
| `--imp-red-dim`   | `rgba(52,211,153,0.16)`      | `rgba(109,180,88,0.16)`      |
| `--imp-crimson` (secondario) | `#F5A623` | `#438582` |
| `--imp-crimson-dim` | `rgba(245,166,35,0.18)`    | `rgba(67,133,130,0.18)`      |
| `--imp-ember` (terziario) | `#5B9DF5` | `#32566F` |
| `--imp-ember-dim` | `rgba(91,157,245,0.16)`      | `rgba(50,86,111,0.16)`       |

`--accent`/`--accent-dim`/`--on`/`--on-dim`/`--off`/`--off-dim` sono gia'
alias di questi tre (`var(--imp-red)` ecc.) — non serve toccarli
separatamente, ereditano il cambiamento.

## Sfondo base

`--bg` passa da `#0A0D13` a `#181624` (il navy piu' scuro del wallpaper) —
cambiamento minimo, quasi impercettibile, ma coerente con la nuova
palette invece che con quella precedente.

## Colori di stato: nuove variabili `--state-success`/`--state-danger`

Oggi il verde "salvato/fatto" (`#30D158`) e il rosso "errore" (`#FF453A`)
sono valori esadecimali ripetuti alla lettera in piu' punti di
`styles.css` (nessuna variabile CSS li centralizza — `--sys-red` esiste
ma non e' mai referenziato con `var()`). Introduco due nuove variabili in
`:root` e sostituisco ogni occorrenza letterale con un riferimento ad
esse, cosi' il colore vive in un solo posto:

```css
--state-success: var(--imp-red);   /* stesso verde lime dell'accento primario */
--state-danger: #5C2B39;           /* vino scuro, freddo — non piu' rosso pieno */
```

`--sys-red` (variabile esistente, oggi mai referenziata da nessun altro
file) diventa `var(--state-danger)` per coerenza, anche se resta
inutilizzata altrove.

**Tutte le occorrenze letterali da sostituire con `var(--state-success)`**
(`src/styles.css`):
- riga 111: `.saveworkout-icon.saved{background:#30D158;...}`
- riga 215: `.spark-delta.up{color:#30D158;}`
- riga 237: `.delta.down{color:#30D158;}`
- riga 363: `.savebtn.saved{background:#30D158;...}`
- riga 419: `.resttimer.finished .resttimer-time{color:#30D158;}`

**Tutte le occorrenze letterali da sostituire con `var(--state-danger)`**
(`src/styles.css`):
- riga 112: `.saveworkout-icon.err{background:#FF453A;...}`
- riga 364: `.savebtn.err{background:#FF453A;...}`
- riga 431: `.confirmbtn.danger{background:#FF453A;...}`

**Un'occorrenza fuori da `styles.css`** da aggiornare:
- `src/app/pages/scheda-info/scheda-info.component.html:18` — lo stile
  inline `color:#30D158` sul marcatore "← sei qui" diventa
  `color:var(--state-success)` (le custom property CSS funzionano anche
  negli attributi `style` inline).

I numeri di riga sopra sono quelli attuali (prima di qualunque modifica);
l'ordine di sostituzione durante l'implementazione puo' far scalare i
numeri successivi — chi implementa deve cercare le stringhe esatte
(`#30D158`, `#FF453A`), non affidarsi ciecamente ai numeri di riga.

## Cosa NON cambia (deciso esplicitamente, non dimenticato)

- **Colori dei gruppi muscolari** (`workout-data.service.ts`, oggetto
  `MUSCLES`): palette categorica separata per distinguere visivamente i
  gruppi (Petto, Dorso, Bicipiti...). Il valore `#30D158` per "Bicipiti"
  e' una **coincidenza** con il vecchio verde di stato — resta
  `#30D158` letterale, NON diventa `var(--state-success)` e NON cambia
  colore. Chi implementa deve fare attenzione a non confondere questa
  occorrenza con quelle da sostituire.
- **`--sys-cyan`/`--sys-cyan-dim`** (`#64D2FF`, usato solo dal riempimento
  del timer di recupero `.resttimer-fill`): non fa parte ne' degli
  accenti di brand ne' dei colori di stato richiesti — resta invariato.
- Nessuna modifica a componenti/logica applicativa: e' un cambiamento
  puramente di variabili CSS + un blocco di stile, nessun file `.ts`
  (eccetto l'unico stile inline sopra) viene toccato.

## Addendum: occorrenze aggiuntive trovate scrivendo il piano

Un'ispezione esaustiva di `styles.css` (grep di ogni valore da cambiare)
ha rivelato piu' occorrenze di quelle elencate sopra, incluse due
definizioni **duplicate e in conflitto** di `.savebtn` e
`.confirmbtn.danger` (una prima, una dopo nel file — vince quella dopo
per ordine di cascata CSS, l'altra e' codice morto mai renderizzato).
Elenco completo, verificato riga per riga:

**Nuove variabili da aggiungere in `:root`** (oltre a quelle gia'
elencate sopra), per evitare di ripetere gli stessi valori come literal
in piu' punti:

```css
--state-success: var(--imp-red);        /* #6DB458 */
--state-success-rgb: 109,180,88;        /* per rgba(var(...), alpha) */
--state-success-deep: #3C6330;          /* verde scuro, sostituisce #0F7A57 nei gradienti */
--state-success-deep-rgb: 60,99,48;
--state-danger: #5C2B39;
--state-danger-rgb: 92,43,57;
--state-danger-deep: #33181F;           /* vino scuro, per il secondo stop dei gradienti */
--state-danger-deep-rgb: 51,24,31;
```

`--sys-red` diventa `var(--state-danger)` (nessun altro file lo
referenzia con `var()`, ma resta coerente).

**`.savebtn`/`.confirmbtn.danger` — la vera domanda emersa**: il bottone
`.savebtn` (usato per "Completa allenamento", "Riprova" e altri bottoni
primari in tutta l'app) ha oggi, nella definizione che vince davvero
(quella piu' in basso nel file, righe 586-589), uno sfondo **rosso
"vetro imperiale"** (`linear-gradient(180deg, rgba(255,46,46,0.52),
rgba(150,10,26,0.42))`), indipendente da qualunque accento verde.
Confermato con l'utente: **anche questo diventa la nuova palette**
(lime/teal), non resta rosso.

**Elenco esaustivo di ogni riga da modificare in `src/styles.css`** (i
numeri sono quelli attuali, prima di qualunque modifica — chi implementa
deve cercare le stringhe esatte, non affidarsi ciecamente ai numeri se
sono gia' cambiati da un edit precedente nello stesso file):

| Riga | Oggi | Diventa | Note |
|------|------|---------|------|
| 5 | `--bg:#0A0D13;` | `--bg:#181624;` | gia' previsto sopra |
| 108 | `background:linear-gradient(90deg,#0F7A57,var(--imp-red));` | `background:linear-gradient(90deg,var(--state-success-deep),var(--imp-red));` | `.saveworkout-icon` — reale |
| 111 | `background:#30D158;` | `background:var(--state-success);` | `.saveworkout-icon.saved` — reale |
| 112 | `background:#FF453A;` | `background:var(--state-danger);` | `.saveworkout-icon.err` — reale |
| 215 | `color:#30D158;` | `color:var(--state-success);` | `.spark-delta.up` — reale |
| 216 | `color:#FF6961;` | **invariato** | `.spark-delta.down` — fuori scope, colore diverso non discusso |
| 236 | `color:#FF6961;` | **invariato** | `.delta.up` — fuori scope, idem |
| 237 | `color:#30D158;` | `color:var(--state-success);` | `.delta.down` — reale |
| 351 | `background:linear-gradient(90deg,#0F7A57,var(--imp-red));` | `background:linear-gradient(90deg,var(--state-success-deep),var(--imp-red));` | `.savebtn` — **codice morto** (sovrascritto da riga 586), aggiornato comunque per pulizia |
| 363 | `background:#30D158;` | `background:var(--state-success);` | `.savebtn.saved` — codice morto (sovrascritto da riga 591) |
| 364 | `background:#FF453A;` | `background:var(--state-danger);` | `.savebtn.err` — codice morto (sovrascritto da riga 592) |
| 415 | `background:rgba(48,209,88,0.3);` | `background:rgba(var(--state-success-rgb),0.3);` | `.resttimer.finished .resttimer-fill` — reale |
| 419 | `color:#30D158;` | `color:var(--state-success);` | `.resttimer.finished .resttimer-time` — reale |
| 431 | `background:#FF453A;` | `background:var(--state-danger);` | `.confirmbtn.danger` (prima definizione) — codice morto (sovrascritto da riga 596) |
| 587 | `background: linear-gradient(180deg, rgba(255,46,46,0.52), rgba(150,10,26,0.42));` | `background: linear-gradient(180deg, rgba(var(--state-success-rgb),0.52), rgba(var(--state-success-deep-rgb),0.42));` | `.savebtn` (seconda definizione) — **reale, vince nella cascata** |
| 591 | `background: rgba(48,209,88,0.85);` | `background: rgba(var(--state-success-rgb),0.85);` | `.savebtn.saved` (seconda definizione) — reale |
| 592 | `background: rgba(255,69,58,0.85);` | `background: rgba(var(--state-danger-rgb),0.85);` | `.savebtn.err` (seconda definizione) — reale |
| 596 | `background: linear-gradient(180deg, rgba(255,69,58,0.60), rgba(150,10,26,0.48));` | `background: linear-gradient(180deg, rgba(var(--state-danger-rgb),0.60), rgba(var(--state-danger-deep-rgb),0.48));` | `.confirmbtn.danger` (seconda definizione) — **reale, vince nella cascata** |

Nessun colore di testo (`color:`) cambia in nessuna di queste regole —
solo gli sfondi. `#FF6961` (righe 216, 236, un rosso "andamento
sfavorevole" per le misure, distinto sia dal rosso errore sia da
qualunque accento) resta **esplicitamente invariato**: non fa parte dei
colori di stato discussi (solo verde salvato + rosso errore).

## Test

Nessun test automatico (modifica puramente di stile CSS, nessuna logica
applicativa). Verifica tramite `npx tsc --noEmit -p tsconfig.app.json`,
`npx ng test --watch=false` (conteggio invariato), `npx ng build`, e
verifica visiva manuale: sfondo animato, bottoni/badge con i nuovi
accenti, stato "salvato" verde lime, stato "errore" vino scuro, il
bottone principale (Completa allenamento/Riprova) non piu' rosso, colori
dei gruppi muscolari e del delta misure (`#FF6961`) invariati.
