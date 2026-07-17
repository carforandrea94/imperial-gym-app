# Design: riscaldamento proporzionale alle ripetizioni di lavoro

Data: 2026-07-17

## Contesto

La feature "riscaldamento sul primo esercizio" (spec
`2026-07-17-riscaldamento-primo-esercizio-design.md`, PR #51, gia'
mergiata) mostra 3 serie di riscaldamento (40%/50%/60% del peso
massimo dell'ultima sessione, ripetizioni fisse 8/5/3) in fondo alla
card del primo esercizio del giorno.

L'utente ha segnalato, con un esempio concreto, che l'ultima serie di
riscaldamento (quella subito prima delle serie di lavoro) deve
avvicinarsi molto di piu' al carico/ripetizioni di lavoro reali:
allenandosi su 8 ripetizioni con 30 kg, l'ultima serie di riscaldamento
deve essere 6 rip. con 25 kg (83% del peso, 75% delle ripetizioni) —
non fermarsi al 60%/x3 fisso di oggi.

## Nuova formula

Le percentuali passano da **40%/50%/60%** a **40%/60%/80%**, applicate
sia al peso che alle ripetizioni di lavoro (stessa percentuale per
entrambi, non piu' ripetizioni fisse):

- peso: `round5(lastMax * p)` — come oggi, arrotondato ai 5 kg piu'
  vicini.
- ripetizioni: `Math.round(baseReps * p)` — arrotondate all'intero.

dove `p` ∈ {0.4, 0.6, 0.8} e `lastMax = maxLoads[maxLoads.length - 1]`
(invariato, gia' calcolato — vedi spec precedente).

Verifica con l'esempio dell'utente (`lastMax = 30`, `baseReps = 8`):

| % | peso (round5) | rip. (round) |
|---|---|---|
| 40% | round5(12) = 10 kg | round(3.2) = 3 |
| 60% | round5(18) = 20 kg | round(4.8) = 5 |
| 80% | round5(24) = 25 kg | round(6.4) = 6 |

L'ultima riga (25 kg × 6 rip.) combacia esattamente con l'esempio
dato dall'utente.

## `baseReps`: ripetizioni di lavoro dell'esercizio

Nuovo valore, letto da `vm.rows[0].ripPlaceholder` (gia' popolato in
`buildExercises()` con le ripetizioni target della prima serie
dell'esercizio) e parsato con `parseInt(...)`. `parseInt` gestisce gia'
correttamente il caso di un intervallo tipo `"8-10"` (si ferma al primo
carattere non numerico), restituendo `8` — nessun parsing custom
necessario.

Se il parsing fallisce (`isNaN`, es. `ripPlaceholder` vuoto o senza
cifre), il riscaldamento non viene mostrato per quell'esercizio (stessa
convenzione gia' usata quando manca lo storico: nessun crash, nessun
placeholder, semplicemente il chip non appare).

## Codice

In `loadInsights()` (`scheda-detail.component.ts:237-244`), il blocco
attuale:

```ts
      if (vm.isFirst && maxLoads.length > 0) {
        const lastMax = maxLoads[maxLoads.length - 1];
        const round5 = (kg: number) => Math.round(kg / 5) * 5;
        const w1 = round5(lastMax * 0.4);
        const w2 = round5(lastMax * 0.5);
        const w3 = round5(lastMax * 0.6);
        vm.warmup = `Riscaldamento: <b>${w1} kg</b> x8, <b>${w2} kg</b> x5, <b>${w3} kg</b> x3`;
      }
```

diventa:

```ts
      if (vm.isFirst && maxLoads.length > 0) {
        const lastMax = maxLoads[maxLoads.length - 1];
        const baseReps = parseInt(vm.rows[0]?.ripPlaceholder ?? '', 10);
        if (!isNaN(baseReps)) {
          const round5 = (kg: number) => Math.round(kg / 5) * 5;
          const w1 = round5(lastMax * 0.4);
          const w2 = round5(lastMax * 0.6);
          const w3 = round5(lastMax * 0.8);
          const r1 = Math.round(baseReps * 0.4);
          const r2 = Math.round(baseReps * 0.6);
          const r3 = Math.round(baseReps * 0.8);
          vm.warmup = `Riscaldamento: <b>${w1} kg</b> x${r1}, <b>${w2} kg</b> x${r2}, <b>${w3} kg</b> x${r3}`;
        }
      }
```

## Cosa NON cambia

- Il resto della feature (dove compare il chip, riuso di `.suggestion-chip`,
  `isFirst`, `maxLoads` gia' calcolato, nota in cima invariata) resta
  identico — questa revisione tocca solo la formula interna.
- Nessuna modifica al modello dati condiviso.

## Test

Nessun test automatico dedicato (stessa convenzione gia' seguita per
questo componente), ma verifica tramite `npx tsc --noEmit -p
tsconfig.app.json`, `npx ng test --watch=false` (conteggio invariato),
`npx ng build`, e verifica manuale: un primo esercizio con storico e
ripetizioni di lavoro "8" mostra "Riscaldamento: 10 kg x3, 20 kg x5, 25
kg x6" (con `lastMax = 30`); un esercizio le cui ripetizioni di lavoro
sono un intervallo tipo "8-10" mostra lo stesso risultato di base 8;
un esercizio le cui ripetizioni non sono affatto numeriche non mostra
il chip.
