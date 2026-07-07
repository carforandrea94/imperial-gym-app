import { Injectable } from '@angular/core';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { FirebaseService } from '../core/services/firebase.service';
import { AuthService } from '../core/services/auth.service';
import { AppStateService } from './app-state.service';
import { MeasurementEntry, ALL_MEASURE_FIELDS, MeasurementKey } from '../models/measurement.model';
import { ZoneFixService } from '../core/utils/zone.util';

/**
 * Dati misure su Firestore:
 * - storico: users/{uid}/measurements/{isoDate}
 * - bozza in corso: campo measureDraft del doc users/{uid}/state/app
 */
@Injectable({ providedIn: 'root' })
export class MeasurementDataService {

  constructor(
    private fb: FirebaseService,
    private auth: AuthService,
    private appState: AppStateService,
    private zoneFix: ZoneFixService
  ) {}

  private col() {
    const uid = this.auth.currentUser()!.uid;
    return collection(this.fb.db, 'users', uid, 'measurements');
  }

  async loadDraft(): Promise<MeasurementEntry | null> {
    const state = await this.appState.load();
    return (state.measureDraft as unknown as MeasurementEntry) ?? null;
  }

  async saveDraft(entry: MeasurementEntry): Promise<void> {
    await this.appState.patch({ measureDraft: entry as any });
  }

  async clearDraft(): Promise<void> {
    await this.appState.patch({ measureDraft: null });
  }

  /** Tutte le voci storiche, ordinate dalla piu' recente. */
  loadHistory(): Promise<MeasurementEntry[]> {
    return this.zoneFix.run((async () => {
      const snap = await getDocs(this.col());
      return snap.docs
        .map(d => d.data() as MeasurementEntry)
        .sort((a, b) => b.date.localeCompare(a.date));
    })());
  }

  saveEntry(entry: MeasurementEntry): Promise<boolean> {
    return this.zoneFix.run((async () => {
      try {
        await setDoc(doc(this.col(), entry.date), entry);
        return true;
      } catch {
        return false;
      }
    })());
  }

  deleteEntry(date: string): Promise<boolean> {
    return this.zoneFix.run((async () => {
      try {
        await deleteDoc(doc(this.col(), date));
        return true;
      } catch {
        return false;
      }
    })());
  }

  /** Per ogni campo, l'ultimo valore registrato nello storico (per i placeholder in form). */
  async getLastValues(): Promise<Partial<Record<MeasurementKey, string>>> {
    const history = await this.loadHistory();
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
  async getPreviousEntry(beforeDate?: string): Promise<MeasurementEntry | null> {
    const history = await this.loadHistory();
    if (!beforeDate) return history[0] ?? null;
    return history.find(e => e.date < beforeDate) ?? null;
  }

  /**
   * Genera un grafico a linea SVG per l'andamento di un campo nel tempo.
   * points: array di {date, value} gia' ordinato dal piu' vecchio al piu' recente.
   */
  buildTrendSVG(points: { date: string; value: number }[]): string {
    const w = 340, h = 180;
    const padL = 40, padR = 14, padT = 18, padB = 26;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;

    const values = points.map(p => p.value);
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (min === max) { min -= 1; max += 1; }
    const range = max - min;

    const coords = points.map((p, i) => ({
      x: padL + (points.length === 1 ? innerW / 2 : innerW * (i / (points.length - 1))),
      y: padT + innerH - innerH * ((p.value - min) / range)
    }));

    const linePts = coords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
    const areaPts = `${padL.toFixed(1)},${(padT + innerH).toFixed(1)} ${linePts} ${(padL + innerW).toFixed(1)},${(padT + innerH).toFixed(1)}`;

    const dots = coords.map((c, i) => {
      const isLast = i === coords.length - 1;
      return `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${isLast ? 4 : 2.5}" fill="${isLast ? 'var(--accent)' : 'var(--label-2)'}" stroke="var(--bg)" stroke-width="1.5"/>`;
    }).join('');

    // Griglia orizzontale: max, meta', min
    const gridYs = [padT, padT + innerH / 2, padT + innerH];
    const gridLabels = [max, (max + min) / 2, min];
    const grid = gridYs.map((gy, i) => `
      <line x1="${padL}" y1="${gy.toFixed(1)}" x2="${padL + innerW}" y2="${gy.toFixed(1)}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
      <text x="${(padL - 8).toFixed(1)}" y="${(gy + 3).toFixed(1)}" text-anchor="end" font-family="IBM Plex Mono, monospace" font-size="9.5" fill="var(--label-3)">${this.formatAxisNum(gridLabels[i])}</text>
    `).join('');

    const firstDate = this.formatShortDate(points[0].date);
    const lastDate = this.formatShortDate(points[points.length - 1].date);
    const xLabels = `
      <text x="${padL}" y="${h - 6}" text-anchor="start" font-family="IBM Plex Mono, monospace" font-size="9.5" fill="var(--label-3)">${firstDate}</text>
      <text x="${padL + innerW}" y="${h - 6}" text-anchor="end" font-family="IBM Plex Mono, monospace" font-size="9.5" fill="var(--label-3)">${lastDate}</text>
    `;

    return `<svg width="100%" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${grid}
      <polygon points="${areaPts}" fill="url(#trendFill)"/>
      <polyline points="${linePts}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}
      ${xLabels}
    </svg>`;
  }

  private formatAxisNum(n: number): string {
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  }

  private formatShortDate(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  }
}
