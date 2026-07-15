# Tema Scuro + Accento Arancione Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scurire il gradiente di sfondo animato dell'app verso toni quasi neri (ispirati a un'immagine di riferimento) e introdurre un nuovo accento arancione, applicato all'etichetta "Grassi" nella schermata Dieta del cliente.

**Architecture:** Modifica di CSS variabili (`:root` in `src/styles.css`) e del gradiente di `body::before`, piu' un binding di classe in `dieta-detail.component.html` per applicare il nuovo colore a un solo elemento. Nessuna nuova route, nessun nuovo componente, nessuna modifica ai dati.

**Tech Stack:** CSS puro (nessuna libreria), un binding Angular `[class.x]` gia' nel pattern esistente del template.

## Global Constraints

- Il gradiente di `body::before` mantiene identici `position:fixed;inset:-20%;pointer-events:none;z-index:0;filter:blur(16px) saturate(108%);animation:bgDrift 26s var(--spring-soft) infinite alternate;` — cambia SOLO il valore di `background`.
- `--bg` deve diventare esattamente `#0C0D14` (coincide con l'ultimo stop del nuovo gradiente, stesso pattern gia' in uso in questo file).
- Il nuovo accento e' `--imp-amber:#E7B56F;` / `--imp-amber-dim:rgba(231,181,111,0.18);` — valori campionati dall'immagine di riferimento, non vanno cambiati.
- Le variabili da rimuovere (confermate senza consumatori in tutto `src/` tramite grep) sono ESATTAMENTE: `--imp-crimson`, `--imp-crimson-dim`, `--imp-ember`, `--imp-ember-dim`, `--sys-teal`, `--sys-teal-dim`, `--sys-blue`, `--sys-blue-dim`, `--off`, `--off-dim`. Nessuna altra variabile va toccata (`--on`/`--on-dim`, `--sys-cyan`/`--sys-cyan-dim`, `--sys-red`, tutte le `--state-*` restano invariate).
- `body::after` (texture di linee ondulate) NON va toccato in nessun modo.
- Nessuna modifica a `--content-glass-bg`, `--glass-bg`, `--content-glass-border`, `--glass-border`, ne' a nessuna regola `.meal`/`.ex`/`.daycard`/`.weekpicker`/`.tabbar`/`.rocker`/`.resttimer` — l'effetto vetro liquido resta identico.
- L'accento arancione va applicato SOLO a `.fooditem-category.fat` in `dieta-detail.component.html` (vista cliente) — NON a `.meal-preview-catlabel` in `coach-protocol-builder.component.html` (vista coach, fuori scope).
- Nessun nuovo test automatico (modifica di stile CSS + un binding di classe, nessuna logica applicativa nuova); verifica tramite `npx tsc --noEmit -p tsconfig.app.json`, `npx ng test --watch=false` (conteggio invariato), `npx ng build`, e grep di conferma sulle variabili rimosse.
- Cercare le stringhe esatte indicate in ogni step, non affidarsi ciecamente ai numeri di riga se sono gia' scalati da un edit precedente nello stesso file.

---

### Task 1: Sfondo scurito + nuovo accento arancione + cleanup variabili morte

**Files:**
- Modify: `src/styles.css` (4 punti, elencati sotto)
- Modify: `src/index.html` (1 punto)
- Modify: `src/app/pages/dieta-detail/dieta-detail.component.html` (2 punti)

**Interfaces:**
- Consumes: nessuna — modifica isolata di stile + un binding di classe su un dato gia' esistente (`cat` di tipo `FoodCategory`, gia' iterato dal template).
- Produces: nessuna nuova interfaccia — nessun altro file consuma queste modifiche.

Nessuno `.spec.ts` da creare per questo task (vedi Global Constraints).

- [ ] **Step 1: Sostituisci il blocco `:root` in `src/styles.css`**

Trova questo blocco (dall'inizio del file):

```css
/* ===== CSS VARIABLES & THEME (iOS 26 dark) ===== */
:root {
  --spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --spring-soft: cubic-bezier(0.22, 1, 0.36, 1);
  --bg:#181624;
  --bg-card:#171B24;
  --bg-card-2:#232834;
  --separator:rgba(84,84,88,0.65);
  --label:#FFFFFF;
  --label-2:rgba(255,255,255,0.92);
  --label-3:rgba(255,255,255,0.80);
  /* ===== Imperial Gym — palette lime/teal/navy ===== */
  --imp-red:#6DB458;                     /* verde lime — accento primario */
  --imp-red-dim:rgba(109,180,88,0.16);
  --imp-crimson:#438582;                 /* teal — accento secondario */
  --imp-crimson-dim:rgba(67,133,130,0.18);
  --imp-ember:#32566F;                   /* blu-teal — accento terziario */
  --imp-ember-dim:rgba(50,86,111,0.16);
  --sys-cyan:#64D2FF;
  --sys-cyan-dim:rgba(100,210,255,0.18);
  --sys-blue:#5B9DF5;
  --sys-blue-dim:var(--imp-ember-dim);
  --sys-teal:#F5A623;
  --sys-teal-dim:var(--imp-crimson-dim);
  --sys-red:var(--state-danger);
  --accent: var(--imp-red);
  --accent-dim: var(--imp-red-dim);
  --on: var(--imp-red);
  --on-dim: var(--imp-red-dim);
  --off: var(--imp-crimson);
  --off-dim: var(--imp-crimson-dim);
  --state-success: var(--imp-red);
  --state-success-rgb: 109,180,88;
  --state-success-deep: #3C6330;
  --state-success-deep-rgb: 60,99,48;
  --state-danger: #5C2B39;
  --state-danger-rgb: 92,43,57;
  --state-danger-deep: #33181F;
  --state-danger-deep-rgb: 51,24,31;
  --state-danger-text: #A64D67;  /* tinta chiara del vino scuro, per testo leggibile su sfondo scuro */
  --glass-bg: rgba(20,24,32,0.30);
  --glass-border: rgba(255,255,255,0.10);
  --content-glass-bg: rgba(22,26,34,0.46);
  --content-glass-border: rgba(255,255,255,0.12);
  --safe-t: max(env(safe-area-inset-top, 0px), 24px);
  --safe-b: max(env(safe-area-inset-bottom, 0px), 14px);
  --tabbar-h: 54px;
  --nav-h: calc(var(--safe-t) + 86px);
}
```

Sostituiscilo con:

```css
/* ===== CSS VARIABLES & THEME (iOS 26 dark) ===== */
:root {
  --spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --spring-soft: cubic-bezier(0.22, 1, 0.36, 1);
  --bg:#0C0D14;
  --bg-card:#171B24;
  --bg-card-2:#232834;
  --separator:rgba(84,84,88,0.65);
  --label:#FFFFFF;
  --label-2:rgba(255,255,255,0.92);
  --label-3:rgba(255,255,255,0.80);
  /* ===== Imperial Gym — palette lime/arancione ===== */
  --imp-red:#6DB458;                     /* verde lime — accento primario */
  --imp-red-dim:rgba(109,180,88,0.16);
  --imp-amber:#E7B56F;                   /* arancione — nuovo accento secondario */
  --imp-amber-dim:rgba(231,181,111,0.18);
  --sys-cyan:#64D2FF;
  --sys-cyan-dim:rgba(100,210,255,0.18);
  --sys-red:var(--state-danger);
  --accent: var(--imp-red);
  --accent-dim: var(--imp-red-dim);
  --on: var(--imp-red);
  --on-dim: var(--imp-red-dim);
  --state-success: var(--imp-red);
  --state-success-rgb: 109,180,88;
  --state-success-deep: #3C6330;
  --state-success-deep-rgb: 60,99,48;
  --state-danger: #5C2B39;
  --state-danger-rgb: 92,43,57;
  --state-danger-deep: #33181F;
  --state-danger-deep-rgb: 51,24,31;
  --state-danger-text: #A64D67;  /* tinta chiara del vino scuro, per testo leggibile su sfondo scuro */
  --glass-bg: rgba(20,24,32,0.30);
  --glass-border: rgba(255,255,255,0.10);
  --content-glass-bg: rgba(22,26,34,0.46);
  --content-glass-border: rgba(255,255,255,0.12);
  --safe-t: max(env(safe-area-inset-top, 0px), 24px);
  --safe-b: max(env(safe-area-inset-bottom, 0px), 14px);
  --tabbar-h: 54px;
  --nav-h: calc(var(--safe-t) + 86px);
}
```

- [ ] **Step 2: Scurisci il gradiente di `body::before`**

Trova questa riga:

```css
  background: linear-gradient(200deg,
    #6DB458 0%,
    #58AD86 20%,
    #438582 42%,
    #32566F 64%,
    #272B47 84%,
    #181624 100%);
```

Sostituiscila con:

```css
  background: linear-gradient(200deg,
    #1C2A22 0%,
    #16202A 40%,
    #10131C 75%,
    #0C0D14 100%);
```

- [ ] **Step 3: Aggiorna il `theme-color` in `src/index.html`**

Trova questa riga:

```html
  <meta name="theme-color" content="#181624">
```

Sostituiscila con:

```html
  <meta name="theme-color" content="#0C0D14">
```

- [ ] **Step 4: Aggiungi la regola CSS per l'etichetta "Grassi" arancione**

Trova questa riga in `src/styles.css`:

```css
.fooditem-category{font-family:'IBM Plex Mono',monospace;font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--accent);margin:14px 0 4px;}
```

Sostituiscila con:

```css
.fooditem-category{font-family:'IBM Plex Mono',monospace;font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--accent);margin:14px 0 4px;}
.fooditem-category.fat{color:var(--imp-amber);}
```

- [ ] **Step 5: Applica la classe `.fat` nel template Dieta (2 punti)**

Trova questa riga in `src/app/pages/dieta-detail/dieta-detail.component.html`:

```html
      <p class="fooditem-category">{{ foodCategoryLabels[cat] }}</p>
```

Sostituiscila con:

```html
      <p class="fooditem-category" [class.fat]="cat === 'fat'">{{ foodCategoryLabels[cat] }}</p>
```

Poi trova questa riga (nell'accordion "Alternative", piu' in basso nello stesso file):

```html
          <p class="fooditem-category" style="margin-top:10px">{{ foodCategoryLabels[cat] }}</p>
```

Sostituiscila con:

```html
          <p class="fooditem-category" style="margin-top:10px" [class.fat]="cat === 'fat'">{{ foodCategoryLabels[cat] }}</p>
```

- [ ] **Step 6: Verifica compilazione, test invariati, build, e assenza delle variabili rimosse**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx ng test --watch=false && npx ng build`
Expected: nessun errore; la suite di test riporta lo stesso numero di test verdi di prima di questo task (nessun test tocca CSS/template); build completata senza errori.

Run:
```bash
grep -rn "imp-crimson\|imp-ember\|sys-teal\|sys-blue\|--off\b\|--off-dim\b" src/
```
Expected: nessuna occorrenza (output vuoto) — tutte le variabili morte sono state rimosse senza lasciare riferimenti orfani.

- [ ] **Step 7: Verifica manuale (dev server)**

Run: `npx ng serve` (o equivalente gia' in uso), poi apri l'app:
- Lo sfondo animato deve apparire scurito, quasi nero, coerente col mockup approvato durante il brainstorming (confronta con l'anteprima Artifact gia' condivisa, variante "B").
- Le card (`.meal`, `.ex`, `.daycard`, ecc.) devono mantenere lo stesso effetto vetro/blur di prima — nessuna differenza strutturale, solo lo sfondo dietro cambia.
- La texture di linee ondulate deve restare visibile e in sincrono col nuovo sfondo.
- Nella schermata Dieta di un piano con piu' alimenti, l'etichetta "Grassi" deve apparire arancione, mentre "Carboidrati" e "Proteine" restano verdi — sia nella vista combinazione principale sia nell'accordion "Alternative" (se presente per quel pasto).
- La vista Coach (builder protocollo) non deve mostrare alcuna differenza — le sue etichette categoria (`.meal-preview-catlabel`) restano verdi ovunque, non toccate da questo task.
- Nessuna regressione visibile su tabbar, rocker, rest timer, o qualunque altro elemento che usa il vetro liquido.

- [ ] **Step 8: Commit**

```bash
git add src/styles.css src/index.html src/app/pages/dieta-detail/dieta-detail.component.html
git commit -m "feat: scurisce lo sfondo animato e aggiunge l'accento arancione per la categoria Grassi"
```

---

## Self-Review Notes

- **Spec coverage:** gradiente scurito con blur/animazione invariati → Step 2. `--bg` coerente col nuovo ultimo stop → Step 1. `theme-color` aggiornato → Step 3. Nessuna modifica a card/vetro → nessuno step le tocca (verificato che il blocco `:root` sostituito non include `--content-glass-bg`/`--glass-bg`/ecc., rimasti invariati). `--imp-amber`/`--imp-amber-dim` con i valori esatti campionati → Step 1. Rimozione esatta delle 10 variabili morte elencate nei Global Constraints, nessuna in piu' (`--on`/`--on-dim`/`--sys-cyan`/`--sys-cyan-dim`/`--sys-red` tutte presenti e invariate nel blocco sostitutivo) → Step 1. Accento applicato solo a `.fooditem-category.fat` (vista cliente), non a `.meal-preview-catlabel` (vista coach) → Step 4-5, nessuno step tocca `coach-protocol-builder.component.html`. `body::after` non toccato → nessuno step lo tocca. Tutto coperto, nessun gap rispetto allo spec.
- **Placeholder scan:** nessun TBD/TODO; ogni step ha codice completo ed esatto, incluso il blocco `:root` per intero (prima e dopo) per evitare ambiguita' su quali righe restano invariate.
- **Type consistency:** N/A per le variabili CSS. Il binding `[class.fat]="cat === 'fat'"` usa `cat` (gia' tipizzato `FoodCategory = 'carb' | 'protein' | 'fat'` in `diet.model.ts`, gia' iterato dal `*ngFor="let cat of foodCategories"` esistente in entrambi i punti del template) — nessun nuovo tipo introdotto, confronto contro il literal `'fat'` gia' valido per quel tipo.
