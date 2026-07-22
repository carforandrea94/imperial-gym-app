# Parser automatico PDF integrazione — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Il PDF di integrazione, quando caricato (creazione o aggiornamento protocollo), popola automaticamente `NamedMeal.supplements` nei pasti giusti di ogni piano dieta, oltre alla nota libera gia' esistente.

**Architecture:** Un nuovo metodo puro `PdfImportService.parseSupplementText(text)` trasforma il testo del PDF in una struttura `{ always, onlyOn }` (pasto -> voci), con una piccola macchina a stati che riconosce righe semplici (`NOME: descrizione ... a PASTO`) e blocchi di sezione (`pre-workout`/`intra-workout`/`post-workout`), fondendo le righe che il PDF spezza a meta' frase. Un secondo metodo `CoachProtocolImportComponent.applyParsedSupplements(diet, parsed)` applica quella struttura a un `Diet` (array di piani), scrivendo `always` su tutti i piani e `onlyOn` solo sui piani il cui nome contiene "on".

**Tech Stack:** Angular 21, Vitest.

## Global Constraints

- Nessuna riga viene "indovinata": se una riga fuori sezione non contiene `:` con testo utile prima, o una riga dentro `pre`/`post` non produce un nome+quantita' riconoscibile, viene scartata silenziosamente (nessuna nuova UI di avviso).
- Il PDF reale va a capo a meta' frase in due punti verificati (vedi spec): "…tra pranzo" / "e cena", e "…in 500/700ml" / "d'acqua". Il parser deve fondere queste righe prima di cercare le parole chiave pasto, altrimenti l'Omega 3,6,9 risulterebbe assegnato solo a Pranzo.
- Le voci `onlyOn` si applicano solo ai piani dieta il cui `name` contiene "on" case-insensitive (`/\bon\b/i`). Se nessun piano del protocollo soddisfa questo, le voci `onlyOn` non vengono applicate da nessuna parte per quel protocollo.
- Per Cena, le voci `onlyOn` (creatina post-workout) si **aggiungono** a quelle gia' scritte da `always` (Omega, Bromelina, Magnesio), non le sostituiscono.
- Il pasto "Intra-Workout" viene creato (con `newNamedMeal`) solo se manca in un piano che soddisfa `/\bon\b/i`; nessun altro pasto mancante viene creato.
- `supplementNotesSource`/`infoNote` (testo libero) restano invariati — nessuna modifica al loro comportamento gia' esistente.

---

### Task 1: `PdfImportService.parseSupplementText()`

**Files:**
- Modify: `src/app/services/pdf-import.service.ts`
- Test: `src/app/services/pdf-import.service.spec.ts`

**Interfaces:**
- Produces: `export interface ParsedSupplements { always: Record<string, SupplementItem[]>; onlyOn: Record<string, SupplementItem[]>; }`, `parseSupplementText(text: string): ParsedSupplements` (metodo pubblico su `PdfImportService`) — usati da Task 2.

- [ ] **Step 1: Scrivi il test (che deve fallire)**

In `src/app/services/pdf-import.service.spec.ts`, aggiungi in fondo al file (dopo l'ultimo `describe` esistente):

```ts
describe('PdfImportService - parseSupplementText', () => {
  let service: PdfImportService;

  beforeEach(() => {
    service = new PdfImportService();
  });

  const INTEGRAZIONE_TEXT = `INTEGRAZIONE
vitamina C+B: una dose a colazione
creatina: 5gr a colazione
Omega 3,6,9: dose giornaliera prevista da dividere tra pranzo
e cena
pre-workout: 30 minuti prima
arginina 3g
carnitina 2g
termogenico dosaggio consigliato
intra-workout
10gr durante l'allenamento da sorseggiare in 500/700ml
d'acqua
post-workout:
5 gr di creatina da assumere nel pasto
magnesio 400mg da assumere dopo cena
bromelina assumere la dose consigliata a pranzo e cena`;

  it('assegna le righe semplici (fuori sezione) ai pasti "always", fondendo le righe spezzate a meta\' frase', () => {
    const result = service.parseSupplementText(INTEGRAZIONE_TEXT);

    expect(result.always['Colazione']).toEqual([
      { name: 'vitamina C+B', qty: 'una dose a colazione' },
      { name: 'creatina', qty: '5gr a colazione' }
    ]);
    // Omega finisce sia in Pranzo sia in Cena: la riga "…tra pranzo" + "e cena"
    // (spezzata dal PDF) deve essere fusa PRIMA di cercare le parole chiave.
    expect(result.always['Pranzo']).toEqual([
      { name: 'Omega 3,6,9', qty: 'dose giornaliera prevista da dividere tra pranzo e cena' },
      { name: 'bromelina', qty: 'assumere la dose consigliata a pranzo e cena' }
    ]);
    expect(result.always['Cena']).toEqual([
      { name: 'Omega 3,6,9', qty: 'dose giornaliera prevista da dividere tra pranzo e cena' },
      { name: 'magnesio', qty: '400mg da assumere dopo cena' },
      { name: 'bromelina', qty: 'assumere la dose consigliata a pranzo e cena' }
    ]);
  });

  it('assegna i blocchi pre/intra/post-workout a "onlyOn", fondendo il blocco intra-workout spezzato su piu\' righe', () => {
    const result = service.parseSupplementText(INTEGRAZIONE_TEXT);

    expect(result.onlyOn['Merenda']).toEqual([
      { name: 'arginina', qty: '3g' },
      { name: 'carnitina', qty: '2g' },
      { name: 'termogenico', qty: 'dosaggio consigliato' }
    ]);
    expect(result.onlyOn['Intra-Workout']).toEqual([
      { name: 'Intra-workout', qty: "10gr durante l'allenamento da sorseggiare in 500/700ml d'acqua" }
    ]);
    // Creatina post-workout: voce INDIPENDENTE da quella di Colazione (always),
    // nessuna fusione/deduplicazione per nome.
    expect(result.onlyOn['Cena']).toEqual([
      { name: 'creatina', qty: '5 gr' }
    ]);
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npx ng test --watch=false --include='**/pdf-import.service.spec.ts'`
Expected: FAIL — `service.parseSupplementText is not a function`

- [ ] **Step 3: Implementa `parseSupplementText`**

In `src/app/services/pdf-import.service.ts`, aggiungi `SupplementItem` all'import esistente da `diet.model` (riga 4-7):

```ts
import {
  Diet, DietPlan, NamedMeal, MealCombination, FoodItem, FoodCategory, SupplementItem,
  DEFAULT_MEAL_NAMES, newDietPlan, newNamedMeal, newCombination
} from '../models/diet.model';
```

Subito dopo le costanti regex esistenti (dopo `SINGLE_SCHEME_RE`, circa riga 94), aggiungi:

```ts
/** Intestazione di blocco integrazione legato all'allenamento: "pre-workout: 30 minuti
 *  prima", "intra-workout", "post-workout:" - il testo dopo l'eventuale ":" e' ignorato,
 *  serve solo a riconoscere l'inizio del blocco. */
const SUPPLEMENT_SECTION_RE = /^(pre-workout|intra-workout|post-workout)\b/i;
/** Riga che continua la precedente (il PDF va a capo a meta' frase, non per una nuova
 *  voce): inizia con una congiunzione breve ("e", "ed", "o", "ma") o un'elisione
 *  ("d'acqua", "l'allenamento", ...). */
const SUPPLEMENT_CONTINUATION_RE = /^((e|ed|o|ma)\b|[a-z]')/i;
const SUPPLEMENT_MEAL_KEYWORDS: [string, RegExp][] = [
  ['Colazione', /colazione/i],
  ['Pranzo', /pranzo/i],
  ['Cena', /cena/i],
  ['Merenda', /merenda/i]
];
const SUPPLEMENT_SECTION_MEAL: Record<'pre' | 'intra' | 'post', string> = {
  pre: 'Merenda',
  intra: 'Intra-Workout',
  post: 'Cena'
};
```

Subito dopo, aggiungi le funzioni helper (a livello di modulo, non nella classe):

```ts
function supplementMealsInText(text: string): string[] {
  return SUPPLEMENT_MEAL_KEYWORDS.filter(([, re]) => re.test(text)).map(([name]) => name);
}

/** Righe fuori sezione: "NOME: descrizione" (il pasto si trova cercando le parole
 *  chiave nella descrizione), oppure senza ":" "NOME resto-descrizione" (es.
 *  "magnesio 400mg da assumere dopo cena", "bromelina assumere la dose... a pranzo e cena"). */
function extractSupplementOutsideSection(blob: string): { name: string; qty: string } | null {
  const colonMatch = blob.match(/^([^:]{1,40}):\s*(.+)$/);
  if (colonMatch) return { name: colonMatch[1].trim(), qty: colonMatch[2].trim() };
  const fallback = blob.match(/^(\S+)\s+(.+)$/);
  if (fallback) return { name: fallback[1].trim(), qty: fallback[2].trim() };
  return null;
}

/** Righe dentro una sezione pre/post-workout: prova "QUANTITA' di NOME [da assumere...]"
 *  (es. "5 gr di creatina da assumere nel pasto"), poi "NOME QUANTITA'" (es. "arginina 3g"),
 *  poi il fallback generico "prima parola nome, resto quantita'" (es. "termogenico
 *  dosaggio consigliato"). */
function extractSupplementInSection(line: string): { name: string; qty: string } | null {
  const qtyFirst = line.match(/^(\d+[\d.,]*\s*\S{0,4})\s+di\s+(.+?)(?:\s+da\s+assumere\b.*)?$/i);
  if (qtyFirst) return { name: qtyFirst[2].trim(), qty: qtyFirst[1].trim() };
  const nameFirst = line.match(/^(.+?)\s+(\d+[\d.,]*\s*\S{0,4})$/);
  if (nameFirst) return { name: nameFirst[1].trim(), qty: nameFirst[2].trim() };
  const generic = line.match(/^(\S+)\s+(.+)$/);
  if (generic) return { name: generic[1].trim(), qty: generic[2].trim() };
  return null;
}
```

Aggiungi l'interfaccia `ParsedSupplements` subito prima della classe `PdfImportService` (circa riga 150, appena sopra `@Injectable`):

```ts
export interface ParsedSupplements {
  /** Pasto -> voci valide per ogni piano dieta (es. Colazione, Pranzo, Cena). */
  always: Record<string, SupplementItem[]>;
  /** Pasto -> voci valide solo nei piani il cui nome contiene "on" (case-insensitive). */
  onlyOn: Record<string, SupplementItem[]>;
}
```

Infine, aggiungi il metodo dentro la classe `PdfImportService`, subito dopo `extractText()`:

```ts
  /** Parser best-effort per il PDF di integrazione: ogni riga viene assegnata al/ai
   *  pasto/i che indica, con la quantita' scritta li' - nessun tentativo di dedurre se
   *  lo stesso integratore citato altrove sia "la stessa dose" (deciso col coach: la
   *  creatina di colazione e quella post-workout sono due dosi indipendenti). Una riga
   *  che non permette di individuare pasto+quantita' viene scartata silenziosamente. */
  parseSupplementText(text: string): ParsedSupplements {
    const lines = text.split(/\n|\r/).map(l => l.trim()).filter(Boolean);
    const always: Record<string, SupplementItem[]> = {};
    const onlyOn: Record<string, SupplementItem[]> = {};
    const push = (map: Record<string, SupplementItem[]>, meal: string, item: SupplementItem) => {
      if (!map[meal]) map[meal] = [];
      map[meal].push(item);
    };

    let section: 'pre' | 'intra' | 'post' | null = null;
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      const sectionMatch = line.match(SUPPLEMENT_SECTION_RE);
      if (sectionMatch) {
        const kind = sectionMatch[1].toLowerCase();
        section = kind.startsWith('pre') ? 'pre' : kind.startsWith('intra') ? 'intra' : 'post';
        i++;
        continue;
      }

      if (section === 'intra') {
        let blob = line;
        i++;
        while (i < lines.length && SUPPLEMENT_CONTINUATION_RE.test(lines[i])) {
          blob += ' ' + lines[i];
          i++;
        }
        push(onlyOn, 'Intra-Workout', { name: 'Intra-workout', qty: blob });
        section = null;
        continue;
      }

      if (section === 'pre' || section === 'post') {
        if (supplementMealsInText(line).length > 0) {
          // Riga con parola chiave pasto esplicita: il coach sta indicando un pasto
          // diverso da quello implicito della sezione, esce dal blocco e viene
          // rielaborata sotto come riga semplice (es. "magnesio ... dopo cena").
          section = null;
        } else {
          const extracted = extractSupplementInSection(line);
          if (extracted) push(onlyOn, SUPPLEMENT_SECTION_MEAL[section], extracted);
          i++;
          continue;
        }
      }

      let blob = line;
      i++;
      while (i < lines.length && SUPPLEMENT_CONTINUATION_RE.test(lines[i])) {
        blob += ' ' + lines[i];
        i++;
      }
      const extracted = extractSupplementOutsideSection(blob);
      if (extracted) {
        for (const meal of supplementMealsInText(extracted.qty)) {
          push(always, meal, { name: extracted.name, qty: extracted.qty });
        }
      }
    }

    return { always, onlyOn };
  }
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npx ng test --watch=false --include='**/pdf-import.service.spec.ts'`
Expected: PASS (tutti i test del file, inclusi i 2 nuovi)

- [ ] **Step 5: Esegui l'intera suite**

Run: `npx ng test --watch=false`
Expected: PASS (77 test: 75 precedenti + 2 nuovi)

- [ ] **Step 6: Build**

Run: `npx ng build --configuration production`
Expected: build pulita

- [ ] **Step 7: Commit**

```bash
git add src/app/services/pdf-import.service.ts src/app/services/pdf-import.service.spec.ts
git commit -m "feat: parser automatico testo integrazione (parseSupplementText)"
```

---

### Task 2: Applicazione ai piani dieta in `CoachProtocolImportComponent`

**Files:**
- Modify: `src/app/pages/coach-protocol-import/coach-protocol-import.component.ts`
- Test: `src/app/pages/coach-protocol-import/coach-protocol-import.component.spec.ts` (nuovo file)

**Interfaces:**
- Consumes: `ParsedSupplements`, `PdfImportService.parseSupplementText(text: string): ParsedSupplements` (Task 1, `src/app/services/pdf-import.service.ts`).
- Produces: `applyParsedSupplements(diet: Diet, parsed: ParsedSupplements): void` (metodo privato, non consumato da altri task).

- [ ] **Step 1: Scrivi il test (che deve fallire)**

Crea `src/app/pages/coach-protocol-import/coach-protocol-import.component.spec.ts`:

```ts
import { vi } from 'vitest';

// pdfjs-dist tocca API browser assenti nell'ambiente di test: stesso mock gia' usato
// in pdf-import.service.spec.ts e in coach-protocol-builder.component.spec.ts.
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {},
  version: '0.0.0',
  getDocument: () => ({ promise: Promise.resolve({ numPages: 0 }) })
}));

import { CoachProtocolImportComponent } from './coach-protocol-import.component';
import { PdfImportService, ParsedSupplements } from '../../services/pdf-import.service';
import { ProtocolService } from '../../services/protocol.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { AuthService } from '../../core/services/auth.service';
import { Diet } from '../../models/diet.model';

describe('CoachProtocolImportComponent', () => {
  function emptyAlternatives() {
    return { carb: [], protein: [], fat: [] };
  }

  function buildDiet(): Diet {
    return [
      {
        id: 'plan-on', name: 'Giorno ON', meals: [
          { id: 'm1', name: 'Colazione', combinations: [], alternatives: emptyAlternatives() },
          { id: 'm2', name: 'Cena', combinations: [], alternatives: emptyAlternatives() }
        ]
      },
      {
        id: 'plan-off', name: 'Giorno OFF', meals: [
          { id: 'm3', name: 'Colazione', combinations: [], alternatives: emptyAlternatives() },
          { id: 'm4', name: 'Cena', combinations: [], alternatives: emptyAlternatives() }
        ]
      }
    ];
  }

  function buildComponent(): CoachProtocolImportComponent {
    return new CoachProtocolImportComponent(
      {} as any, // ActivatedRoute: non usato, non chiamiamo ngOnInit
      {} as any, // Router
      new PdfImportService(),
      {} as any, // ProtocolService
      {} as any, // ConfirmDialogService
      {} as any, // AuthService
      { detectChanges: () => {} } as any // ChangeDetectorRef
    );
  }

  it('applica "always" a tutti i piani e "onlyOn" (con creazione pasto mancante) solo ai piani con "on" nel nome', () => {
    const component = buildComponent();
    const diet = buildDiet();
    const parsed: ParsedSupplements = {
      always: {
        Colazione: [{ name: 'Vitamina C+B', qty: '1 dose' }],
        Cena: [{ name: 'Magnesio', qty: '400 mg' }]
      },
      onlyOn: {
        Cena: [{ name: 'Creatina', qty: '5 g' }],
        'Intra-Workout': [{ name: 'Intra-workout', qty: '10 g' }]
      }
    };

    (component as any).applyParsedSupplements(diet, parsed);

    const onPlan = diet.find(p => p.name === 'Giorno ON')!;
    const offPlan = diet.find(p => p.name === 'Giorno OFF')!;

    expect(onPlan.meals.find(m => m.name === 'Colazione')!.supplements)
      .toEqual([{ name: 'Vitamina C+B', qty: '1 dose' }]);
    // Cena nel piano ON: Magnesio (always) + Creatina (onlyOn) insieme, non sostituiti.
    expect(onPlan.meals.find(m => m.name === 'Cena')!.supplements)
      .toEqual([{ name: 'Magnesio', qty: '400 mg' }, { name: 'Creatina', qty: '5 g' }]);
    // Pasto mancante creato solo per Intra-Workout, solo nel piano ON.
    const intraWorkout = onPlan.meals.find(m => m.name === 'Intra-Workout');
    expect(intraWorkout).toBeTruthy();
    expect(intraWorkout!.supplements).toEqual([{ name: 'Intra-workout', qty: '10 g' }]);

    // Piano OFF: solo le voci "always", nessuna Creatina, nessun pasto Intra-Workout creato.
    expect(offPlan.meals.find(m => m.name === 'Colazione')!.supplements)
      .toEqual([{ name: 'Vitamina C+B', qty: '1 dose' }]);
    expect(offPlan.meals.find(m => m.name === 'Cena')!.supplements)
      .toEqual([{ name: 'Magnesio', qty: '400 mg' }]);
    expect(offPlan.meals.find(m => m.name === 'Intra-Workout')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npx ng test --watch=false --include='**/coach-protocol-import.component.spec.ts'`
Expected: FAIL — `(intermediate value).applyParsedSupplements is not a function` (o errore di costruzione se il costruttore non combacia ancora — verificare che l'ordine dei parametri nel test rispecchi quello attuale del costruttore prima di procedere allo Step 3)

- [ ] **Step 3: Implementa `applyParsedSupplements` e collegalo a `processCreate`/`processUpdate`**

In `src/app/pages/coach-protocol-import/coach-protocol-import.component.ts`, aggiungi `NamedMeal`, `newNamedMeal`, `Diet` all'import da `diet.model` — oggi questo file non importa nulla da `diet.model.ts` (`Diet` arriva solo indirettamente via `Protocol['diet']`), quindi aggiungi una nuova riga di import subito dopo quella di `protocol.model` (riga 10):

```ts
import { Protocol } from '../../models/protocol.model';
import { Diet, NamedMeal, newNamedMeal } from '../../models/diet.model';
import { ParsedSupplements } from '../../services/pdf-import.service';
```

Aggiungi il metodo privato, subito prima di `processCreate()` (riga 208):

```ts
  /** Applica le voci Integrazione riconosciute dal parser ai pasti giusti di ogni piano
   *  dieta: "always" su tutti i piani, "onlyOn" solo sui piani il cui nome contiene "on"
   *  (case-insensitive) - per Cena si AGGIUNGONO a quelle gia' scritte da "always", non
   *  le sostituiscono. Crea il pasto "Intra-Workout" se manca in un piano "on"; nessun
   *  altro pasto mancante viene creato (solo i nomi pasto standard esistono di norma). */
  private applyParsedSupplements(diet: Diet, parsed: ParsedSupplements): void {
    for (const plan of diet) {
      for (const [mealName, items] of Object.entries(parsed.always)) {
        const meal = plan.meals.find(m => m.name.toLowerCase() === mealName.toLowerCase());
        if (meal) meal.supplements = items;
      }

      if (/\bon\b/i.test(plan.name)) {
        for (const [mealName, items] of Object.entries(parsed.onlyOn)) {
          let meal: NamedMeal | undefined = plan.meals.find(m => m.name.toLowerCase() === mealName.toLowerCase());
          if (!meal) {
            if (mealName !== 'Intra-Workout') continue;
            meal = newNamedMeal(mealName);
            plan.meals.push(meal);
          }
          meal.supplements = [...(meal.supplements ?? []), ...items];
        }
      }
    }
  }
```

In `processCreate()`, dentro il blocco `if (this.integrazioneFile)` (righe 227-231), applica il parser al `diet` gia' costruito (`diet` e' `const` dichiarata alla riga 221, un array: mutare i suoi elementi e' valido):

```ts
    if (this.integrazioneFile) {
      this.setStage('Lettura integrazione…', 75);
      const integrazioneText = await this.withTimeout(this.pdfSvc.extractText(this.integrazioneFile), 'Lettura integrazione');
      supplementNotesSource = integrazioneText.trim();
      this.applyParsedSupplements(diet, this.pdfSvc.parseSupplementText(integrazioneText));
    }
```

In `processUpdate()`, dentro il blocco `if (this.integrazioneFile)` (righe 282-286): qui `patch.diet` esiste solo se `this.dietaFile` era presente (riga 277). Se il coach carica SOLO il file integrazione, bisogna applicare il parser al diet dell'esistente e scriverlo comunque nel patch, altrimenti le voci calcolate non verrebbero mai salvate:

```ts
    if (this.integrazioneFile) {
      this.setStage('Lettura integrazione…', percent);
      const integrazioneText = await this.withTimeout(this.pdfSvc.extractText(this.integrazioneFile), 'Lettura integrazione');
      supplementNotesSource = integrazioneText.trim();
      const dietToPatch = patch.diet ?? existing.diet;
      this.applyParsedSupplements(dietToPatch, this.pdfSvc.parseSupplementText(integrazioneText));
      patch.diet = dietToPatch;
    }
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npx ng test --watch=false --include='**/coach-protocol-import.component.spec.ts'`
Expected: PASS

- [ ] **Step 5: Esegui l'intera suite**

Run: `npx ng test --watch=false`
Expected: PASS (78 test: 77 del Task 1 + 1 nuovo)

- [ ] **Step 6: Build**

Run: `npx ng build --configuration production`
Expected: build pulita

- [ ] **Step 7: Commit**

```bash
git add src/app/pages/coach-protocol-import/coach-protocol-import.component.ts src/app/pages/coach-protocol-import/coach-protocol-import.component.spec.ts
git commit -m "feat: applica il parser integrazione ai pasti in creazione/aggiornamento protocollo"
```

---

## Verifica manuale finale

Ricaricare il PDF di integrazione di Andrea Carfora (solo quel file, come nello scenario reale che ha segnalato il problema) tramite "Aggiorna da PDF", poi controllare nel builder e lato cliente che Colazione/Pranzo/Cena/Merenda mostrino le voci Integrazione attese e che, se il piano "Giorno ON" non ha gia' un pasto "Intra-Workout", ora ce l'abbia con la voce corretta.
