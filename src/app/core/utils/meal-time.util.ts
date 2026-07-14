import { NamedMeal } from '../../models/diet.model';

interface TimeBand {
  keyword: string;
  startMinutes: number;
  endMinutes: number; // > 1440 per le fasce che attraversano la mezzanotte
}

const TIME_BANDS: TimeBand[] = [
  { keyword: 'colazione', startMinutes: 5 * 60, endMinutes: 10 * 60 + 29 },
  { keyword: 'spuntino', startMinutes: 10 * 60 + 30, endMinutes: 11 * 60 + 59 },
  { keyword: 'pranzo', startMinutes: 12 * 60, endMinutes: 15 * 60 + 29 },
  { keyword: 'merenda', startMinutes: 15 * 60 + 30, endMinutes: 18 * 60 + 59 },
  { keyword: 'cena', startMinutes: 19 * 60, endMinutes: 24 * 60 + 4 * 60 + 59 }
];

function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function inBand(minutes: number, band: TimeBand): boolean {
  if (band.endMinutes <= 24 * 60) {
    return minutes >= band.startMinutes && minutes <= band.endMinutes;
  }
  return minutes >= band.startMinutes || minutes <= band.endMinutes - 24 * 60;
}

/**
 * Trova l'indice del pasto la cui fascia oraria contiene l'orario attuale,
 * in base a una parola chiave nel nome del pasto. Se nessun pasto ha un
 * nome riconosciuto per la fascia corrente, restituisce 0.
 */
export function findCurrentMealIndex(meals: NamedMeal[], now: Date = new Date()): number {
  if (meals.length === 0) return 0;
  const minutes = minutesSinceMidnight(now);
  const band = TIME_BANDS.find(b => inBand(minutes, b));
  if (!band) return 0;
  const idx = meals.findIndex(m => m.name.toLowerCase().includes(band.keyword));
  return idx === -1 ? 0 : idx;
}
