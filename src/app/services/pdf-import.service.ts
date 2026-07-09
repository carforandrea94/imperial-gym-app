import { Injectable } from '@angular/core';
import * as pdfjsLib from 'pdfjs-dist';
import { Day, Exercise } from '../models/workout.model';
import {
  Diet, DietPlan, NamedMeal, MealCombination, FoodItem, FoodCategory,
  DEFAULT_MEAL_NAMES, newDietPlan, newNamedMeal, newCombination
} from '../models/diet.model';
// Worker servito da CDN (evita di dover gestire il bundling del worker separatamente)
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${(pdfjsLib as any).version}/pdf.worker.min.mjs`;

const MEAL_KEYWORDS: Record<string, string> = {
  'colazione': 'Colazione',
  'spuntino': 'Spuntino',
  'spuntino mattutino': 'Spuntino',
  'pranzo': 'Pranzo',
  'merenda': 'Merenda',
  'spuntino pomeridiano': 'Merenda',
  'cena': 'Cena'
};

/** Intestazioni pasto riconosciute nel template "Giorno ON/OFF" (nutrizionista),
 *  con l'eventuale suffisso "ALTERNATIVA N" catturato nel gruppo 1. L'ordine conta:
 *  i nomi composti vanno prima del generico "Spuntino" per non essere troncati. */
const MEAL_HEADER_DEFS: { name: string; re: RegExp }[] = [
  { name: 'Spuntino Mattina', re: /^SPUNTINO\s+MATTINA(?:\s+ALTERNATIVA\s*(\d+))?$/i },
  { name: 'Merenda', re: /^SPUNTINO\s+POMERIDIANO(?:\s+ALTERNATIVA\s*(\d+))?$/i },
  { name: 'Colazione', re: /^COLAZIONE(?:\s+ALTERNATIVA\s*(\d+))?$/i },
  { name: 'Pranzo', re: /^PRANZO(?:\s+ALTERNATIVA\s*(\d+))?$/i },
  { name: 'Merenda', re: /^MERENDA(?:\s+ALTERNATIVA\s*(\d+))?$/i },
  { name: 'Cena', re: /^CENA(?:\s+ALTERNATIVA\s*(\d+))?$/i },
  { name: 'Spuntino', re: /^SPUNTINO(?:\s+ALTERNATIVA\s*(\d+))?$/i }
];

const GIORNO_HEADER_RE = /^GIORNO\s+(.+)$/i;
const CONTINUA_RE = /^[.…]{2,}\s*continua\b/i;
const ALTERNATIVE_MARKER_RE = /^alternative\s*:?\s*$/i;

/** Riga tipo "Farina d'avena 5 Cucchiai 50 g": cattura la quantita' in grammi/ml/l a fine riga. */
const GRAM_TAIL_RE = /(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l)\.?\s*$/i;

/** Separa dal testo prima dei grammi l'eventuale "misura" (es. "5 Cucchiai", "3/4 di Piatto",
 *  "1 Piatto e 1/4") dal nome dell'alimento. Se non trova una misura riconosciuta, non c'e' match. */
const MISURA_RE = /^(.*?)\s+((?:\d+(?:[\/.,]\d+)?\s+)?(?:di\s+)?(?:cucchiai(?:ni|no)?|fett[ae]|piatt[oi]|panin[oi])(?:\s+e\s+\d+(?:[\/.,]\d+)?)?)$/i;

const CARB_KEYWORDS = [
  'avena', 'riso', 'pasta', 'patate', 'pane', 'gallette', 'fette biscottate', 'crusca',
  'cornflakes', 'gnocchi', 'cous cous', 'fiocchi', 'tostato', 'segale', 'azzimo',
  'frutta fresca', 'farina'
];
const PROTEIN_KEYWORDS = [
  'pollo', 'tacchino', 'merluzzo', 'nasello', 'tonno', 'calamaro', 'seppia', 'gamberetti',
  'rombo', 'platessa', 'salmone', 'pesce spada', 'vitello', 'proteine isolate', 'proteine',
  'yogurt greco', 'bresaola', 'manzo', 'maiale', 'coniglio'
];
const FAT_KEYWORDS = [
  'burro', 'frutta secca', 'olio', 'parmigiano', 'semi di chia', 'formaggio', 'mandorle',
  'noci', 'avocado'
];

/** Categorizza un alimento per macro in base al nome. E' un aiuto best-effort:
 *  il coach puo' sempre correggere la categoria nel builder dopo l'import. */
function categorizeFood(name: string): FoodCategory | 'skip' {
  const n = name.toLowerCase();
  if (/verdur/.test(n)) return 'skip'; // niente slot dedicato a "verdure" nel modello: restano fuori, come nota generale
  if (/albume/.test(n)) return 'protein';
  if (/uova di gallina/.test(n)) return 'fat'; // uovo intero: nel modello a 3 macro va con i grassi
  if (PROTEIN_KEYWORDS.some(k => n.includes(k))) return 'protein';
  if (FAT_KEYWORDS.some(k => n.includes(k))) return 'fat';
  if (CARB_KEYWORDS.some(k => n.includes(k))) return 'carb';
  return 'carb'; // fallback: da rivedere nel builder
}

@Injectable({ providedIn: 'root' })
export class PdfImportService {

  async extractText(file: File): Promise<string> {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      // Ogni TextItem segnala se chiude una riga (hasEOL): senza questo, unire tutto
      // con uno spazio appiattirebbe l'intera pagina su un'unica riga, rendendo
      // impossibile qualunque parsing riga-per-riga (intestazioni, alimenti, ecc.).
      let pageText = '';
      for (const it of content.items as any[]) {
        pageText += it.str;
        pageText += it.hasEOL ? '\n' : ' ';
      }
      pages.push(pageText);
    }
    return pages.join('\n');
  }

  /**
   * Parsing euristico best-effort di un testo di scheda allenamento.
   * Riconosce righe tipo "Nome esercizio 4x10" o "Nome esercizio 3x12-10-8".
   * Le righe che sembrano titoli (poche parole, senza numeri) diventano
   * l'inizio di un nuovo giorno. Tutto il resto va in "Giorno 1" di default.
   * E' un aiuto per non partire da zero, va sempre rivisto nel builder.
   */
  parseWorkoutText(text: string): Day[] {
    const rawLines = text.split(/\n|\r/).map(l => l.trim()).filter(Boolean);
    const exRegex = /^(.{2,60}?)\s+(\d+)\s*[x×]\s*([\d\-\/,\s]+)$/i;
    const dayHeaderRegex = /^(giorno|day)\s*\d*[:\-]?\s*(.*)$/i;

    const days: Day[] = [];
    let current: Day | null = null;
    let dayCount = 0;

    const newDay = (label: string) => {
      dayCount++;
      const d: Day = { id: `day${dayCount}`, label: label || `Giorno ${dayCount}`, rec: '60-90"', ex: [] };
      days.push(d);
      current = d;
    };

    for (const line of rawLines) {
      const headerMatch = line.match(dayHeaderRegex);
      if (headerMatch) {
        newDay(headerMatch[2] || line);
        continue;
      }

      const exMatch = line.match(exRegex);
      if (exMatch) {
        if (!current) newDay('Giorno 1');
        const [, name, setsStr, repsStr] = exMatch;
        const sets = parseInt(setsStr, 10) || 1;
        const reps = repsStr.split(/[-\/,]/).map(r => r.trim()).filter(Boolean);
        const ex: Exercise = {
          name: name.trim(),
          scheme: 'plain',
          sets,
          muscle: 'Core',
          text: `${sets}x${repsStr.trim()}`,
          reps: reps.length === sets ? reps : Array.from({ length: sets }, (_, i) => reps[i] ?? reps[0] ?? '')
        };
        current!.ex.push(ex);
      }
    }

    return days;
  }

  /**
   * Prova prima il parsing "a template" (piani "Giorno ON/OFF" con pasti a combinazioni
   * Base + Alternativa, come nei PDF generati da software di nutrizione standard). Se il
   * testo non contiene nessuna intestazione "Giorno ...", ripiega sul parsing generico
   * (un solo piano, un pasto per intestazione nota, nessuna combinazione/alternativa).
   */
  parseDietText(text: string): Diet {
    const templatePlans = this.parseDietTemplate(text);
    if (templatePlans && templatePlans.length > 0) return templatePlans;
    return this.parseDietTextGeneric(text);
  }

  /**
   * Estrae dal PDF dieta le informazioni che non rientrano nel modello a 3 macro per
   * combinazione (verdure fresche, "Consigli di base"), da usare come nota libera del
   * protocollo (infoNote). Ritorna stringa vuota se non trova nulla di utile.
   */
  extractDietNotes(text: string): string {
    const lines = text.split(/\n|\r/).map(l => l.trim()).filter(Boolean);
    const notes: string[] = [];

    const verdureSeen = new Set<string>();
    const verdureRe = /^verdure fresche.*?(\d+(?:[.,]\d+)?\s*g)/i;
    for (const line of lines) {
      const m = line.match(verdureRe);
      if (m) verdureSeen.add(m[1].replace(/\s+/g, ' '));
    }
    if (verdureSeen.size > 0) {
      notes.push(`Verdure fresche libere ad ogni pasto principale (quantita' indicativa dal PDF: ${Array.from(verdureSeen).join(' / ')}).`);
    }

    const idx = lines.findIndex(l => /^consigli di base$/i.test(l));
    if (idx >= 0) {
      const tips = lines.slice(idx + 1).filter(l =>
        !/^consigli di base$/i.test(l) &&
        !/^dott\.?\s/i.test(l) &&
        !/^\d{2}\/\d{2}\/\d{4}/.test(l) &&
        !/^pagina\s+\d+\s+di\s+\d+$/i.test(l)
      );
      if (tips.length > 0) notes.push('Consigli di base:\n' + tips.map(t => `- ${t}`).join('\n'));
    }

    return notes.join('\n\n');
  }

  /** Parsing a template: piani "Giorno X", pasti con combinazioni Base + Alternativa N. */
  private parseDietTemplate(text: string): Diet | null {
    // Alcuni PDF uniscono l'alimento e il marcatore "Alternative:" sulla stessa riga
    // (es. "Petto di pollo 200 g Alternative:"): isolo sempre il marcatore su una riga
    // propria, indipendentemente da come pdf.js ha ricostruito gli a-capo.
    const cleaned = text
      .replace(/Olio di oli\s+(\d+(?:[.,]\d+)?\s*g)\s+va\s*\(media\)/gi, 'Olio di oliva (media) $1')
      .replace(/\s*Alternative\s*:\s*/gi, '\nAlternative:\n');

    const rawLines = cleaned.split(/\n|\r/).map(l => l.trim()).filter(Boolean);

    const plans: DietPlan[] = [];
    let currentPlan: DietPlan | null = null;
    let currentMeal: NamedMeal | null = null;
    let currentCombo: MealCombination | null = null;
    let lastItem: FoodItem | null = null;
    let collectingAlt = false;

    const findOrCreateMeal = (plan: DietPlan, name: string): NamedMeal => {
      let meal = plan.meals.find(m => m.name === name);
      if (!meal) {
        meal = newNamedMeal(name);
        meal.combinations = []; // costruiamo noi le combinazioni via via, non partiamo dalla 'Base' vuota di default
        plan.meals.push(meal);
      }
      return meal;
    };

    for (const line of rawLines) {
      const giornoMatch = line.match(GIORNO_HEADER_RE);
      if (giornoMatch) {
        const planName = `Giorno ${giornoMatch[1].trim()}`;
        currentPlan = plans.find(p => p.name === planName) ?? null;
        if (!currentPlan) {
          currentPlan = newDietPlan(planName);
          currentPlan.meals = [];
          plans.push(currentPlan);
        }
        currentMeal = null;
        currentCombo = null;
        lastItem = null;
        collectingAlt = false;
        continue;
      }

      if (CONTINUA_RE.test(line)) continue; // riga di continuazione tra pagine: il contesto resta invariato

      if (currentPlan) {
        const mealHeader = MEAL_HEADER_DEFS.find(d => d.re.test(line));
        if (mealHeader) {
          const m = line.match(mealHeader.re)!;
          const altNum = m[1];
          const meal = findOrCreateMeal(currentPlan, mealHeader.name);
          currentMeal = meal;
          if (altNum) {
            const combo = newCombination(`Alternativa ${altNum}`);
            meal.combinations.push(combo);
            currentCombo = combo;
          } else {
            if (meal.combinations.length === 0) meal.combinations.push(newCombination('Base'));
            currentCombo = meal.combinations[0];
          }
          lastItem = null;
          collectingAlt = false;
          continue;
        }
      }

      if (ALTERNATIVE_MARKER_RE.test(line)) {
        collectingAlt = !!lastItem;
        continue;
      }

      if (!currentCombo) continue; // testo fuori contesto: dati anagrafici, intestazioni pagina, consigli finali

      const gramMatch = line.match(GRAM_TAIL_RE);
      if (!gramMatch || gramMatch.index === undefined) continue; // prosa non riconosciuta (sottotitoli, note extra)

      const gramPart = gramMatch[0].trim();
      const headPart = line.slice(0, gramMatch.index).trim();
      if (!headPart) continue;

      const misuraMatch = headPart.match(MISURA_RE);
      const name = (misuraMatch ? misuraMatch[1] : headPart).trim();
      const qty = misuraMatch ? `${misuraMatch[2]} · ${gramPart}` : gramPart;
      if (!name) continue;

      const cat = categorizeFood(name);
      if (cat === 'skip') continue; // verdure ecc.: mai nel modello, ne' come base ne' come alternativa

      // Le alternative preservano sempre la stessa macro dell'alimento a cui si riferiscono
      // (e' la logica delle liste di scambio): se la categoria cambia, non e' un'alternativa
      // ma il prossimo alimento della combinazione.
      if (collectingAlt && lastItem && lastItem.category === cat) {
        if (!lastItem.alt) lastItem.alt = [];
        lastItem.alt.push({ name, qty });
        continue;
      }
      collectingAlt = false;

      if (currentCombo[cat]) {
        // macro gia' occupata in questa combinazione: aggiungo come alternativa
        // dell'alimento presente invece di perdere il dato.
        const existing: FoodItem = currentCombo[cat]!;
        if (!existing.alt) existing.alt = [];
        existing.alt.push({ name, qty });
        lastItem = existing;
      } else {
        const food: FoodItem = { name, qty, category: cat };
        currentCombo[cat] = food;
        lastItem = food;
      }
    }

    return plans.length > 0 ? plans : null;
  }

  /**
   * Parsing euristico generico (fallback): un solo piano, intestazioni pasto note
   * (Colazione/Pranzo/Cena/ecc.), niente combinazioni/alternative. Usato quando il
   * testo non corrisponde al template "Giorno ON/OFF".
   */
  private parseDietTextGeneric(text: string): Diet {
    const plan = newDietPlan('Dieta (da PDF)');
    plan.meals = []; // ripartiamo da zero, aggiungiamo solo i pasti che troviamo davvero nel testo

    const rawLines = text.split(/\n|\r/).map(l => l.trim()).filter(Boolean);
    const qtyRegex = /^(.+?)\s+([\d.,]+\s?(?:g|kg|ml|l|cucchiai|cucchiaino|fette|pz|uova)\.?)$/i;

    let currentMealName: string | null = null;

    for (const line of rawLines) {
      const lower = line.toLowerCase().replace(/[:：]/g, '').trim();
      const mealMatch = Object.keys(MEAL_KEYWORDS).find(k => lower === k || lower.startsWith(k + ' '));
      if (mealMatch) {
        currentMealName = MEAL_KEYWORDS[mealMatch];
        if (!plan.meals.some(m => m.name === currentMealName)) {
          plan.meals.push(newNamedMeal(currentMealName));
        }
        continue;
      }
      if (!currentMealName) continue;

      const meal = plan.meals.find(m => m.name === currentMealName)!;
      const base = meal.combinations[0];

      const m = line.match(qtyRegex);
      const food = m
        ? { name: m[1].trim(), qty: m[2].trim() as string, category: 'carb' as const }
        : (line.length > 1 && line.length < 80 ? { name: line, qty: '', category: 'carb' as const } : null);
      if (!food) continue;

      // Non potendo dedurre la macro dal solo testo, il primo alimento del pasto
      // va nella combinazione base (categoria da rivedere nel builder), gli altri
      // finiscono tra le alternative: il coach riorganizza tutto nel builder.
      if (!base.carb) {
        base.carb = food;
      } else {
        meal.alternatives.carb.push(food);
      }
    }

    // Se non e' stato riconosciuto nessun pasto, torna comunque i 5 standard vuoti
    if (plan.meals.length === 0) {
      plan.meals = DEFAULT_MEAL_NAMES.map(name => newNamedMeal(name));
    }

    return [plan];
  }
}
