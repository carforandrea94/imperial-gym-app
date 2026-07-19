/**
 * Alterna la selezione di una data nella lista progressi, mantenendo al
 * massimo 2 elementi selezionati. Se una data è già selezionata, la
 * rimuove. Se sono già selezionate 2 date e se ne sceglie una terza, la
 * meno recente delle 2 (data più piccola, le date YYYY-MM-DD si ordinano
 * correttamente come stringhe) viene scartata per far posto alla nuova.
 */
export function toggleSelection(selected: string[], date: string): string[] {
  if (selected.includes(date)) {
    return selected.filter(d => d !== date);
  }
  if (selected.length < 2) {
    return [...selected, date];
  }
  const [, newest] = [...selected].sort();
  return [newest, date];
}
