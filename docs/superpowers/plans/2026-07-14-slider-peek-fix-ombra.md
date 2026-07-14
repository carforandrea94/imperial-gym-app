# Fix Ombra Slider + Carosello Peek Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Risolvere l'artefatto di ritaglio angoli (Safari) visibile dietro le card degli slider, e trasformare gli slider Dieta/Scheda in un carosello "peek" con ~28px della card precedente/successiva visibili ai lati.

**Architecture:** Modifica puramente di CSS in `src/styles.css`: (1) applica a `.meal`/`.ex` lo stesso trucco `mask-image` gia' in produzione su `.resttimer` per il ritaglio corretto degli angoli; (2) restringe ogni slide (`.exslide`) e aggiunge padding laterale al contenitore (`.exslider`) cosi' che le slide adiacenti sbircino ai lati quando una e' centrata.

**Tech Stack:** CSS puro (nessuna libreria, nessun preprocessore).

## Global Constraints

- Il fix `mask-image` va copiato **verbatim** da `.resttimer` (riga 422 di `styles.css`): `-webkit-mask-image:-webkit-radial-gradient(white,black);mask-image:radial-gradient(white,black);` — nessuna variazione dei valori.
- Il carosello "peek" si applica a `.exslider`/`.exslide`, gia' condivisi da entrambi gli slider (Dieta pasti, Scheda esercizi) — nessuna duplicazione di classi per componente.
- Nessuna nuova interazione: le slide che sbircano ai lati non diventano cliccabili per saltare a quella slide.
- Nessuna modifica a `dieta-detail.component.ts`, `scheda-detail.component.ts`, o `horizontal-slider.util.ts` — solo CSS.
- Nessun nuovo test automatico (modifica puramente di stile CSS, nessuna logica applicativa); verifica tramite `npx tsc --noEmit -p tsconfig.app.json`, `npx ng test --watch=false` (conteggio invariato), `npx ng build`, e verifica visiva manuale.
- Cercare le stringhe esatte indicate in ogni step, non affidarsi ciecamente ai numeri di riga se sono gia' scalati da un edit precedente nello stesso file.

---

### Task 1: mask-image su `.meal`/`.ex` + carosello peek su `.exslider`/`.exslide`

**Files:**
- Modify: `src/styles.css` (4 punti, elencati sotto)

**Interfaces:**
- Consumes: nessuna — modifica isolata di stile.
- Produces: nessuna nuova interfaccia — solo CSS, nessun consumer da toccare (`dieta-detail.component.html` e `scheda-detail.component.html` gia' usano le classi `.meal`/`.ex`/`.exslider`/`.exslide` cosi' come sono).

Nessuno `.spec.ts` da creare per questo task (vedi Global Constraints).

- [ ] **Step 1: Aggiungi il fix mask-image a `.ex`**

Trova questa riga:

```css
.ex{background:var(--content-glass-bg);backdrop-filter:blur(12px) saturate(125%);-webkit-backdrop-filter:blur(12px) saturate(125%);border:1px solid var(--content-glass-border);border-radius:20px;overflow:hidden;position:relative;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),inset 0 -1px 0 rgba(0,0,0,.18);}
```

Sostituiscila con (aggiunta la coppia `mask-image` subito dopo `overflow:hidden;`):

```css
.ex{background:var(--content-glass-bg);backdrop-filter:blur(12px) saturate(125%);-webkit-backdrop-filter:blur(12px) saturate(125%);border:1px solid var(--content-glass-border);border-radius:20px;overflow:hidden;-webkit-mask-image:-webkit-radial-gradient(white,black);mask-image:radial-gradient(white,black);position:relative;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),inset 0 -1px 0 rgba(0,0,0,.18);}
```

- [ ] **Step 2: Aggiungi il fix mask-image a `.meal`**

Trova questa riga:

```css
.meal{border:1px solid var(--content-glass-border);border-radius:20px;background:var(--content-glass-bg);backdrop-filter:blur(12px) saturate(125%);-webkit-backdrop-filter:blur(12px) saturate(125%);box-shadow:inset 0 1px 0 rgba(255,255,255,.08),inset 0 -1px 0 rgba(0,0,0,.18);margin-bottom:12px;overflow:hidden;}
```

Sostituiscila con (aggiunta la coppia `mask-image` subito dopo `overflow:hidden;`):

```css
.meal{border:1px solid var(--content-glass-border);border-radius:20px;background:var(--content-glass-bg);backdrop-filter:blur(12px) saturate(125%);-webkit-backdrop-filter:blur(12px) saturate(125%);box-shadow:inset 0 1px 0 rgba(255,255,255,.08),inset 0 -1px 0 rgba(0,0,0,.18);margin-bottom:12px;overflow:hidden;-webkit-mask-image:-webkit-radial-gradient(white,black);mask-image:radial-gradient(white,black);}
```

- [ ] **Step 3: Trasforma `.exslider` in un contenitore con padding laterale**

Trova questa riga:

```css
.exslider{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-bottom:2px;}
```

Sostituiscila con:

```css
.exslider{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding:0 28px 2px;}
```

- [ ] **Step 4: Restringi `.exslide` per rivelare il "peek" laterale**

Trova questa riga:

```css
.exslide{flex:0 0 100%;width:100%;scroll-snap-align:center;scroll-snap-stop:always;}
```

Sostituiscila con:

```css
.exslide{flex:0 0 calc(100% - 56px);width:calc(100% - 56px);scroll-snap-align:center;scroll-snap-stop:always;}
```

- [ ] **Step 5: Verifica compilazione e test invariati**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx ng test --watch=false && npx ng build`
Expected: nessun errore; la suite di test riporta lo stesso numero di test verdi di prima di questo task (nessun test tocca CSS/template); build completata senza errori.

- [ ] **Step 6: Verifica manuale (dev server)**

Run: `npx ng serve` (o equivalente gia' in uso), poi apri:
- La schermata Dieta di un piano con piu' pasti, in modalita' slider: con una card centrata, si deve vedere ~28px della card precedente/successiva su entrambi i lati (tranne per la prima/ultima slide, dove solo un lato ha una slide adiacente da mostrare). Scorrere avanti/indietro deve continuare a funzionare, i pallini sotto devono continuare a riflettere la slide corrente.
- La schermata Scheda (allenamento) in modalita' slider: stesso comportamento "peek" per gli esercizi.
- In entrambe le viste, l'artefatto rettangolare "ombra fantasma" ai bordi delle card non deve piu' essere visibile (verifica soprattutto su Safari/iOS se disponibile, dove il bug Safari e' piu' evidente).
- La vista lista/accordion (non-slider) di Dieta e Scheda deve continuare a mostrare le card normalmente, senza differenze di layout (il fix mask-image non deve introdurre alcuna sfumatura visibile).
- Toccare una slide che sbircia ai lati non deve fare nulla (nessuna nuova interazione) — solo scroll/swipe o i pallini muovono lo slider.

- [ ] **Step 7: Commit**

```bash
git add src/styles.css
git commit -m "fix: risolve l'ombra da ritaglio angoli Safari e aggiunge il carosello peek agli slider"
```

---

## Self-Review Notes

- **Spec coverage:** fix mask-image su `.meal` e `.ex` (verbatim da `.resttimer`) → Step 1-2. Carosello peek su `.exslider`/`.exslide` con 28px per lato → Step 3-4. Nessuna nuova interazione sulle slide laterali, nessuna modifica a `.ts` → nessuno step le tocca. Vista lista/accordion beneficia comunque del fix ombra → verificato in Step 6 (stesse classi base `.meal`/`.ex`, nessuna variante separata creata). Tutto coperto, nessun gap rispetto allo spec.
- **Placeholder scan:** nessun TBD/TODO; ogni step ha codice completo ed esatto.
- **Type consistency:** N/A (CSS puro, nessun tipo). I valori numerici (28px di padding, calc(100% - 56px) = 28px × 2 sottratti dalla larghezza della slide) sono coerenti tra Step 3 e Step 4.
