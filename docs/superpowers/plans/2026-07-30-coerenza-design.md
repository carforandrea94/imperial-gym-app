# Coerenza del sistema visivo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chiudere le incongruenze di design emerse dall'audit di `src/styles.css`: gli stati che spariscono in tema chiaro, il testo secondario sotto la soglia di contrasto, i due colori semantici che ne dicono quattro, le regole morte e i bersagli di tocco troppo piccoli. Nessun cambiamento di aspetto voluto in tema scuro.

**Architecture:** Tutto il lavoro sta nel blocco token di `src/styles.css` e nelle regole che lo scavalcano. Il tema chiaro oggi funziona solo attraverso i token, ma 31 regole dipingono con `rgba(255,255,255,…)` diretto: due token nuovi (`--surface-raise`, `--surface-press`) danno a quelle regole un valore che sa cambiare tema. I colori semantici vengono ricondotti ai token esistenti (accento e `--state-danger`), togliendo il verde e il rosso iOS scritti a mano nel toast. Le aree di tocco si allargano con uno pseudo-elemento assoluto, così il disegno resta identico.

**Tech Stack:** Angular 21 standalone components, signals, zoneless; Vitest (`npm test`) — mai `jasmine.createSpyObj`, mock manuali come negli spec esistenti. Nessun test copre il CSS: la verifica è `npx ng build` più il confronto visivo nei due temi.

## Global Constraints

- Lavorare sempre sul branch `claude/diet-protocol-template-vh6wi7`, mai su `main`.
- **Il tema scuro non deve cambiare aspetto.** Ogni sostituzione di un `rgba(255,255,255,…)` con un token deve dare esattamente lo stesso colore risultante nel tema scuro. Dove l'audit ha trovato opacità diverse per lo stesso ruolo, si accorpano al valore più frequente solo se lo scarto è ≤0,01; altrimenti si tiene un token dedicato.
- Le decisioni di design già prese dall'utente e non rinegoziabili:
  - **niente verde**: `--state-success` resta l'accento, il toast di successo usa l'accento e quello di errore `--state-danger`; il verde `#30D158` e il rosso `#FF453A` spariscono dal codice;
  - **rinomina** `--imp-red` → `--brand` e `--imp-amber` → `--brand-2` (con i rispettivi `-dim`);
  - **niente scala tipografica e niente normalizzazione dei raggi** in questo piano: restano a un piano successivo. Qui si toccano solo le aree di tocco.
- I valori di colore indicati nei task sono calcolati sulle formule WCAG 2.1 componendo le trasparenze sul fondo reale delle card (`#FFFFFF` in chiaro, `--content-glass-bg` su `--bg` in scuro). Vanno usati **verbatim**, non ricalcolati a occhio.
- Ogni task si chiude con `npx ng build` pulita e `npm test` verde (107 test).

---

## Task 1: Token di superficie e stati che sopravvivono al tema chiaro

**Files:**
- Modify: `src/styles.css` (blocco `:root`, blocco `:root[data-theme="light"]`, le 31 regole con riempimento bianco)

**Interfaces:**
- Produces: `--surface-raise`, `--surface-raise-2`, `--surface-press` — usati dai Task 4 e da ogni componente futuro al posto dei bianchi diretti.

- [ ] **Step 1: dichiara i tre token nei due temi**

In `:root`, subito dopo `--content-glass-border`, aggiungi:

```css
  /* Superfici sopraelevate: nel tema scuro si ottengono aggiungendo luce, nel
     chiaro togliendola. Ogni regola che vuole "un gradino sopra la card" usa
     questi, mai un rgba(255,255,255,..) diretto, che in chiaro non fa nulla. */
  --surface-raise: rgba(255,255,255,0.06);
  --surface-raise-2: rgba(255,255,255,0.10);
  --surface-press: rgba(255,255,255,0.04);
```

In `:root[data-theme="light"]`, subito dopo `--content-glass-border`, aggiungi:

```css
  --surface-raise: rgba(20,23,28,0.045);
  --surface-raise-2: rgba(20,23,28,0.085);
  --surface-press: rgba(20,23,28,0.055);
```

- [ ] **Step 2: sostituisci i riempimenti bianchi nelle regole di superficie**

Sostituisci `background:rgba(255,255,255,0.06)` e `0.07` con `background:var(--surface-raise)`, e `0.1`/`0.11` con `background:var(--surface-raise-2)`, in queste regole (l'elenco è chiuso, non cercarne altre):

`.backbtn`, `.navicon`, `.viewtoggle`, `.ex-chip`, `.ex-schemebadge`, `.ex-counter`, `.ex-restbtn`, `.ex-restbtn:hover`, `.rest-stepbtn`, `.rip-input,.load-input`, `.rip-input:focus,.load-input:focus`, `.spark-row`, `.measure-input-wrap`, `.measure-input-wrap:focus-within`, `.bacheca-*` (riga con `rgba(255,255,255,0.07)` nella sezione COACH — BACHECA), `.clienti-*` (riga con `rgba(255,255,255,0.06)` nella sezione COACH — CLIENTI), `.protocol-status.ps-draft`, `.protocol-status.ps-archived`, `.authfield input[type="file"]`, `.authfield input[type="file"]::file-selector-button`, `.ro-value`, `.session-bar-btn.ghost`, `.session-bar-btn:disabled`, `.variant-tabs button`, `.infowave`, `.restwave-x`, `.confirmbtn.cancel` (**entrambe** le dichiarazioni, vedi Task 3).

Le opacità che nel tema scuro non coincidono con 0,06 / 0,10 vanno mantenute uguali a oggi: `.spark-row` (0,05), `.protocol-status.ps-draft` (0,08), `.protocol-status.ps-archived` (0,05), `.ro-value` (0,03), `.variant-tabs button` (0,05), `.authfield input[type="file"]` (0,05). Per queste **non** usare i token: lasciarle com'erano e trattarle nello Step 3.

- [ ] **Step 3: dai un fondo visibile ai quattro casi che in chiaro spariscono**

Questi non hanno bordo, quindi in tema chiaro il riempimento è l'unico segnale e oggi è nullo. Sostituisci con i token, accettando lo scarto di opacità nel tema scuro (impercettibile, ≤0,02):

```css
.protocol-status.ps-draft{color:var(--label-2);background:var(--surface-raise-2);}
.protocol-status.ps-archived{color:var(--label-3);background:var(--surface-raise);}
.daycard:active{background:var(--surface-press);}
```

`.spark-row`, `.ro-value`, `.variant-tabs button` e `.authfield input[type="file"]` hanno tutti un bordo: passali a `var(--surface-raise)` senza altre accortezze.

- [ ] **Step 4: il feedback alla pressione non può essere "schiarisci"**

`.press-fx:active` usa `filter:brightness(1.08)`: su una card bianca non produce nulla. È usata da 7 template (misure, misure-analytics, coach-protocol-builder, history-list). Sostituisci:

```css
.press-fx{transition:transform .35s var(--spring),filter .15s ease;}
.press-fx:active{transform:scale(.96);filter:brightness(var(--press-brightness));}
```

e aggiungi ai token: `--press-brightness: 1.08;` in `:root`, `--press-brightness: 0.95;` in `:root[data-theme="light"]`.

**Verify:**
- [ ] `npx ng build` completa senza errori
- [ ] `grep -c 'rgba(255,255,255,0\.0[3-9]\|rgba(255,255,255,0\.1[01]\?)' src/styles.css` restituisce solo le occorrenze nei blocchi `::before`/`::after` del liquid glass e nelle ombre `inset` — nessuna su `background` di componenti
- [ ] In tema chiaro, aprendo la lista clienti coach: le pillole "bozza" e "archiviato" hanno un fondo grigio visibile, distinto dalla pillola "attiva" che resta piena di accento
- [ ] In tema chiaro, premendo una card in Misure si vede un cambio di fondo, non solo la scala

---

## Task 2: Contrasto del testo in tema chiaro

**Files:**
- Modify: `src/styles.css` (blocco `:root[data-theme="light"]`, blocco `:root`)

**Interfaces:**
- Consumes/Produces: solo valori di token, nessuna nuova API.

- [ ] **Step 1: alza `--label-3` in tema chiaro**

È il colore più usato dopo il testo principale (44 usi), su testo da 10,5 a 12,5px, e oggi fa 3,41:1 su card bianca contro il minimo di 4,5:1. In `:root[data-theme="light"]` cambia:

```css
  --label-3:rgba(20,23,28,0.62);
```

Dà 5,04:1. Non scendere a 0,58 (4,41:1, ancora sotto) né salire oltre 0,64, che appiattisce la gerarchia con `--label-2` (0,72).

- [ ] **Step 2: scurisci `--sys-cyan` in tema chiaro**

È il colore dei secondi del timer di recupero (15px, peso 600 — non conta come "testo grande"), oggi 3,66:1. In `:root[data-theme="light"]`:

```css
  --sys-cyan:#0B6E97;
  --sys-cyan-dim:rgba(11,110,151,0.14);
```

Dà 5,69:1. Va cambiato anche `-dim` per coerenza, benché oggi non sia usato da nessuno (viene rimosso nel Task 4 solo se resta inutilizzato).

- [ ] **Step 3: alza `--state-danger-text` in tema scuro**

Oggi 3,43:1 su card scura: basta per un'icona (soglia 3:1) ma non per il testo, e la usano sia le icone elimina sia etichette testuali. In `:root`:

```css
  --state-danger-text: #C4657F;
```

Dà 4,87:1. Il valore in tema chiaro (`#A32E3E`, 6,96:1) resta com'è.

**Verify:**
- [ ] `npx ng build` completa senza errori
- [ ] In tema chiaro, le didascalie sotto i titoli e l'etichetta della barra sessione si leggono senza sforzo su sfondo bianco
- [ ] In tema scuro, il rosa dei bottoni elimina resta distinguibile dall'accento e non vira al rosa acceso

---

## Task 3: Un solo colore per il successo, uno per l'errore

**Files:**
- Modify: `src/styles.css` (`.apptoast`, `.apptoast.error`, le 5 coppie di regole duplicate)

**Interfaces:**
- Nessuna API. Cambia l'aspetto del toast in **entrambi** i temi: è voluto.

- [ ] **Step 1: porta il toast sui token**

Oggi `.apptoast` è verde iOS `rgba(48,209,88,0.92)` e `.apptoast.error` è rosso iOS `rgba(255,69,58,0.92)`, entrambi scritti a mano e identici nei due temi; il testo dell'errore fa 3,17:1, sotto il minimo. Sostituisci i due colori:

```css
.apptoast{…background:var(--accent);color:var(--accent-contrast);…}
.apptoast.error{background:var(--state-danger);color:#fff;}
```

Il resto della regola (posizione, raggio, ombra, blur, animazione) non si tocca. Bianco su `--state-danger` dà 11,29:1 in scuro e 6,96:1 in chiaro.

- [ ] **Step 2: elimina le prime dichiarazioni morte**

Il blocco "liquid glass" in fondo al file ridichiara regole già definite sopra; vince l'ultima, quindi la prima è codice morto che si legge come attivo. Cancella **la prima** dichiarazione di ognuna, tenendo quella nel blocco liquid glass:

| Selettore | Cancella (prima) | Tieni (seconda) |
|---|---|---|
| `.savebtn` | riga ~416, `background:var(--imp-red);color:var(--accent-contrast)` — solo queste due proprietà, il resto della regola serve | riga ~704 |
| `.savebtn.saved` | riga ~428 | riga ~709 |
| `.savebtn.err` | riga ~429 | riga ~710 |
| `.confirmbtn.cancel` | riga ~546 | riga ~713 |
| `.confirmbtn.danger` | riga ~547 | riga ~714 |

Attenzione: per `.savebtn` la prima dichiarazione contiene anche larghezza, padding, raggio, tipografia e ombre, che sono le uniche a definirle. Va rimosso **solo** il duplicato di `background` e `color`, non l'intera regola.

**Verify:**
- [ ] `npx ng build` completa senza errori
- [ ] `grep -n "48,209,88\|255,69,58" src/styles.css` non restituisce nulla
- [ ] Salvando un allenamento, il toast è dell'accento e il testo si legge; forzando un errore di rete, il toast è del rosso di sistema dei token
- [ ] I bottoni salva e i bottoni del dialogo di conferma hanno lo stesso aspetto di prima (le regole rimaste sono quelle che già vincevano)

---

## Task 4: Pulizia dei token

**Files:**
- Modify: `src/styles.css`
- Modify: `src/app/pages/coach-protocol-import/coach-protocol-import.component.ts:53` (unico uso di `--imp-red` fuori da `styles.css`)

**Interfaces:**
- Produces: `--brand`, `--brand-dim`, `--brand-2`, `--brand-2-dim` al posto di `--imp-red`, `--imp-red-dim`, `--imp-amber`, `--imp-amber-dim`.

- [ ] **Step 1: cancella gli otto token mai richiamati**

Nessuno di questi compare in un `var()` in tutto `src/`: `--glass-border`, `--imp-amber-dim`, `--on`, `--on-dim`, `--state-danger-deep`, `--state-success-deep-rgb`, `--sys-cyan-dim`, `--sys-red`. Cancellali dai due blocchi `:root` dove presenti.

`--imp-amber-dim` e `--sys-cyan-dim` vanno cancellati **dopo** i Task 2 e 3: se uno dei due finisse per essere usato, va tenuto. Verifica con `grep -c 'var(--sys-cyan-dim)' -r src/` prima di rimuovere.

- [ ] **Step 2: rinomina i due token il cui nome mente**

`--imp-red` è un azzurro pastello (`#A4C2F6` / `#3E63E0`) ed è l'accento primario di tutta l'app; `--imp-amber` è verde (`#80D09A` / `#2E9A5C`). Rinomina ovunque:

- `--imp-red` → `--brand`
- `--imp-red-dim` → `--brand-dim`
- `--imp-amber` → `--brand-2`

Sono 2 dichiarazioni per tema più i `var()`. L'unico uso fuori da `styles.css` è `coach-protocol-import.component.ts:53`, in un `linear-gradient` inline. Aggiorna anche i commenti accanto alle dichiarazioni, che parlano ancora di rosso e ambra.

- [ ] **Step 3: rendi esplicito che il successo è l'accento**

Dopo il Task 3 non esiste più un verde. Sostituisci il commento di `--state-success` con:

```css
  /* Non esiste un verde nella palette: la conferma parla con l'accento.
     Resta un token a se' perche' il significato e' diverso da --accent, non il colore. */
  --state-success: var(--brand);
```

**Verify:**
- [ ] `npx ng build` completa senza errori
- [ ] `grep -rn "imp-red\|imp-amber" src/` non restituisce nulla
- [ ] `npm test` verde (107 test)
- [ ] Le due schermate del builder coach con la barra di avanzamento (che usa il gradiente inline) si vedono come prima

---

## Task 5: Aree di tocco onorevoli

**Files:**
- Modify: `src/styles.css` (`.ex-restbtn`, `.restwave-x`, `.viewtogglebtn`, `.delete-btn`, `.session-bar-btn`)

**Interfaces:**
- Nessuna API, nessun cambiamento di disegno: solo l'area sensibile al tocco.

- [ ] **Step 1: aggiungi l'utility per l'area di tocco**

La linea guida iOS chiede 44×44px toccabili. Sei bottoni su sette stanno sotto, e i due da 26px sono quelli che si premono con le mani sudate in palestra. Allargare il disegno li renderebbe pesanti: si allarga solo il bersaglio, con uno pseudo-elemento centrato.

Aggiungi vicino a `.press-fx`, in fondo alla sezione UTILS:

```css
/* Bersaglio di tocco a 44px senza toccare il disegno: lo pseudo-elemento e'
   invisibile e centrato sul bottone, quindi il dito ha margine anche dove
   l'icona e' minuta (la ✕ del recupero, l'ingranaggio del tempo). */
.tap44{position:relative;}
.tap44::after{content:"";position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:44px;height:44px;}
```

- [ ] **Step 2: applica la classe ai cinque bottoni sotto soglia**

Aggiungi `tap44` alla lista di classi nei template, **non** al CSS dei componenti:

- `.ex-restbtn` (26px) — `scheda-detail.component.html`, il bottone dell'ingranaggio nel template `#exMeta`
- `.restwave-x` (26px) — `rest-wave.component.ts`, template inline
- `.viewtogglebtn` (30×26px) — `navbar.component.html`, entrambi i bottoni
- `.delete-btn` (34px) — cerca gli usi con `grep -rn 'class="[^"]*delete-btn' src/app`
- `.session-bar-btn` (34px) — `scheda-detail.component.html`, i tre comandi della barra

Attenzione a `.session-bar-btn`: i tre bottoni sono adiacenti con `gap:8px`, quindi i bersagli da 44px si sovrapporrebbero di 2px per lato. Per questi tre usa una variante che allarga solo in verticale:

```css
.tap44-v::after{width:100%;height:44px;}
```

applicata insieme a `tap44` (che dà il `position:relative`), non al posto.

- [ ] **Step 3: verifica che non si rompa nulla sotto**

Gli pseudo-elementi assoluti possono coprire elementi vicini e rubare il click. `.ex-restbtn` sta dentro `.ex-meta`, accanto al badge dello schema e al contatore: controlla che restino cliccabili dove lo erano (il contatore non lo è, il badge nemmeno — quindi qui il rischio è nullo, ma `.delete-btn` sta spesso in fondo a righe cliccabili).

Dove il bersaglio allargato copre un'area già cliccabile con azione diversa, aggiungi `pointer-events:none` allo pseudo-elemento e lascia il bottone alla sua dimensione: meglio un bersaglio piccolo che un tocco che fa la cosa sbagliata.

**Verify:**
- [ ] `npx ng build` completa senza errori
- [ ] Sull'emulatore mobile, toccando appena fuori dalla ✕ del recupero il timer si ferma comunque
- [ ] Toccando fra due comandi della barra sessione non parte l'azione del bottone vicino
- [ ] Nella lista dello storico, toccare la riga apre il dettaglio e toccare il cestino elimina — non si sono invertiti

---

## Fuori piano, per dopo

Rimangono aperti dall'audit, esclusi da questo piano su decisione dell'utente:

- **Scala tipografica**: 22 dimensioni distinte per 103 usi, di cui nove separate dalla vicina di mezzo pixel. Una scala a sette gradini (10 / 11.5 / 13 / 15 / 17 / 20 / 26) le assorbe tutte con scarto massimo di mezzo pixel.
- **Raggi**: 17 valori distinti, riducibili a cinque (6 / 10 / 14 / 20 / 50%).
- **Spaziature**: 75 stili inline nei template, quasi tutti margini, più 19 valori di padding nel CSS. Servono quattro classi di utilità.
- **Ripetizioni di `font-family`**: 36 dichiarazioni di `'Inter', sans-serif` già ereditate da `body`.

Conviene farli in un unico passaggio quando non ci sono feature aperte sugli stessi file, perché toccano molte righe senza cambiare quasi nulla a schermo.
