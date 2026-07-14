# Nuova Palette Colori Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiornare la palette colori dell'app (sfondo animato, 3 accenti di brand, colori di stato successo/errore, incluso il bottone principale `.savebtn`) ai valori estratti dal wallpaper di riferimento fornito dall'utente.

**Architecture:** Modifica puramente di variabili CSS in `:root` e di ogni occorrenza letterale (hex/rgba) degli stessi colori altrove in `src/styles.css`, piu' un'unica occorrenza di stile inline in un componente. Nessuna logica applicativa cambia.

**Tech Stack:** CSS puro (nessuna libreria, nessun preprocessore).

## Global Constraints

- Tutti i valori esatti sono quelli dello spec (inclusa la sezione "Addendum"): `docs/superpowers/specs/2026-07-14-nuova-palette-colori-design.md`.
- `#FF6961` (righe 216 e 236 di `styles.css`, un rosso "andamento sfavorevole" per le misure) **resta invariato** — non fa parte dei colori di stato in scope.
- Il colore `#30D158` per il gruppo muscolare "Bicipiti" in `src/app/services/workout-data.service.ts` **resta invariato** — coincidenza di valore con il vecchio verde di stato, ma e' una palette categorica separata, fuori scope.
- `--sys-cyan`/`--sys-cyan-dim` (usato solo dal riempimento del timer di recupero) **resta invariato**.
- Nessuna modifica a nessun file `.ts` eccetto l'unica riga inline in `scheda-info.component.html` indicata sotto.
- Nessun nuovo test automatico (modifica puramente di stile, nessuna logica applicativa); verifica tramite `npx tsc --noEmit -p tsconfig.app.json`, `npx ng test --watch=false` (conteggio invariato), `npx ng build`, e verifica visiva manuale.
- Cercare le stringhe esatte indicate in ogni step, non affidarsi ciecamente ai numeri di riga se sono gia' scalati da un edit precedente nello stesso file.

---

### Task 1: aggiornamento palette in `src/styles.css` e `scheda-info.component.html`

**Files:**
- Modify: `src/styles.css` (piu' punti, elencati sotto)
- Modify: `src/app/pages/scheda-info/scheda-info.component.html:18`

**Interfaces:**
- Consumes: nessuna — modifica isolata di stile.
- Produces: nessuna nuova interfaccia — solo variabili CSS nuove/aggiornate in `:root`, consumate implicitamente da tutto il resto dell'app tramite `var(--accent)` ecc. (gia' esistente, nessun codice consumer da toccare).

Nessuno `.spec.ts` da creare per questo task (vedi Global Constraints).

- [ ] **Step 1: Sostituisci il blocco `:root` in `src/styles.css` (righe 1-40 attuali)**

Blocco attuale da sostituire:

```css
/* ===== CSS VARIABLES & THEME (iOS 26 dark) ===== */
:root {
  --spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --spring-soft: cubic-bezier(0.22, 1, 0.36, 1);
  --bg:#0A0D13;
  --bg-card:#171B24;
  --bg-card-2:#232834;
  --separator:rgba(84,84,88,0.65);
  --label:#FFFFFF;
  --label-2:rgba(255,255,255,0.92);
  --label-3:rgba(255,255,255,0.80);
  /* ===== Imperial Gym — palette verde/ambra/blu ===== */
  --imp-red:#34D399;                     /* verde smeraldo — accento primario */
  --imp-red-dim:rgba(52,211,153,0.16);
  --imp-crimson:#F5A623;                 /* ambra — accento secondario */
  --imp-crimson-dim:rgba(245,166,35,0.18);
  --imp-ember:#5B9DF5;                   /* blu — accento terziario */
  --imp-ember-dim:rgba(91,157,245,0.16);
  --sys-cyan:#64D2FF;
  --sys-cyan-dim:rgba(100,210,255,0.18);
  --sys-blue:#5B9DF5;
  --sys-blue-dim:var(--imp-ember-dim);
  --sys-teal:#F5A623;
  --sys-teal-dim:var(--imp-crimson-dim);
  --sys-red:#FF453A;
  --accent: var(--imp-red);
  --accent-dim: var(--imp-red-dim);
  --on: var(--imp-red);
  --on-dim: var(--imp-red-dim);
  --off: var(--imp-crimson);
  --off-dim: var(--imp-crimson-dim);
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

Nuovo blocco:

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

- [ ] **Step 2: Sostituisci il gradiente di `body::before` (righe 62-67 attuali)**

Blocco attuale da sostituire:

```css
  background:
    radial-gradient(40% 44% at 16% 10%, rgba(52,211,153,0.34) 0%, transparent 60%),
    radial-gradient(42% 40% at 86% 20%, rgba(91,157,245,0.30) 0%, transparent 60%),
    radial-gradient(46% 46% at 80% 84%, rgba(245,166,35,0.26) 0%, transparent 62%),
    radial-gradient(44% 42% at 10% 86%, rgba(91,157,245,0.22) 0%, transparent 60%),
    radial-gradient(32% 32% at 50% 52%, rgba(52,211,153,0.20) 0%, transparent 65%);
```

Nuovo blocco (stessa indentazione, stesse proprieta' circostanti `filter`/`animation` invariate):

```css
  background: linear-gradient(200deg,
    #6DB458 0%,
    #58AD86 20%,
    #438582 42%,
    #32566F 64%,
    #272B47 84%,
    #181624 100%);
```

- [ ] **Step 3: Sostituisci ogni occorrenza letterale rimanente in `src/styles.css`**

Cerca ed esegui queste sostituzioni esatte (stringa cercata → stringa sostitutiva), una alla volta. Non toccare nient'altro in queste righe.

1. La sotto-stringa `linear-gradient(90deg,#0F7A57,var(--imp-red))` compare **due volte** in file diverse regole: dentro `.saveworkout-icon{...}` (riga 108) e dentro `.savebtn{...}` (riga 351, la prima definizione, quella "morta"). In **entrambe** le occorrenze sostituisci `#0F7A57` con `var(--state-success-deep)` (risultato: `linear-gradient(90deg,var(--state-success-deep),var(--imp-red))`), lasciando invariato tutto il resto di ciascuna riga (le due righe hanno proprieta' diverse a parte questo gradiente condiviso).

2. `.saveworkout-icon.saved{background:#30D158;color:#000;}` → `.saveworkout-icon.saved{background:var(--state-success);color:#000;}`

3. `.saveworkout-icon.err{background:#FF453A;color:#fff;}` → `.saveworkout-icon.err{background:var(--state-danger);color:#fff;}`

4. `.spark-delta.up{color:#30D158;}` → `.spark-delta.up{color:var(--state-success);}`

5. `.spark-delta.down{color:#FF6961;}` — **non toccare**, resta invariato.

6. `.delta.up{color:#FF6961;}` — **non toccare**, resta invariato.

7. `.delta.down{color:#30D158;}` → `.delta.down{color:var(--state-success);}`

8. `.savebtn.saved{background:#30D158;color:#000;}` → `.savebtn.saved{background:var(--state-success);color:#000;}`

9. `.savebtn.err{background:#FF453A;color:#fff;}` → `.savebtn.err{background:var(--state-danger);color:#fff;}`

10. `.resttimer.finished .resttimer-fill{background:rgba(48,209,88,0.3);width:100% !important;}` → `.resttimer.finished .resttimer-fill{background:rgba(var(--state-success-rgb),0.3);width:100% !important;}`

11. `.resttimer.finished .resttimer-time{color:#30D158;}` → `.resttimer.finished .resttimer-time{color:var(--state-success);}`

12. `.confirmbtn.danger{background:#FF453A;color:#fff;border-color:transparent;}` → `.confirmbtn.danger{background:var(--state-danger);color:#fff;border-color:transparent;}`

13. Il blocco piu' in basso nel file, subito dopo il commento `/* Pulsante primario "Completa allenamento" — vetro rosso imperiale */`:
    ```css
    .savebtn {
      background: linear-gradient(180deg, rgba(255,46,46,0.52), rgba(150,10,26,0.42));
      color: #fff;
    }
    ```
    diventa (solo la riga `background:` cambia, `color: #fff;` resta invariato):
    ```css
    .savebtn {
      background: linear-gradient(180deg, rgba(var(--state-success-rgb),0.52), rgba(var(--state-success-deep-rgb),0.42));
      color: #fff;
    }
    ```

14. `.savebtn.saved { background: rgba(48,209,88,0.85); color: #04220f; }` → `.savebtn.saved { background: rgba(var(--state-success-rgb),0.85); color: #04220f; }`

15. `.savebtn.err   { background: rgba(255,69,58,0.85); color: #fff; }` → `.savebtn.err   { background: rgba(var(--state-danger-rgb),0.85); color: #fff; }`

16. `.confirmbtn.danger { background: linear-gradient(180deg, rgba(255,69,58,0.60), rgba(150,10,26,0.48)); color: #fff; }` → `.confirmbtn.danger { background: linear-gradient(180deg, rgba(var(--state-danger-rgb),0.60), rgba(var(--state-danger-deep-rgb),0.48)); color: #fff; }`

- [ ] **Step 4: Aggiorna lo stile inline in `src/app/pages/scheda-info/scheda-info.component.html`**

Trova questa riga:

```html
      <span *ngIf="i + 1 === currentWeek" style="margin-left:8px;color:#30D158">← sei qui</span>
```

Sostituiscila con:

```html
      <span *ngIf="i + 1 === currentWeek" style="margin-left:8px;color:var(--state-success)">← sei qui</span>
```

- [ ] **Step 5: Verifica che NON sia stato toccato nulla fuori scope**

Esegui questi controlli e conferma che ogni comando restituisca esattamente l'output atteso:

```bash
grep -n "30D158" src/app/services/workout-data.service.ts
```
Expected: una riga con `'Bicipiti':     { color: '#30D158', ... }` — **invariata** (non deve diventare `var(--state-success)`, e' una coincidenza di valore con una palette categorica separata).

```bash
grep -c "FF6961" src/styles.css
```
Expected: `2` (le due occorrenze di `.spark-delta.down`/`.delta.up` restano invariate).

```bash
grep -c "30D158\|FF453A\|0F7A57\|150,10,26\|255,46,46\|255,69,58" src/styles.css
```
Expected: `0` (nessuna occorrenza letterale residua dei vecchi colori/gradiente rosso in `styles.css`, a parte i due `#FF6961` gia' verificati sopra che non fanno parte di questo conteggio).

- [ ] **Step 6: Verifica compilazione e test invariati**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx ng test --watch=false && npx ng build`
Expected: nessun errore; la suite di test riporta lo stesso numero di test verdi di prima di questo task (nessun test tocca CSS/template); build completata senza errori.

- [ ] **Step 7: Verifica manuale (dev server)**

Run: `npx ng serve` (o equivalente gia' in uso), poi apri l'app:
- Lo sfondo animato dietro le schermate mostra il gradiente lime→verde acqua→teal→blu-teal→indaco→navy, con la stessa deriva lenta di prima.
- I bottoni/badge che usano l'accento primario (es. badge giorno nella scheda, spunte "fatto") sono verde lime invece di verde smeraldo.
- Il bottone principale ("Completa allenamento", "Riprova" nelle schermate con errore) ha uno sfondo verde/teal invece che rosso.
- Salvare un allenamento mostra lo stato "salvato" in verde lime (icona header e testo eventuale).
- Forzare un errore di salvataggio mostra lo stato "errore" in vino scuro, non piu' rosso acceso.
- Nella tab Info della scheda, il marcatore "← sei qui" nell'onda di carico e' verde lime.
- I colori dei gruppi muscolari (Petto, Dorso, Bicipiti ecc.) restano quelli di sempre, non cambiano.
- Il delta "andamento sfavorevole" nelle misure (rosso `#FF6961`) resta invariato.

- [ ] **Step 8: Commit**

```bash
git add src/styles.css src/app/pages/scheda-info/scheda-info.component.html
git commit -m "feat: nuova palette colori (sfondo, accenti, stati successo/errore)"
```

---

## Self-Review Notes

- **Spec coverage:** sfondo animato, 3 accenti di brand, `--bg`, stato successo unificato, stato errore, il bottone `.savebtn` (entrambe le definizioni, inclusa quella reale che vince nella cascata) → tutti coperti da Step 1-4. `#FF6961` e il colore "Bicipiti" esplicitamente esclusi e verificati a parte in Step 5. `--sys-cyan` non toccato (nessuno step lo modifica). Tutto coperto, nessun gap rispetto allo spec (inclusa la sezione Addendum).
- **Placeholder scan:** nessun TBD/TODO; ogni step ha codice/stringhe complete ed esatte.
- **Type consistency:** N/A (CSS puro, nessun tipo). I nomi delle nuove variabili (`--state-success`, `--state-success-rgb`, `--state-success-deep`, `--state-success-deep-rgb`, `--state-danger`, `--state-danger-rgb`, `--state-danger-deep`, `--state-danger-deep-rgb`) sono usati in modo identico tra la loro definizione (Step 1) e ogni punto che li referenzia (Step 3), verificato incrociando ogni occorrenza.
