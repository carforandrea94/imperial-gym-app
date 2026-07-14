# Texture Onde Sfondo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere una sottile texture di linee ondulate allo sfondo animato dell'app, su un layer separato dal gradiente esistente cosi' da non essere cancellata dal blur.

**Architecture:** Nuovo pseudo-elemento `body::after` in `src/styles.css`, fratello di `body::before` gia' esistente (gradiente + blur + animazione `bgDrift`). Il nuovo layer usa un pattern SVG inline (data-URI) di linee curve ripetuto in tile, senza blur, con `mix-blend-mode:soft-light` e opacita' bassa per restare appena percettibile, e riusa l'animazione `bgDrift` gia' definita cosi' si muove in sincrono col resto dello sfondo.

**Tech Stack:** CSS puro (nessuna libreria, nessun preprocessore, nessun asset esterno — SVG inline come data-URI).

## Global Constraints

- Il layer texture va su `body::after`, MAI sullo stesso `body::before` che ha gia' `filter:blur(16px)` — un blur cosi' forte cancellerebbe la texture.
- Valore di opacita' confermato dall'utente su anteprima visiva (3 varianti confrontate: 0.06/0.08/0.14): **0.06**, nessun altro valore va usato.
- `background-size` deve essere `240px 240px`, identico al `viewBox` dell'SVG (240x240) — nessuno scaling del tile.
- L'animazione su `body::after` deve essere **esattamente** `bgDrift 26s var(--spring-soft) infinite alternate;` (stessa stringa gia' su `body::before`), cosi' i due layer restano in sincrono.
- `body::after` deve avere `position:fixed;inset:-20%;pointer-events:none;z-index:0;` (stessi valori di `body::before`) — nessuna nuova variabile CSS, nessun nuovo elemento nel DOM.
- La regola esistente `@media (prefers-reduced-motion: reduce) { body::before { animation: none; } }` va estesa per includere anche `body::after` nello stesso blocco (selettore combinato), NON un blocco `@media` duplicato.
- Nessuna modifica ai valori esistenti di `body::before` (gradiente, blur, animazione) — la texture e' additiva, non li sostituisce.
- Nessun test automatico (modifica puramente decorativa di CSS, nessuna logica applicativa); verifica tramite `npx tsc --noEmit -p tsconfig.app.json`, `npx ng test --watch=false` (conteggio invariato, 55/55), `npx ng build`.
- Cercare le stringhe esatte indicate nello step, non affidarsi ciecamente ai numeri di riga se sono gia' scalati da un edit precedente nello stesso file.

---

### Task 1: Aggiungi `body::after` con texture di linee ondulate

**Files:**
- Modify: `src/styles.css` (2 punti, elencati sotto)

**Interfaces:**
- Consumes: nessuna — modifica isolata di stile.
- Produces: nessuna nuova interfaccia — solo CSS, nessun consumer da toccare (nessun componente referenzia `body::before`/`body::after` direttamente).

Nessuno `.spec.ts` da creare per questo task (vedi Global Constraints).

- [ ] **Step 1: Aggiungi la regola `body::after` subito dopo `body::before`**

Trova questo blocco (fine della regola `body::before`, inizio di `@keyframes bgDrift`):

```css
body::before {
  content: '';
  position: fixed;
  inset: -20%;
  pointer-events: none;
  z-index: 0;
  background: linear-gradient(200deg,
    #6DB458 0%,
    #58AD86 20%,
    #438582 42%,
    #32566F 64%,
    #272B47 84%,
    #181624 100%);
  filter: blur(16px) saturate(108%);
  animation: bgDrift 26s var(--spring-soft) infinite alternate;
}

@keyframes bgDrift {
```

Sostituiscilo con (aggiunta la nuova regola `body::after` tra le due, nessun'altra riga toccata):

```css
body::before {
  content: '';
  position: fixed;
  inset: -20%;
  pointer-events: none;
  z-index: 0;
  background: linear-gradient(200deg,
    #6DB458 0%,
    #58AD86 20%,
    #438582 42%,
    #32566F 64%,
    #272B47 84%,
    #181624 100%);
  filter: blur(16px) saturate(108%);
  animation: bgDrift 26s var(--spring-soft) infinite alternate;
}

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

- [ ] **Step 2: Estendi la regola `prefers-reduced-motion` a `body::after`**

Trova questa riga:

```css
@media (prefers-reduced-motion: reduce) {
  body::before { animation: none; }
}
```

Sostituiscila con:

```css
@media (prefers-reduced-motion: reduce) {
  body::before, body::after { animation: none; }
}
```

(Nota: piu' avanti nello stesso file esiste un secondo blocco `@media (prefers-reduced-motion: reduce)` separato, per `.tabbar::before, .resttimer::before, .rocker::before, .confirmbox::before` — NON toccarlo, e' un blocco diverso per componenti diversi.)

- [ ] **Step 3: Verifica compilazione e test invariati**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx ng test --watch=false && npx ng build`
Expected: nessun errore; la suite di test riporta lo stesso numero di test verdi di prima di questo task (55/55, nessun test tocca CSS/template); build completata senza errori.

- [ ] **Step 4: Verifica manuale (dev server)**

Run: `npx ng serve` (o equivalente gia' in uso), poi apri l'app:
- Lo sfondo deve mostrare sottili linee ondulate bianche sopra il gradiente, appena percettibili (opacity 0.06 + soft-light), non un overlay piatto o "rumoroso".
- Le linee devono muoversi in sincrono col resto dello sfondo (stessa deriva lenta di `body::before`), non sembrare un layer scollegato.
- Con `prefers-reduced-motion: reduce` attivo nel sistema operativo/browser, sia il gradiente sia le linee devono restare fermi (nessuna animazione su nessuno dei due pseudo-elementi).
- Nessun contenuto dell'app (bottoni, card, testo) deve risultare cliccabile in modo anomalo o coperto dalla texture — `pointer-events:none` e `z-index:0` devono mantenerla puramente decorativa e sotto `.wrap` (z-index:1) come `body::before`.

- [ ] **Step 5: Commit**

```bash
git add src/styles.css
git commit -m "feat: aggiunge texture di linee ondulate allo sfondo animato"
```

---

## Self-Review Notes

- **Spec coverage:** nuovo `body::after` separato da `body::before` (nessun blur) → Step 1. Opacita' 0.06 confermata dall'utente, `mix-blend-mode:soft-light`, `background-size:240px 240px` identico al viewBox → tutti presenti nello Step 1. Animazione `bgDrift` identica per sincronia → presente nello Step 1. Estensione `prefers-reduced-motion` → Step 2. Nessuna modifica a `body::before` → nessuno step lo tocca (solo aggiunta di codice attorno, verificato che il blocco `body::before` nello Step 1 e' riportato invariato). Tutto coperto, nessun gap rispetto allo spec.
- **Placeholder scan:** nessun TBD/TODO; ogni step ha codice completo ed esatto (inclusa la stringa data-URI completa, gia' generata e verificata).
- **Type consistency:** N/A (CSS puro, nessun tipo). I valori numerici (240px tile = 240 viewBox, opacity 0.06, bgDrift 26s) sono coerenti con quanto approvato nella spec.
