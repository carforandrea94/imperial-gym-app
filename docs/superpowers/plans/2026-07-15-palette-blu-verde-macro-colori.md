# Palette Blu/Verde + Colori Macro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rimuovere la texture di linee ondulate dallo sfondo, invertire i colori primario (blu) e secondario (verde) dell'app, far usare al primario anche la pillola attiva della tabbar, e assegnare due colori dedicati alle etichette macro "Carboidrati"/"Proteine".

**Architecture:** Modifica di variabili CSS in `:root` (nessun cambio di nome, solo di valore, per far cascare automaticamente il nuovo blu/verde su tutti i consumatori esistenti di `--accent`/`--imp-amber`), rimozione di un pseudo-elemento (`body::after`), una singola sostituzione di `color` sulla tabbar, due nuove variabili + due nuove regole CSS per i colori macro, e due nuovi binding di classe nel template Dieta gia' modificato per `.fat`.

**Tech Stack:** CSS puro, un binding Angular `[class.x]` nello stesso pattern gia' usato per `.fat`.

## Global Constraints

- `body::after` va rimosso PER INTERO (tutte le sue proprieta'), insieme al riferimento a `body::after` nel blocco `@media (prefers-reduced-motion: reduce)` (che deve tornare a menzionare solo `body::before`). `body::before` e le `@keyframes bgDrift` NON vanno toccati.
- `--imp-red` diventa ESATTAMENTE `#A4C2F6` (blu), `--imp-red-dim` diventa ESATTAMENTE `rgba(164,194,246,0.16)`.
- `--imp-amber` diventa ESATTAMENTE `#80D09A` (verde), `--imp-amber-dim` diventa ESATTAMENTE `rgba(128,208,154,0.18)`.
- Nessun'altra variabile in `:root` va toccata (`--on`/`--on-dim`, `--sys-cyan`/`--sys-cyan-dim`, `--sys-red`, tutte le `--state-*`, `--bg-card-2`, ecc. restano invariate).
- `.tabbar .tabbtn.active` deve usare `color:var(--accent);` (NON `var(--imp-amber)` ne' un nuovo valore diretto) — stessa variabile gia' usata da ogni altro stato "attivo" dell'app. Lo sfondo della pillola (`.tabbar .pill{background:var(--bg-card-2);...}`) NON va toccato.
- Nuove variabili `--macro-carb:#E8C468;` e `--macro-protein:#E8918A;` — nessun altro valore.
- `.fooditem-category.carb`/`.fooditem-category.protein` sono regole NUOVE, aggiunte accanto a `.fooditem-category.fat` (gia' esistente, NON va modificata). La regola base `.fooditem-category{color:var(--label-3);}` NON va modificata.
- I nuovi binding `[class.carb]`/`[class.protein]` vanno SOLO in `dieta-detail.component.html` (vista cliente), non in `coach-protocol-builder.component.html` (`.meal-preview-catlabel`, vista coach, fuori scope, resta bianca/invariata).
- Nessun nuovo test automatico (modifica di variabili CSS + un pseudo-elemento rimosso + 2 binding di classe aggiuntivi in un template gia' modificato, nessuna logica applicativa nuova); verifica tramite `npx tsc --noEmit -p tsconfig.app.json`, `npx ng test --watch=false` (conteggio invariato), `npx ng build`.
- Cercare le stringhe esatte indicate in ogni step, non affidarsi ciecamente ai numeri di riga se sono gia' scalati da un edit precedente nello stesso file.

---

### Task 1: Rimozione texture onde, nuovi colori primario/secondario, pillola tabbar, colori macro

**Files:**
- Modify: `src/styles.css` (5 punti, elencati sotto)
- Modify: `src/app/pages/dieta-detail/dieta-detail.component.html` (2 punti)

**Interfaces:**
- Consumes: nessuna — modifica isolata di stile + binding su un dato gia' esistente (`cat` di tipo `FoodCategory = 'carb' | 'protein' | 'fat'`, gia' iterato dal template).
- Produces: nessuna nuova interfaccia — nessun consumer da aggiornare.

Nessuno `.spec.ts` da creare per questo task (vedi Global Constraints).

- [ ] **Step 1: Aggiorna i colori primario/secondario e aggiungi i colori macro in `:root`**

Trova questo blocco in `src/styles.css`:

```css
  /* ===== Imperial Gym — palette lime/arancione ===== */
  --imp-red:#6DB458;                     /* verde lime — accento primario */
  --imp-red-dim:rgba(109,180,88,0.16);
  --imp-amber:#E7B56F;                   /* arancione — nuovo accento secondario */
  --imp-amber-dim:rgba(231,181,111,0.18);
```

Sostituiscilo con:

```css
  /* ===== Imperial Gym — palette blu/verde ===== */
  --imp-red:#A4C2F6;                     /* blu — accento primario */
  --imp-red-dim:rgba(164,194,246,0.16);
  --imp-amber:#80D09A;                   /* verde — accento secondario */
  --imp-amber-dim:rgba(128,208,154,0.18);
  --macro-carb:#E8C468;                  /* ambra — etichetta "Carboidrati" */
  --macro-protein:#E8918A;               /* corallo — etichetta "Proteine" */
```

- [ ] **Step 2: Rimuovi `body::after` per intero**

Trova questo blocco:

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
  opacity: 0.06;
  mix-blend-mode: soft-light;
  animation: bgDrift 26s var(--spring-soft) infinite alternate;
}

@keyframes bgDrift {
```

Sostituiscilo con (rimosso interamente `body::after`, `@keyframes bgDrift` resta):

```css
@keyframes bgDrift {
```

- [ ] **Step 3: Rimuovi il riferimento a `body::after` da `prefers-reduced-motion`**

Trova questa riga:

```css
@media (prefers-reduced-motion: reduce) {
  body::before, body::after { animation: none; }
}
```

Sostituiscila con:

```css
@media (prefers-reduced-motion: reduce) {
  body::before { animation: none; }
}
```

- [ ] **Step 4: Pillola attiva della tabbar usa il colore primario**

Trova questa riga:

```css
.tabbar .tabbtn.active{color:var(--label);}
```

Sostituiscila con:

```css
.tabbar .tabbtn.active{color:var(--accent);}
```

- [ ] **Step 5: Aggiungi le regole CSS per i colori macro Carboidrati/Proteine**

Trova questa riga:

```css
.fooditem-category.fat{color:var(--imp-amber);}
```

Sostituiscila con (aggiunte le 2 nuove regole subito dopo, `.fat` resta invariata):

```css
.fooditem-category.fat{color:var(--imp-amber);}
.fooditem-category.carb{color:var(--macro-carb);}
.fooditem-category.protein{color:var(--macro-protein);}
```

- [ ] **Step 6: Aggiungi i binding `[class.carb]`/`[class.protein]` nel template Dieta (2 punti)**

Trova questa riga in `src/app/pages/dieta-detail/dieta-detail.component.html`:

```html
      <p class="fooditem-category" [class.fat]="cat === 'fat'">{{ foodCategoryLabels[cat] }}</p>
```

Sostituiscila con:

```html
      <p class="fooditem-category" [class.fat]="cat === 'fat'" [class.carb]="cat === 'carb'" [class.protein]="cat === 'protein'">{{ foodCategoryLabels[cat] }}</p>
```

Poi trova questa riga (nell'accordion "Alternative", piu' in basso nello stesso file):

```html
          <p class="fooditem-category" style="margin-top:10px" [class.fat]="cat === 'fat'">{{ foodCategoryLabels[cat] }}</p>
```

Sostituiscila con:

```html
          <p class="fooditem-category" style="margin-top:10px" [class.fat]="cat === 'fat'" [class.carb]="cat === 'carb'" [class.protein]="cat === 'protein'">{{ foodCategoryLabels[cat] }}</p>
```

- [ ] **Step 7: Verifica compilazione, test invariati, build**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx ng test --watch=false && npx ng build`
Expected: nessun errore; la suite di test riporta lo stesso numero di test verdi di prima di questo task (nessun test tocca CSS/template); build completata senza errori.

- [ ] **Step 8: Grep di conferma — nessun residuo della vecchia palette, `body::after` rimosso**

Run:
```bash
grep -n "body::after" src/styles.css
```
Expected: nessuna occorrenza (output vuoto).

Run:
```bash
grep -n "#6DB458\|#E7B56F" src/styles.css
```
Expected: nessuna occorrenza (output vuoto) — i vecchi valori esadecimali non compaiono piu' da nessuna parte.

- [ ] **Step 9: Verifica manuale (dev server)**

Run: `npx ng serve` (o equivalente gia' in uso), poi apri l'app:
- Lo sfondo animato non deve piu' mostrare la texture di linee ondulate (solo il gradiente sfocato).
- Il colore primario (badge allenamento, bottone "Salva", spuntato serie, tab varianti attiva, puntini settimana, contatore esercizio completato) deve apparire blu, non piu' verde.
- La pillola attiva della tabbar in basso deve mostrare l'icona blu (stesso blu del resto dell'accento primario), sfondo invariato.
- Nella schermata Dieta: "Carboidrati" ambra, "Proteine" corallo, "Grassi" verde (il nuovo colore secondario) — tre colori distinti, nessuno piu' bianco.
- La vista Coach (builder protocollo) non deve mostrare alcuna differenza — le sue etichette categoria (`.meal-preview-catlabel`) restano bianche, non toccate da questo task.

- [ ] **Step 10: Commit**

```bash
git add src/styles.css src/app/pages/dieta-detail/dieta-detail.component.html
git commit -m "feat: palette blu/verde, rimuove texture onde, colora le etichette macro Carboidrati/Proteine"
```

---

## Self-Review Notes

- **Spec coverage:** rimozione `body::after` + aggiornamento `prefers-reduced-motion` → Step 2-3. Nuovo blu primario/verde secondario con valori esatti → Step 1. Pillola tabbar usa `var(--accent)` → Step 4. Nuovi colori macro con valori esatti, regole accanto a `.fat` esistente, binding solo nel template cliente → Step 5-6. Vista coach non toccata → nessuno step tocca `coach-protocol-builder.component.html`. Nessun'altra variabile toccata → Step 1 mostra il blocco `:root` prima/dopo per intero attorno alle righe cambiate, il resto del file resta invariato. Tutto coperto, nessun gap rispetto allo spec.
- **Placeholder scan:** nessun TBD/TODO; ogni step ha codice/riga esatta prima e dopo.
- **Type consistency:** N/A per le variabili CSS. Il binding `[class.carb]="cat === 'carb'"`/`[class.protein]="cat === 'protein'"` usa lo stesso `cat` (gia' tipizzato `FoodCategory` in `diet.model.ts`, gia' iterato dal `*ngFor="let cat of foodCategories"` esistente in entrambi i punti del template) gia' usato per `[class.fat]` — nessun nuovo tipo introdotto, stesso pattern esatto.
