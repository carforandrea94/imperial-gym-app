import { Injectable } from '@angular/core';
import * as pdfjsLib from 'pdfjs-dist';
import { Day, Exercise } from '../models/workout.model';
import { Diet, DietMeals, MEAL_LABELS, newDietPlan } from '../models/diet.model';

// Worker servito da CDN (evita di dover gestire il bundling del worker separatamente)
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${(pdfjsLib as any).version}/pdf.worker.min.mjs`;

const MEAL_KEYWORDS: Record<string, keyof DietMeals> = {
  'colazione': 'colazione',
  'spuntino': 'spuntino',
  'spuntino mattutino': 'spuntino',
  'pranzo': 'pranzo',
  'merenda': 'merenda',
  'spuntino pomeridiano': 'merenda',
  'cena': 'cena'
};

@Injectable({ providedIn: 'root' })
export class PdfImportService {

  async extractText(file: File): Promise<string> {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const lines: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = (content.items as any[]).map(it => it.str).join(' ');
      lines.push(pageText);
    }
    return lines.join('\n');
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
   * Parsing euristico best-effort di un testo di dieta. Riconosce le
   * intestazioni dei pasti (Colazione/Pranzo/Cena/ecc.) e assegna le righe
   * successive come alimenti, provando a separare nome e quantita'
   * dall'ultimo blocco numerico+unita' della riga. Da rivedere nel builder.
   */
  parseDietText(text: string): Diet {
    const plan = newDietPlan('Dieta (da PDF)');

    const rawLines = text.split(/\n|\r/).map(l => l.trim()).filter(Boolean);
    const qtyRegex = /^(.+?)\s+([\d.,]+\s?(?:g|kg|ml|l|cucchiai|cucchiaino|fette|pz|uova)\.?)$/i;

    let currentMealKey: keyof DietMeals | null = null;

    for (const line of rawLines) {
      const lower = line.toLowerCase().replace(/[:：]/g, '').trim();
      const mealMatch = Object.keys(MEAL_KEYWORDS).find(k => lower === k || lower.startsWith(k + ' '));
      if (mealMatch) {
        currentMealKey = MEAL_KEYWORDS[mealMatch];
        continue;
      }
      if (!currentMealKey) continue;

      const meal = plan[currentMealKey];
      if (!meal.items) meal.items = [];

      const m = line.match(qtyRegex);
      if (m) {
        meal.items.push({ name: m[1].trim(), qty: m[2].trim() });
      } else if (line.length > 1 && line.length < 80) {
        meal.items.push({ name: line, qty: '' });
      }
    }

    return [plan];
  }
}
