# Design: suggerimento di riscaldamento sul primo esercizio del giorno

Data: 2026-07-17

## Contesto

Ogni esercizio puo' avere una nota testuale libera (`Exercise.note`, es.
"4X10 4X10 4X8 4X8 5X6 5X6 … E RIPRENDI DA 4X10 AUMENTANDO IL CARICO
RISPETTO ALL SETT.1 SCORSA"), mostrata oggi in cima alla card
dell'esercizio (`scheda-detail.component.html:9`,
`<p class="note" *ngIf="vm.ex.note">`).

L'utente ha segnalato (screenshot) che vuole, per il primo esercizio
di ogni giorno, un'indicazione di quale carico usare per il
riscaldamento, calcolata sul peso massimo usato per quell'esercizio
nella sessione precedente. La nota in cima alla card resta invariata
per tutti gli esercizi, incluso il primo — il riscaldamento va
aggiunto in fondo alla card, sotto il blocco "Progressione" (`ex-insights`),
solo sulla prima card.

## Dato gia' disponibile (riusato, nessun nuovo accesso allo storico)

`loadInsights()` (`scheda-detail.component.ts:170-235`) gia' calcola,
per ogni esercizio, `maxLoads: number[]` — il carico massimo per
sessione passata, in ordine cronologico. `maxLoads[maxLoads.length-1]`
e' gia' usato (riga 225) come base del suggerimento di progressione
("Prova X kg"): e' esattamente il "peso massimo utilizzato nella
sessione precedente" per quell'esercizio specifico. Il riscaldamento
riusa lo stesso valore, nessuna nuova query/servizio.

## 1. Identificare il primo esercizio

Nuovo campo `isFirst: boolean` su `ExerciseVM`
(`scheda-detail.component.ts`, interfaccia locale al componente),
impostato in `buildExercises()`
(`scheda-detail.component.ts:124-140`) in base all'indice nella
mappatura di `this.day.ex` (`i === 0`).

## 2. Calcolo del riscaldamento

In `loadInsights()`, per l'esercizio con `isFirst === true` e
`maxLoads.length > 0` (se non c'e' storico, nessun riscaldamento viene
mostrato — stessa convenzione gia' usata per "Ultimo"/"Prova X kg"
quando manca lo storico):

- `lastMax = maxLoads[maxLoads.length - 1]`
- 3 serie, percentuali fisse su `lastMax`: 40% × 8 rip., 50% × 5 rip.,
  60% × 3 rip.
- Ogni carico arrotondato ai 5 kg piu' vicini (`Math.round(kg/5)*5`) —
  incremento pratico per il caricamento in palestra.

Nuovo campo `warmup: string | null` su `ExerciseVM`, valorizzato solo
per l'esercizio con `isFirst === true` quando esiste storico. Formato
testo (stesso pattern gia' usato per `insight.suggestion`, con
`[innerHTML]` e tag `<b>`):

```
Riscaldamento: <b>{{w1}} kg</b> x8, <b>{{w2}} kg</b> x5, <b>{{w3}} kg</b> x3
```

## 3. Template

La nota in cima alla card (`scheda-detail.component.html:9`) resta
**invariata per tutti gli esercizi, incluso il primo**:

```html
<p class="note" *ngIf="vm.ex.note">{{ vm.ex.note }}</p>
```

Il riscaldamento va aggiunto in fondo alla card, dentro il blocco
`ex-insights`, subito dopo `.suggestion-chip` (ultimo elemento prima
della chiusura di `<ng-container *ngIf="vm.insight">`):

```html
<div class="suggestion-chip" *ngIf="vm.isFirst && vm.warmup" [innerHTML]="vm.warmup"></div>
```

Riusa la classe `.suggestion-chip` gia' esistente (stesso linguaggio
visivo del suggerimento di progressione) — nessuna nuova classe CSS.
Poiche' `warmup` e' valorizzato solo quando `maxLoads.length > 0`, e in
quel caso `sparkSvg` e' sempre valorizzato anch'esso (stessa
condizione), `vm.insight` e' garantito non-null ogni volta che
`vm.warmup` lo e' — il nuovo elemento non finisce mai nascosto per
colpa del wrapper `*ngIf="vm.insight"`.

## Cosa NON cambia

- La nota in cima alla card (`vm.ex.note`) non cambia per NESSUN
  esercizio, incluso il primo — resta esattamente come oggi.
- Il resto del blocco "Ultimo (data): X kg" / sparkline "Progressione"
  / "Prova X kg" (`ex-insights`) resta identico — il riscaldamento si
  aggiunge in fondo, non sostituisce nulla.
- Nessuna modifica al modello dati `Exercise`/`ExInsight`
  (`workout.model.ts`) — `isFirst`/`warmup` sono campi locali di
  `ExerciseVM`, presentazionali, non persistiti.

## Test

Nessun test automatico dedicato al solo template (stessa convenzione
gia' seguita per questo componente in questo progetto — nessun
`.spec.ts` esistente per `SchedaDetailComponent`), ma verifica tramite
`npx tsc --noEmit -p tsconfig.app.json`, `npx ng test --watch=false`
(conteggio invariato), `npx ng build`, e verifica manuale: aprire un
giorno con storico sul primo esercizio mostra, in fondo alla card dopo
"Progressione"/"Prova X kg", il chip "Riscaldamento: ..."; la nota in
cima (se presente) resta visibile come sempre; gli altri esercizi del
giorno non mostrano nessun chip di riscaldamento; un giorno il cui
primo esercizio non ha mai storico non mostra il chip (ma la nota in
cima, se presente, resta visibile).
