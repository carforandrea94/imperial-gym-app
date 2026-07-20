# Design: `workout.weekPlan` desincronizzato dopo modifiche manuali nel builder

Data: 2026-07-20

## Contesto (bug reale, diagnosticato con un utente)

Un cliente segnalava che la pagina Info ("Onda di carico") e il riepilogo
"Settimana X di N" (`scheda-info`/`scheda-list`) mostravano una progressione
fissa 4×10 per tutte le 8 settimane, mentre il PDF del coach prevedeva una
vera progressione a onda (4×10, 4×10, 4×8, 4×8, 5×6, 5×6, 4×10, 4×10).

Indagine svolta (vedi sessione): il parser PDF attuale (`pdf-import.service.ts`)
e' stato verificato corretto rieseguendo la sua logica reale (stesse regex,
stessa libreria `pdfjs-dist`) contro il testo del PDF del cliente — produce
la progressione giusta sia per singolo esercizio (`ex.weekPlan`) sia
nell'aggregato di protocollo (`detectProtocolWeekPlan`). Uno screenshot del
builder ha confermato che il dato per-esercizio (`ex.weekPlan`) salvato per
questo cliente e' effettivamente corretto (S1 4×10 ... S3 4×8 ... S8 4×10).

Root cause trovata: `CoachProtocolBuilderComponent.save()`
(`coach-protocol-builder.component.ts:385-397`) scrive `workout:
this.protocol.workout` cosi' com'e'. Il campo `workout.weekPlan` (usato da
`scheda-info`/`scheda-list`, NON dalla card del singolo esercizio) viene
calcolato una sola volta, al momento dell'import PDF
(`detectProtocolWeekPlan` chiamato da `coach-protocol-import.component.ts`).
Se il coach in seguito modifica manualmente la progressione di un esercizio
nel builder (`onSchemeChange`/`addExWeek`/`removeExWeek`/binding diretto sui
campi wave) e salva, `workout.weekPlan` NON viene ricalcolato: resta
congelato al valore calcolato all'import, che puo' non corrispondere piu' ai
dati per-esercizio effettivamente salvati. Questo spiega la pagina Info
mostrata al cliente, indipendentemente dalla correttezza del dato
per-esercizio (confermata da screenshot).

## Fix

`workout.weekPlan` e' un aggregato derivato, non una fonte di verita'
indipendente: va ricalcolato ogni volta che il protocollo viene salvato dal
builder, cosi' resta sempre sincronizzato con `workout.days` senza bisogno di
rilevare "cosa e' cambiato".

In `CoachProtocolBuilderComponent`:
- Inietta `PdfImportService` (espone gia' `detectProtocolWeekPlan(days,
  totalWeeks)`, pubblico, usato oggi solo da `coach-protocol-import`).
- In `save()`, prima di costruire `toSave`, ricalcola e sovrascrive
  `this.protocol.workout.weekPlan`:
  ```ts
  this.protocol.workout.weekPlan = this.pdfSvc.detectProtocolWeekPlan(
    this.protocol.workout.days,
    this.protocol.workout.weekPlan.length
  );
  ```
  Il secondo argomento (`totalWeeks`) usa la lunghezza attuale di
  `weekPlan` per preservare la durata del programma (alcuni protocolli sono
  a 4 settimane, altri a 8 — non va assunto un valore fisso).
- Nessuna modifica a `detectProtocolWeekPlan` stesso: la funzione e' gia'
  pura e corretta (aggrega la progressione piu' frequente tra gli esercizi
  wave, con fallback 4×10 fisso solo se non ce n'e' nessuno — comportamento
  identico a oggi per i protocolli senza esercizi wave).

## Cosa NON cambia

- Nessuna modifica a `pdf-import.service.ts` (parser e aggregazione gia'
  corretti, verificato).
- Nessuna modifica al modello `Protocol`/`WorkoutProtocol`.
- Nessuna modifica alla card del singolo esercizio (`getExSetsReps` usa
  gia' `ex.weekPlan` quando presente, indipendentemente da
  `workout.weekPlan` — non e' la fonte del problema qui).
- La feature "avviso se le settimane wave sono tutte uguali" discussa in
  brainstorming precedente e' accantonata: lo screenshot ha dimostrato che
  in questo caso il coach aveva gia' compilato correttamente le settimane,
  quindi quella feature non avrebbe risolto il bug reale.

## Rischio di regressione

Il ricalcolo sovrascrive `workout.weekPlan` a ogni salvataggio dal builder,
anche quando il coach non ha tocato la parte "wave". Non e' un problema:
`detectProtocolWeekPlan` e' deterministica sui dati correnti di `days`, per
cui se nulla di rilevante e' cambiato il risultato e' identico a quello
attuale (nessun caso in cui il ricalcolo produce un valore "peggiore" di
quello congelato, dato che la funzione e' la stessa gia' usata e verificata
in import).

## Test

Aggiungo un test a `coach-protocol-builder.component.spec.ts` (il file non
esiste ancora — lo creo, dato che finora il componente non aveva test
dedicati e questo comportamento e' esattamente quello che ha causato il bug
reale, merita una copertura diretta): salvo un protocollo con
`workout.weekPlan` volutamente disallineato dai `days` (simulando lo stato
"post-import poi modificato a mano") e verifico che dopo `save()` il payload
passato a `protocolSvc.update` contenga il `weekPlan` ricalcolato da
`detectProtocolWeekPlan`, non quello originale.
