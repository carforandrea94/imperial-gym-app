# Riscaldamento Formula Proporzionale alle Ripetizioni Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiornare la formula del suggerimento di riscaldamento (primo esercizio del giorno) da percentuali fisse 40/50/60% con ripetizioni fisse 8/5/3, a percentuali 40/60/80% applicate sia al peso che alle ripetizioni di lavoro dell'esercizio.

**Architecture:** Modifica puntuale del blocco di calcolo gia' esistente in `loadInsights()` (`SchedaDetailComponent`) — nessun nuovo campo, nessun nuovo servizio, nessuna modifica al modello dati.

**Tech Stack:** Angular 21 standalone component, TypeScript, Vitest (`npx ng test --watch=false`).

## Global Constraints

- Percentuali: 40%, 60%, 80% (non piu' 40/50/60%) del peso massimo dell'ultima sessione (`lastMax = maxLoads[maxLoads.length - 1]`, invariato).
- Peso di ogni serie: `round5(lastMax * p)` — invariato nella forma, arrotondamento ai 5 kg piu' vicini.
- Ripetizioni di ogni serie: `Math.round(baseReps * p)` — NUOVO, sostituisce le ripetizioni fisse 8/5/3.
- `baseReps`: `parseInt(vm.rows[0]?.ripPlaceholder ?? '', 10)` — le ripetizioni target della prima serie di lavoro dell'esercizio. `parseInt` gestisce gia' correttamente un intervallo tipo `"8-10"` (ritorna `8`, si ferma al primo carattere non numerico).
- Se `baseReps` non e' un numero valido (`isNaN(baseReps)` vero), il riscaldamento non viene mostrato per quell'esercizio (`vm.warmup` resta `null`) — stessa convenzione gia' in uso quando manca lo storico.
- Testo esatto (invariato nella forma, cambiano solo i valori): `` Riscaldamento: <b>{{w1}} kg</b> x{{r1}}, <b>{{w2}} kg</b> x{{r2}}, <b>{{w3}} kg</b> x{{r3}} ``.
- Verifica di riferimento: con `lastMax = 30` e `baseReps = 8` il risultato deve essere esattamente `Riscaldamento: <b>10 kg</b> x3, <b>20 kg</b> x5, <b>25 kg</b> x6`.
- Nessun'altra parte della feature cambia: dove compare il chip (`.suggestion-chip`, dentro `ex-insights`, solo su `vm.isFirst`), la nota in cima alla card, il resto di `ex-insights` — tutto invariato.

---

### Task 1: aggiorna la formula del riscaldamento

**Files:**
- Modify: `src/app/pages/scheda-detail/scheda-detail.component.ts:237-244` (blocco di calcolo `vm.warmup` in `loadInsights()`)

**Interfaces:**
- Consumes: `vm.rows[0].ripPlaceholder: string` (gia' esistente, popolato in `buildExercises()`), `maxLoads: number[]` (gia' calcolato in `loadInsights()`).
- Produces: nessuna nuova interfaccia — `vm.warmup: string | null` mantiene lo stesso tipo/nome gia' esistente, solo il contenuto testuale cambia formula.

Nessun nuovo `.spec.ts` (nessun test esistente per questo componente in questo progetto — stessa convenzione gia' seguita per le modifiche precedenti a questo file).

- [ ] **Step 1: Sostituisci il blocco di calcolo**

Il blocco attuale (righe 237-244):

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

- [ ] **Step 2: Verifica compilazione e test invariati**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx ng test --watch=false && npx ng build`
Expected: nessun errore TypeScript; stesso numero di test verdi di prima (nessun test tocca questo file); build completata senza errori.

- [ ] **Step 3: Verifica manuale**

Run: `npx ng serve`, apri un giorno il cui primo esercizio ha ripetizioni di lavoro "8" e peso massimo dell'ultima sessione 30 kg: il chip in fondo alla card deve mostrare esattamente "Riscaldamento: **10 kg** x3, **20 kg** x5, **25 kg** x6". Apri un esercizio le cui ripetizioni di lavoro sono un intervallo tipo "8-10": il chip deve usare 8 come base (stesso risultato dell'esempio sopra). Apri un esercizio le cui ripetizioni non sono affatto numeriche (se esiste un caso simile nel protocollo): il chip non deve comparire.

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/scheda-detail/scheda-detail.component.ts
git commit -m "fix: riscaldamento proporzionale alle ripetizioni di lavoro (40/60/80%)"
```

---

## Self-Review Notes

- **Spec coverage:** nuove percentuali 40/60/80% su peso e ripetizioni, `baseReps` da `ripPlaceholder` con parsing dell'intervallo, guardia `isNaN` per il caso non numerico, verifica con l'esempio 30kg/8rip → tutto coperto nell'unico Step 1 + Step 3 di verifica manuale. Nessun gap.
- **Placeholder scan:** nessun TBD/TODO; codice completo.
- **Type consistency:** `vm.warmup` resta `string | null` come gia' definito nell'interfaccia `ExerciseVM` esistente — nessuna modifica di tipo, solo di contenuto/formula.
