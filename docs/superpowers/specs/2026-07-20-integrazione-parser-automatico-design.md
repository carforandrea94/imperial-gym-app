# Design: parser automatico per il PDF di integrazione

Data: 2026-07-20

## Contesto e revisione di una decisione precedente

`docs/superpowers/specs/2026-07-20-integrazione-pasti-design.md` (spec
precedente, gia' implementata) aveva deciso esplicitamente di **non**
costruire un parser automatico per il PDF di integrazione, per il rischio
di ambiguita' nei dosaggi — l'esempio concreto era la creatina citata due
volte nel PDF (a colazione e post-workout), che ha richiesto un chiarimento
umano per sapere se fosse la stessa dose spostata o due dosi distinte
(erano due dosi distinte).

L'utente ha ora chiesto di ribaltare quella decisione con una condizione
precisa: **il parser prende ogni riga cosi' com'e' e la assegna al/ai
pasto/i che quella riga stessa indica, con la quantita' scritta li' per
quella riga — nessun tentativo di capire se lo stesso nome di integratore
citato altrove sia "la stessa cosa"**. Non c'e' piu' bisogno di rilevare
un'ambiguita' di questo tipo: ogni riga e' indipendente. L'unico caso da
saltare e' quando una riga non permette di individuare con sicurezza sia
il pasto di destinazione sia una quantita' leggibile.

Confermato con l'utente: su **questo** PDF, applicando questa regola,
nessuna riga viene saltata — il risultato coincide esattamente con la
mappatura gia' concordata in precedenza:

| Pasto | Piani | Voci |
|---|---|---|
| Colazione | tutti | Vitamina C+B — 1 dose; Creatina — 5 g |
| Pranzo | tutti | Omega 3,6,9 — quota giornaliera; Bromelina — dose consigliata |
| Cena | tutti | Omega 3,6,9 — quota giornaliera; Bromelina — dose consigliata; Magnesio — 400 mg, dopo cena |
| Cena | solo piani con "ON" nel nome | + Creatina — 5 g (voce indipendente da quella di Colazione) |
| Merenda | solo piani con "ON" nel nome | Arginina — 3 g; Carnitina — 2 g; Termogenico — dose consigliata |
| Intra-Workout (pasto nuovo) | solo piani con "ON" nel nome | Intra-workout — 10 g / 500-700 ml acqua |

## Architettura del parser

Nuovo metodo pubblico su `PdfImportService`
(`src/app/services/pdf-import.service.ts`):

```ts
export interface ParsedSupplements {
  /** Pasto -> voci valide per ogni piano dieta (es. Colazione, Pranzo, Cena). */
  always: Record<string, SupplementItem[]>;
  /** Pasto -> voci valide solo nei piani il cui nome contiene "on" (case-insensitive). */
  onlyOn: Record<string, SupplementItem[]>;
}

parseSupplementText(text: string): ParsedSupplements
```

I nomi pasto usati come chiavi sono tra `'Colazione' | 'Pranzo' | 'Cena' |
'Merenda' | 'Intra-Workout'`. Le voci di Merenda/Cena(post-workout)/
Intra-Workout finiscono in `onlyOn`; quelle di Colazione/Pranzo/
Cena(le altre) finiscono in `always`.

### Stato interno: righe "semplici" vs blocchi sezione

Il testo viene diviso in righe (stesso `text.split(/\n|\r/).map(l =>
l.trim()).filter(Boolean)` gia' usato nel resto del file). **Verificato
carattere per carattere sull'estrazione reale di questo PDF (via
`pdfjs-dist`, stessa libreria usata dall'app)**: il testo va a capo a
meta' frase in due punti, non per una nuova voce logica ma per il limite
di larghezza della pagina — "Omega 3,6,9: dose giornaliera prevista da
dividere tra pranzo" / "e cena" (due righe), e nel blocco intra-workout
"10gr durante l'allenamento da sorseggiare in 500/700ml" / "d'acqua" (due
righe). Il parser deve fondere questi casi, altrimenti l'Omega
finirebbe assegnato solo a Pranzo (perdendo Cena) — un risultato
incompleto e silenzioso, diverso dalla tabella concordata sopra.

Una funzione `isNewEntryStart(line: string): boolean` centralizza il
riconoscimento di "questa riga apre una voce nuova" (true se la riga e'
un'intestazione di sezione, oppure contiene `:` con testo prima non
vuoto e non troppo lungo — stesso limite pratico di `EX_HEADER_RE`
altrove nel file, evita falsi positivi su descrizioni lunghe che
contengono un ":" a caso). E' usata sia per decidere quando un blocco
"riga semplice" finisce, sia per decidere quando un blocco di sezione
finisce.

Si scorre riga per riga con una macchina a stati minima:

- **Intestazione di sezione**: `/^(pre-workout|intra-workout|post-workout)\s*:?\s*$/i`
  imposta la sezione corrente (`'pre' | 'intra' | 'post' | null`) e non
  produce essa stessa una voce.
- **Fuori da una sezione** (stato iniziale, o dopo una riga che non e' ne'
  un'intestazione di sezione ne' una riga di continuazione riconosciuta):
  accumula la riga corrente PIU' tutte le righe successive per cui
  `isNewEntryStart(nextLine)` e' falso (fusione con uno spazio) — questo
  ricostruisce "Omega 3,6,9: dose giornaliera prevista da dividere tra
  pranzo e cena" come UNA sola stringa logica prima di procedere. Sul
  blocco cosi' ricomposto, prova il pattern "riga semplice" (sotto). Se
  combacia, produce una o piu' voci in `always`, una per ogni pasto
  trovato nel testo cercando le parole chiave (case-insensitive)
  `colazione|pranzo|cena|merenda`. Se non combacia o non trova nessun
  pasto, il blocco viene scartato silenziosamente.
- **Dentro una sezione `pre`/`post`**: ogni riga successiva (finche' non
  arriva `isNewEntryStart`, o la fine del testo) produce UNA voce in
  `onlyOn` per il pasto fisso della sezione (`pre` -> Merenda, `post` ->
  Cena), usando l'estrazione nome+quantita' descritta sotto — qui non
  serve fusione multi-riga, ogni singola riga della sezione e' gia' una
  voce completa (verificato sul testo reale: "arginina 3g", "carnitina
  2g", "termogenico dosaggio consigliato" sono gia' ciascuna su una riga
  intera). Se l'estrazione fallisce per una riga, quella riga viene
  scartata (le altre della stessa sezione continuano ad essere
  processate).
- **Dentro la sezione `intra`**: TUTTE le righe successive (finche' non
  arriva `isNewEntryStart`, o la fine del testo) vengono fuse con uno
  spazio in un'unica stringa, che diventa la quantita' di UNA sola voce
  in `onlyOn` per "Intra-Workout" con nome fisso `'Intra-workout'` —
  qui la fusione multi-riga e' necessaria (il blocco "10gr... 500/700ml"
  + "d'acqua" e' logicamente un'unica frase, non due voci separate).

### Estrazione nome + quantita' per riga

**Riga "semplice"** (fuori sezione): `/^(.+?):\s*(.+)$/` — gruppo 1 e' il
nome (es. "vitamina C+B", "creatina", "Omega 3,6,9"), gruppo 2 e' l'intera
descrizione che include la quantita' e il riferimento al pasto (es. "una
dose a colazione", "dose giornaliera prevista da dividere tra pranzo e
cena"). La quantita' salvata e' l'intero gruppo 2 SENZA ripulirlo dal
riferimento al pasto — coerente con come gia' oggi vengono scritte le
quantita' nel modello (stringhe descrittive libere, es. "dose
consigliata"), non serve un'estrazione piu' fine per questo caso d'uso.
Se la riga non contiene `:`, viene scartata (fuori sezione, senza
un'intestazione a fornire contesto, non c'e' altro modo affidabile di
individuare nome vs quantita').

**Dentro una sezione**, si prova in ordine (il primo che combacia vince):

1. `intra`: l'intera riga e' la quantita', nome fisso `'Intra-workout'`.
   (Non un integratore con nome proprio: e' la finestra temporale stessa,
   come gia' deciso — vedi mockup approvato in sessione.)
2. `/^(\d+[\d.,]*\s*\S{0,4})\s+di\s+(.+?)(?:\s+da\s+assumere\b.*)?$/i` —
   "QUANTITA' di NOME [da assumere ...]" (es. "5 gr di creatina da
   assumere nel pasto" -> nome "creatina", quantita' "5 gr").
3. `/^(.+?)\s+(\d+[\d.,]*\s*\S{0,4})$/` — "NOME QUANTITA'" (es. "arginina
   3g" -> nome "arginina", quantita' "3g"; "carnitina 2g" -> nome
   "carnitina", quantita' "2g").
4. `/^(\S+)\s+(.+)$/` — fallback generico "prima parola = nome, resto =
   quantita' descrittiva" (es. "termogenico dosaggio consigliato" -> nome
   "termogenico", quantita' "dosaggio consigliato").
5. Nessun pattern combacia -> riga scartata.

## Applicazione ai piani dieta

In `coach-protocol-import.component.ts` (sia `processCreate` sia
`processUpdate`, quando `integrazioneFile` e' presente): dopo aver
ottenuto `parsed = this.pdfSvc.parseSupplementText(integrazioneText)`,
per ogni `DietPlan` in `patch.diet`:

- Per ogni pasto in `always`, trova (per nome, case-insensitive) il
  `NamedMeal` corrispondente nel piano e imposta/sostituisce
  `meal.supplements` con le voci trovate. Se il pasto non esiste nel
  piano, viene ignorato (non creiamo pasti "sempre" mancanti: solo i
  nomi standard Colazione/Pranzo/Cena/Merenda esistono di norma).
- Se il nome del piano contiene "on" (case-insensitive,
  `/\bon\b/i.test(plan.name)`): applica anche le voci di `onlyOn`. Per
  Merenda/Cena, se il pasto esiste, le voci si **aggiungono** a quelle
  gia' presenti da `always` (non le sostituiscono: es. Cena riceve sia
  Omega/Bromelina/Magnesio da `always` sia Creatina da `onlyOn`). Per
  "Intra-Workout": se il piano non ha gia' un pasto con questo nome, ne
  viene creato uno nuovo (`newNamedMeal('Intra-Workout')`) con solo le
  voci di `supplements` impostate (nessuna combinazione/alimento).
- Se **nessun piano** del protocollo ha "on" nel nome, le voci di
  `onlyOn` vengono scartate per l'intero protocollo (nessuna destinazione
  individuabile con sicurezza) — coerente con "salta se non chiaro".

Questa logica di merge vive in un nuovo metodo privato del componente
(`applyParsedSupplements(diet: Diet, parsed: ParsedSupplements): void`,
muta l'array `diet` in place), per non appesantire ulteriormente
`processCreate`/`processUpdate` gia' lunghi.

## Cosa NON cambia

- `supplementNotesSource`/`infoNote` restano invariati (testo integrale
  del PDF, gia' funzionanti) — restano la rete di sicurezza per le righe
  scartate dal parser strutturato.
- Nessuna nuova UI di avviso per le righe scartate (deciso con l'utente).
- Nessuna modifica a `NamedMeal`/`SupplementItem`/alla vista cliente/
  all'editor manuale del coach (gia' pronti, il parser scrive negli
  stessi campi che l'editor manuale gia' scrive).

## Test

Nuovo blocco di test in `pdf-import.service.spec.ts` per
`parseSupplementText()`, usando il testo esatto del PDF di integrazione
(gia' verificato carattere per carattere in questa sessione via
estrazione reale con `pdfjs-dist`), che verifica esattamente la tabella
sopra: 5 pasti (Colazione, Pranzo, Cena, Merenda, Intra-Workout), nessuna
riga scartata, "Creatina" presente sia in Colazione (`always`) sia in
Cena (`onlyOn`) come voci indipendenti.

`coach-protocol-import.component.spec.ts` non esiste ancora (il
componente non ha test dedicati, come `coach-protocol-builder` prima
della PR #63). Lo creo per testare `applyParsedSupplements` (logica di
merge/creazione pasto non banale, quindi un test diretto e' comunque a
basso costo e alto valore): istanzio solo il componente con `new` e
mock minimi (stesso approccio gia' usato per `CoachProtocolBuilderComponent`
nella PR #63), senza `TestBed`.
