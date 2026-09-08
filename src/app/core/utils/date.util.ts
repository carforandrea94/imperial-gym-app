/** Data di oggi in formato YYYY-MM-DD, in ora locale (non UTC come farebbe toISOString()). */
export function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Lunedi' della settimana in cui cade la data, a mezzanotte locale. E' il
 * riferimento con cui si confrontano due date per sapere se stanno nella stessa
 * settimana di CALENDARIO (lunedi'-domenica), che e' come l'utente conta le
 * settimane: gli allenamenti fatti e i chilometri corsi si azzerano insieme,
 * la notte fra domenica e lunedi'.
 */
export function mondayOf(dateISO: string): Date {
  const d = new Date(dateISO + 'T00:00:00');
  // getDay(): 0 = domenica. La domenica appartiene alla settimana che inizia
  // sei giorni prima, non a quella che inizia il giorno dopo.
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Come mondayOf, ma in formato ISO: comodo come chiave o per confronti diretti fra stringhe. */
export function mondayISO(dateISO: string): string {
  const d = mondayOf(dateISO);
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
