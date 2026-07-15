# Testo Bianco Primario Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendere bianco (riusando la gerarchia `--label`/`--label-2`/`--label-3` gia' esistente) il testo puramente informativo che oggi usa il verde `--accent`, lasciando il colore solo sugli stati funzionali gia' esistenti e sui 2 highlight intenzionali gia' decisi in una feature precedente.

**Architecture:** Modifica di 10 regole CSS in `src/styles.css` — 8 sostituiscono `color:var(--accent)` con il valore di bianco appropriato, 2 rimuovono del tutto la dichiarazione `color:` cosi' l'elemento eredita il colore gia' impostato dal suo genitore diretto nello stesso file. Nessuna modifica a componenti/template, nessuna nuova variabile CSS.

**Tech Stack:** CSS puro (nessuna libreria, nessun preprocessore).

## Global Constraints

- Le 10 modifiche vanno ESATTAMENTE ai selettori/valori elencati sotto — nessun altro selettore che usa `--accent` va toccato.
- I 14 selettori elencati nello spec come "resta colorato" (stati funzionali: `.set-check.done`, `.variant-tabs button.active`, `.ms-dot.on`, `.client-status.on`, chevron quando aperto, ecc. + i 2 highlight intenzionali `.mycode-value` e `.suggestion-chip b`) NON vanno toccati in nessun modo.
- `.fooditem-category.fat{color:var(--imp-amber);}` (feature precedente, arancione per "Grassi") NON va toccato — solo la regola BASE `.fooditem-category` (che governa Carboidrati/Proteine) cambia.
- Nessuna modifica alle variabili `--label`/`--label-2`/`--label-3`/`--accent`/`--accent-dim`/`--imp-amber` stesse — si riusano i valori gia' esistenti.
- Nessuna modifica a nessun file `.ts`/`.html` — questa e' una modifica isolata a `src/styles.css`.
- Nessun nuovo test automatico (modifica puramente di stile CSS, nessuna logica applicativa); verifica tramite `npx tsc --noEmit -p tsconfig.app.json`, `npx ng test --watch=false` (conteggio invariato), `npx ng build`.
- Cercare le stringhe esatte indicate in ogni step, non affidarsi ciecamente ai numeri di riga se sono gia' scalati da un edit precedente nello stesso file.

---

### Task 1: 10 modifiche di colore testo in `src/styles.css`

**Files:**
- Modify: `src/styles.css` (10 punti, elencati sotto)

**Interfaces:**
- Consumes: nessuna — modifica isolata di stile, riusa variabili gia' esistenti (`--label`, `--label-2`, `--label-3`).
- Produces: nessuna nuova interfaccia — nessun consumer da aggiornare.

Nessuno `.spec.ts` da creare per questo task (vedi Global Constraints).

- [ ] **Step 1: `.weekpicker .wk-sub` → `--label-3`**

Trova questa riga:

```css
.weekpicker .wk-sub{font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:var(--accent);margin-top:2px;}
```

Sostituiscila con:

```css
.weekpicker .wk-sub{font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:var(--label-3);margin-top:2px;}
```

- [ ] **Step 2: `.daycard .badge` → `--label`**

Trova questa riga:

```css
.daycard .badge{width:42px;height:42px;border-radius:12px;background:var(--accent-dim);color:var(--accent);backdrop-filter:blur(10px) saturate(125%);-webkit-backdrop-filter:blur(10px) saturate(125%);border:1px solid rgba(255,255,255,.12);box-shadow:inset 0 1px 0 rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;font-family:'Inter',sans-serif;font-weight:800;font-size:16px;flex-shrink:0;}
```

Sostituiscila con (solo `color:` cambia, `background:var(--accent-dim)` resta invariato):

```css
.daycard .badge{width:42px;height:42px;border-radius:12px;background:var(--accent-dim);color:var(--label);backdrop-filter:blur(10px) saturate(125%);-webkit-backdrop-filter:blur(10px) saturate(125%);border:1px solid rgba(255,255,255,.12);box-shadow:inset 0 1px 0 rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;font-family:'Inter',sans-serif;font-weight:800;font-size:16px;flex-shrink:0;}
```

- [ ] **Step 3: `.daymeta span.rec` → rimuovi (eredita `--label-2` da `.daymeta`)**

Trova questa riga:

```css
.daymeta span.rec{color:var(--accent);}
```

Cancellala interamente (nessuna riga la sostituisce — `.daymeta{...color:var(--label-2);...}`, poco sopra nello stesso file, fornisce gia' il colore che `.rec` deve ereditare).

- [ ] **Step 4: `.serie-badge` → `--label`**

Trova questa riga:

```css
.serie-badge{width:36px;height:36px;border-radius:10px;background:var(--accent-dim);color:var(--accent);display:flex;align-items:center;justify-content:center;font-family:'Inter',sans-serif;font-weight:800;font-size:14px;}
```

Sostituiscila con (solo `color:` cambia):

```css
.serie-badge{width:36px;height:36px;border-radius:10px;background:var(--accent-dim);color:var(--label);display:flex;align-items:center;justify-content:center;font-family:'Inter',sans-serif;font-weight:800;font-size:14px;}
```

- [ ] **Step 5: `.meal-preview-catlabel` → `--label-3`**

Trova questa riga:

```css
.meal-preview-catlabel{font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--accent);}
```

Sostituiscila con:

```css
.meal-preview-catlabel{font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--label-3);}
```

- [ ] **Step 6: `.history-date` → `--label`**

Trova questa riga:

```css
.history-date{font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--accent);font-weight:600;margin-bottom:6px;}
```

Sostituiscila con:

```css
.history-date{font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--label);font-weight:600;margin-bottom:6px;}
```

- [ ] **Step 7: `.fooditem-category` (base) → `--label-3`**

Trova questa riga (la regola BASE, non `.fooditem-category.fat` che resta invariata):

```css
.fooditem-category{font-family:'IBM Plex Mono',monospace;font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--accent);margin:14px 0 4px;}
```

Sostituiscila con:

```css
.fooditem-category{font-family:'IBM Plex Mono',monospace;font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--label-3);margin:14px 0 4px;}
```

- [ ] **Step 8: `.fooditem .fqty` → `--label-2`**

Trova questa riga:

```css
.fooditem .fqty{font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--accent);font-weight:600;white-space:nowrap;}
```

Sostituiscila con:

```css
.fooditem .fqty{font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--label-2);font-weight:600;white-space:nowrap;}
```

- [ ] **Step 9: `.infowave` → `--label-2`**

Trova questa riga:

```css
.infowave{font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:600;color:var(--accent);background:rgba(255,255,255,0.06);border:1px solid var(--content-glass-border);border-radius:9px;padding:9px 12px;margin:8px 0;text-align:center;}
```

Sostituiscila con:

```css
.infowave{font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:600;color:var(--label-2);background:rgba(255,255,255,0.06);border:1px solid var(--content-glass-border);border-radius:9px;padding:9px 12px;margin:8px 0;text-align:center;}
```

- [ ] **Step 10: `.consigli li::before` → rimuovi (eredita `--label-2` da `.consigli li`)**

Trova questa riga:

```css
.consigli li::before{content:"—";color:var(--accent);flex-shrink:0;}
```

Sostituiscila con (rimossa solo `color:`, `content:"—"` e `flex-shrink:0` restano — lo pseudo-elemento resta necessario per mostrare il trattino):

```css
.consigli li::before{content:"—";flex-shrink:0;}
```

- [ ] **Step 11: Verifica compilazione, test invariati, build**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx ng test --watch=false && npx ng build`
Expected: nessun errore; la suite di test riporta lo stesso numero di test verdi di prima di questo task (nessun test tocca CSS); build completata senza errori.

- [ ] **Step 12: Grep di conferma — nessuna regressione sui 14 selettori da NON toccare**

Run:
```bash
grep -n "\.set-check\.done\|\.variant-tabs button\.active\|\.ms-dot\.on\|\.client-status\.on\|\.mycode-value\|\.suggestion-chip b\|\.fooditem-category\.fat\|\.ex-counter\.complete\|\.ex\.open \.ex-chevron\|\.meal\.open \.chevron\|\.altwrap\.open \.altwrap-header" src/styles.css | grep "var(--accent)\|var(--imp-amber)"
```
Expected: 12 righe (il pattern `.altwrap.open .altwrap-header` cattura sia la riga base sia `.altwrap.open .altwrap-header .chevron`), tutte ancora con `var(--accent)` o `var(--imp-amber)` invariati — nessuna delle 12 deve essere sparita o cambiata.

- [ ] **Step 13: Verifica manuale (dev server)**

Run: `npx ng serve` (o equivalente gia' in uso), poi confronta con l'immagine di riferimento gia' condivisa dall'utente:
- Nella schermata Scheda: il sottotitolo "Mercoledì · WAVE LOADING — S2" e i numeri dei badge allenamento (1/2/3) devono apparire bianchi, non verdi.
- Nella schermata Dieta: le etichette "Carboidrati"/"Proteine" devono apparire bianche (grigio chiaro), "Grassi" deve restare arancione; le quantita' (es. "60 g") devono apparire bianche.
- Nello storico allenamenti: la data della seduta deve apparire bianca (non verde), cosi' come le date nel dettaglio misure.
- Nella schermata Info scheda: le righe "S1 → 4×10 reps" devono apparire bianche.
- Nella pagina Consigli (se presente): il trattino prima di ogni voce deve apparire bianco/grigio chiaro, non verde.
- Tutti gli stati funzionali (spuntato, selezionato, tab attivo, accordion aperto, cliente attivo lato coach, codice invito, parola evidenziata nei suggerimenti) devono restare colorati esattamente come prima — nessuna regressione visibile.

- [ ] **Step 14: Commit**

```bash
git add src/styles.css
git commit -m "feat: bianco come colore primario del testo informativo, verde riservato agli stati funzionali"
```

---

## Self-Review Notes

- **Spec coverage:** tutti i 10 elementi della tabella spec ("diventa bianco") hanno uno step dedicato con la stringa esatta da trovare/sostituire, verificata contro il file reale prima di scrivere il piano (nessuna riga spostata da modifiche precedenti). Tutti i 14 elementi "resta colorato" sono elencati nei Global Constraints e verificati esplicitamente allo Step 12 (grep di non-regressione). Nessuna modifica a variabili/componenti/template, come richiesto. Tutto coperto, nessun gap rispetto allo spec.
- **Placeholder scan:** nessun TBD/TODO; ogni step ha la riga esatta di prima e dopo (o l'istruzione esplicita di cancellazione per gli Step 3 e 10).
- **Type consistency:** N/A (CSS puro, nessun tipo). I valori di bianco usati (`--label`, `--label-2`, `--label-3`) sono coerenti con la tabella dello spec, nessuna discrepanza tra i due documenti.
