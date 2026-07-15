# Design: bianco come colore primario del testo

Data: 2026-07-15

## Contesto

L'utente ha segnalato, confrontando l'app con l'immagine di riferimento
gia' usata per il redesign del tema ("Track your daily balance"), che
"il colore del testo non rispecchia l'immagine" e che "deve essere usato
il bianco come colore primario". Nel riferimento il bianco domina quasi
ovunque (titoli, sottotitoli, date, etichette); il verde/arancione compare
solo su 2-3 valori "hero" (percentuale progresso, passi, calorie) e su una
singola parola evidenziata dentro un titolo ("Track **your** daily
balance").

Nell'app attuale, `color:var(--accent)` (verde lime) e' invece usato come
colore del testo in 24 punti diversi di `src/styles.css`, molti dei quali
sono testo puramente informativo (date, quantita', etichette categoria,
numeri di badge) senza alcun significato di stato.

## Criterio di classificazione

Per ciascuno dei 24 punti, si applica questa regola:

- **Diventa bianco** (usando la gerarchia di bianco gia' esistente
  `--label`/`--label-2`/`--label-3`) se il colore serve solo a
  decorare/evidenziare testo puramente informativo, senza rappresentare
  uno stato dell'interfaccia.
- **Resta verde/arancione** se il colore rappresenta uno STATO funzionale
  gia' esistente (spuntato, selezionato, attivo, aperto, on/off) — stesso
  ruolo che il colore ha nel riferimento per le sole 2-3 metriche
  evidenziate — oppure e' un highlight intenzionale gia' deciso in una
  feature precedente di questa stessa sessione (etichetta "Grassi").

## Elementi che diventano bianco (10)

Per ciascuno, il valore di bianco scelto rispecchia la prominenza gia'
stabilita dal contesto circostante nel file (confrontato con l'elemento
"fratello" piu' vicino gia' presente):

| Selettore | File (contesto) | Nuovo valore | Motivo |
|---|---|---|---|
| `.weekpicker .wk-sub` | riga 152 | `var(--label-3)` | sottotitolo sotto `.wk-label` (gia' `--label`), stesso ruolo di `.settable-head` (gia' `--label-3`) |
| `.daycard .badge` | riga 159 | `var(--label)` | numero badge in grassetto, resta prominente; sfondo `--accent-dim` invariato |
| `.daymeta span.rec` | riga 169 | rimuove la riga (eredita `--label-2` da `.daymeta`) | `.daymeta` ha gia' `color:var(--label-2)` come base |
| `.serie-badge` | riga 215 | `var(--label)` | stesso ruolo di `.daycard .badge` |
| `.meal-preview-catlabel` | riga 343 | `var(--label-3)` | etichetta categoria lato coach, stesso ruolo di `.fooditem-category` |
| `.history-date` | riga 374 | `var(--label)` | resta piu' prominente della riga sottostante `.history-ex` (gia' `--label-2`) |
| `.fooditem-category` (base) | riga 400 | `var(--label-3)` | `.fooditem-category.fat` resta `var(--imp-amber)`, invariato dalla feature precedente |
| `.fooditem .fqty` | riga 405 | `var(--label-2)` | valore secondario accanto al nome alimento (`.fname`, senza colore esplicito = bianco pieno ereditato) |
| `.infowave` | riga 421 | `var(--label-2)` | riga informativa piana ("S1 → 4×10 reps") |
| `.consigli li::before` | riga 426 | rimuove la riga (eredita `--label-2` da `.consigli li`) | `.consigli li` ha gia' `color:var(--label-2)` come base |

## Elementi che restano colorati (14 — stati funzionali o highlight intenzionali)

Nessuna modifica a questi selettori:

- `.ex.open .ex-chevron` — icona chevron, stato "aperto"
- `.ex-counter.complete` — stato "completato" (contatore serie)
- `.rip-input:focus,.load-input:focus` — bordo, stato "focus" (non e' color del testo)
- `.set-check.done` — stato "spuntato"
- `.measure-input-wrap:focus-within` — bordo, stato "focus"
- `.measure-selectrow.selected` — bordo/sfondo, stato "selezionato"
- `.ms-dot.on` — bordo/sfondo, stato "on"
- `.client-status.on` — stato "cliente attivo" (lato coach)
- `.method-icon` — icona (non testo)
- `.mycode-value` — valore evidenziato intenzionalmente (codice invito da copiare/condividere)
- `.suggestion-chip b` — parola in grassetto evidenziata dentro un suggerimento, stesso schema della parola "your" nel riferimento
- `.meal.open .chevron` — icona chevron, stato "aperto"
- `.variant-tabs button.active` — stato "attivo" (tab combinazione pasto)
- `.altwrap.open .altwrap-header` (+ `.altwrap.open .altwrap-header .chevron`) — stato "aperto" (accordion alternative)

## Cosa NON cambia

- Nessuna modifica a `--imp-red`/`--accent`/`--imp-amber` ne' ad alcuna
  variabile CSS — questa e' una modifica di QUALI selettori usano quelle
  variabili, non delle variabili stesse.
- Nessuna modifica a `--label`/`--label-2`/`--label-3` — si riusa la
  gerarchia di bianco gia' esistente, nessun nuovo valore.
- Nessuna modifica a `.fooditem-category.fat` (arancione, feature
  precedente) ne' a nessuno dei 14 stati funzionali elencati sopra.
- Nessuna modifica a componenti/template — questa e' una modifica
  puramente di `src/styles.css` (le 2 rimozioni di riga fanno si' che
  l'elemento erediti il colore gia' impostato dal genitore, nessun nuovo
  markup).

## Test

Nessun test automatico (modifica puramente di stile CSS, nessuna logica
applicativa). Verifica tramite `npx tsc --noEmit -p tsconfig.app.json`,
`npx ng test --watch=false` (conteggio invariato), `npx ng build`, e
verifica visiva manuale: i 10 elementi elencati devono apparire bianchi
(nelle rispettive tonalita' di gerarchia), i 14 elementi funzionali devono
restare esattamente colorati come prima (nessuna regressione sugli stati
spuntato/selezionato/attivo/aperto).
