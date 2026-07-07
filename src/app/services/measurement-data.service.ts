import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';
import { MeasurementEntry, ALL_MEASURE_FIELDS, MeasurementKey } from '../models/measurement.model';

const HISTORY_PREFIX = 'misure:';
const DRAFT_KEY = 'misure:draft';

@Injectable({ providedIn: 'root' })
export class MeasurementDataService {

  constructor(private storage: StorageService) {}

  historyKey(date: string): string {
    return `${HISTORY_PREFIX}${date}`;
  }

  get draftKey(): string {
    return DRAFT_KEY;
  }

  loadDraft(): MeasurementEntry | null {
    return this.storage.getJSON<MeasurementEntry>(DRAFT_KEY);
  }

  saveDraft(entry: MeasurementEntry): void {
    this.storage.setJSON(DRAFT_KEY, entry);
  }

  clearDraft(): void {
    this.storage.delete(DRAFT_KEY);
  }

  /** Tutte le voci storiche, ordinate dalla piu' recente. */
  loadHistory(): MeasurementEntry[] {
    const keys = this.storage.list(HISTORY_PREFIX)
      .filter(k => k !== DRAFT_KEY)
      .sort()
      .reverse();
    return keys
      .map(k => this.storage.getJSON<MeasurementEntry>(k))
      .filter((e): e is MeasurementEntry => !!e);
  }

  saveEntry(entry: MeasurementEntry): boolean {
    return this.storage.setJSON(this.historyKey(entry.date), entry);
  }

  deleteEntry(date: string): boolean {
    return this.storage.delete(this.historyKey(date));
  }

  /** Per ogni campo, l'ultimo valore registrato nello storico (per i placeholder in form). */
  getLastValues(): Partial<Record<MeasurementKey, string>> {
    const history = this.loadHistory();
    const out: Partial<Record<MeasurementKey, string>> = {};
    for (const field of ALL_MEASURE_FIELDS) {
      for (const entry of history) {
        const v = entry[field.key];
        if (v) { out[field.key] = v; break; }
      }
    }
    return out;
  }

  /** L'ultima voce storica precedente a una certa data (per calcolare le variazioni). */
  getPreviousEntry(beforeDate?: string): MeasurementEntry | null {
    const history = this.loadHistory();
    if (!beforeDate) return history[0] ?? null;
    return history.find(e => e.date < beforeDate) ?? null;
  }
}
