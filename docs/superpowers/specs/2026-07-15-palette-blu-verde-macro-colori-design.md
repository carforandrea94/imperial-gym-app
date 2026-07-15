# Design: palette blu/verde, rimozione texture onde, colori macro

Data: 2026-07-15

## Contesto

L'utente ha chiesto, basandosi sulla stessa immagine di riferimento gia'
usata in questa sessione ("Track your daily balance"): rimuovere la
texture di linee ondulate dallo sfondo, e adottare come colori
primary/secondary dell'app quelli usati nel riferimento per il testo
enfatizzato e per i bottoni.

Colori campionati dall'immagine (analisi pixel via PIL):
- Testo enfatizzato ("your", "13%", "1862"): verde menta ≈ `#80D09A`
- Bottoni/tab attiva ("Today", icona battito cardiaco): blu chiaro ≈ `#A4C2F6`

Dopo un confronto visivo di piu' varianti (Artifact), l'utente ha scelto:
**blu `#A4C2F6` come primario**, **verde `#80D09A` come secondario**
(invertito rispetto alla mappatura iniziale testo→primario/bottone→secondario).
Ha inoltre chiesto che la pillola attiva della tabbar usi lo stesso
meccanismo di colore gia' usato da ogni altro stato "attivo" dell'app
(`var(--accent)`, cioe' il primario), non un colore secondario dedicato.

Infine, ha chiesto due colori aggiuntivi per le etichette macro
"Carboidrati"/"Proteine" (oggi bianche, dalla feature precedente
"testo bianco primario") — "Grassi" resta il colore secondario gia'
deciso. Confermati via anteprima visiva: ambra `#E8C468` (Carboidrati),
corallo `#E8918A` (Proteine).

## Rimozione texture onde

Elimina interamente `body::after` (`src/styles.css`, il pseudo-elemento
con il pattern SVG di linee ondulate, shippato in una feature precedente
di questa sessione) e la sua menzione nel blocco
`@media (prefers-reduced-motion: reduce)` (che torna a riguardare solo
`body::before`). `body::before` (gradiente + blur + `bgDrift`) resta
invariato.

## Colori primario e secondario

```css
--imp-red:#A4C2F6;                     /* blu — accento primario */
--imp-red-dim:rgba(164,194,246,0.16);
--imp-amber:#80D09A;                   /* verde — accento secondario */
--imp-amber-dim:rgba(128,208,154,0.18);
```

Nessun'altra modifica ai nomi delle variabili o ai loro consumatori: dato
che quasi tutti gli usi di colore-testo sono gia' stati convertiti al
bianco nella feature precedente, i consumatori rimanenti di
`--accent`/`--imp-red` sono oggi solo stati funzionali (badge, bottone
Salva, spuntato, tab varianti attiva, puntini settimana, contatore
completato, ecc.) — questi assumono automaticamente il nuovo blu tramite
la cascata della variabile, senza toccare i singoli selettori.
`--imp-amber` ha oggi un solo consumatore, `.fooditem-category.fat`
(etichetta "Grassi"), che assume automaticamente il nuovo verde.

## Pillola attiva della tabbar

Trova questa riga (`src/styles.css`):

```css
.tabbar .tabbtn.active{color:var(--label);}
```

Sostituiscila con:

```css
.tabbar .tabbtn.active{color:var(--accent);}
```

Lo sfondo della pillola (`.tabbar .pill{background:var(--bg-card-2);...}`)
**non cambia** — scelta confermata dall'utente su un confronto di 3
varianti visive (sfondo invariato, sfondo piu' chiaro campionato dal
riferimento, velatura blu — ha scelto "sfondo invariato").

## Colori macro Carboidrati/Proteine

Due nuove variabili in `:root`:

```css
--macro-carb:#E8C468;      /* ambra — etichetta "Carboidrati" */
--macro-protein:#E8918A;   /* corallo — etichetta "Proteine" */
```

Due nuove regole CSS (accanto a `.fooditem-category.fat`, gia' esistente):

```css
.fooditem-category.carb{color:var(--macro-carb);}
.fooditem-category.protein{color:var(--macro-protein);}
```

Nel template `dieta-detail.component.html`, nei 2 punti dove oggi c'e'
`[class.fat]="cat === 'fat'"` (vista combinazione principale e accordion
"Alternative"), aggiunti anche `[class.carb]="cat === 'carb'"` e
`[class.protein]="cat === 'protein'"` sullo stesso elemento
`<p class="fooditem-category">`.

La regola BASE `.fooditem-category{color:var(--label-3);}` (bianco,
dalla feature precedente) resta come fallback ma non viene piu' mai
mostrata per le 3 categorie esistenti, dato che ciascuna ha ora un
modificatore di colore dedicato — non e' rimossa (nessun'altra categoria
esiste oggi oltre a `carb`/`protein`/`fat`, ma la regola base resta un
fallback sicuro se in futuro se ne aggiungesse una).

`.meal-preview-catlabel` (vista coach, `coach-protocol-builder.component.html`)
**non viene toccata** — resta bianca (`--label-3`), fuori scope, stessa
decisione gia' presa per il colore "Grassi" nella feature precedente.

## Cosa NON cambia

- Nessuna modifica a `--state-success`/`--state-danger`/`--sys-cyan`/
  `--on`/`--on-dim` ne' ad alcuna regola che li consuma.
- Nessuna modifica alla struttura HTML/CSS delle card, del vetro liquido,
  o dello sfondo (`body::before`).
- Nessuna modifica alla vista coach.
- Nessuna modifica a `body::before` o alla sua animazione.

## Test

Nessun test automatico (modifica di variabili CSS + regole di colore +
2 binding di classe aggiuntivi in un template gia' modificato per `.fat` —
nessuna logica applicativa nuova). Verifica tramite `npx tsc --noEmit -p
tsconfig.app.json`, `npx ng test --watch=false` (conteggio invariato),
`npx ng build`, e verifica visiva manuale: sfondo senza piu' texture
ondulata, accento primario blu ovunque (badge, bottone Salva, spuntato,
tab attiva, puntini settimana, pillola tabbar), "Grassi" verde,
"Carboidrati" ambra, "Proteine" corallo, vista coach invariata (etichette
categoria ancora bianche).
