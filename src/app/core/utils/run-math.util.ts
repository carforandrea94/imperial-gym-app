/**
 * Conti della corsa. Stanno qui, senza dipendenze da Angular, perche' sono la
 * parte che va verificata a tavolino: il passo e' un numero che chi corre
 * conosce a memoria e sbagliarlo si nota subito.
 */

import { Run } from '../../models/run.model';
import { mondayISO } from './date.util';

/** Secondi per chilometro. 0 quando i dati non bastano a dire qualcosa. */
export function paceSecPerKm(distanceKm: number, durationSec: number): number {
  if (!isFinite(distanceKm) || !isFinite(durationSec)) return 0;
  if (distanceKm <= 0 || durationSec <= 0) return 0;
  return durationSec / distanceKm;
}

/** Passo in `m:ss`, il formato con cui si legge sull'orologio. Stringa vuota se non calcolabile. */
export function formatPace(secPerKm: number): string {
  if (!isFinite(secPerKm) || secPerKm <= 0) return '';
  // Si arrotonda al secondo PRIMA di separare minuti e secondi: arrotondando
  // dopo, 5:59,6 diventerebbe 5:60.
  const total = Math.round(secPerKm);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Durata in `m:ss` sotto l'ora, `h:mm:ss` sopra. */
export function formatDuration(durationSec: number): string {
  if (!isFinite(durationSec) || durationSec <= 0) return '0:00';
  const total = Math.round(durationSec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? m.toString().padStart(2, '0') : m.toString();
  return h > 0 ? `${h}:${mm}:${s.toString().padStart(2, '0')}` : `${mm}:${s.toString().padStart(2, '0')}`;
}

/**
 * Interpreta il tempo digitato a mano, nei modi in cui e' naturale scriverlo:
 * `47:12`, `1:05:30`, oppure i soli minuti (`47`). Restituisce 0 se non si
 * capisce, cosi' chi chiama decide cosa dire all'utente.
 */
export function parseDuration(input: string): number {
  const raw = (input ?? '').trim().replace(/\s/g, '');
  if (!raw) return 0;
  const parts = raw.split(':');
  if (parts.some(p => p === '' || !/^\d+$/.test(p))) return 0;
  const nums = parts.map(p => parseInt(p, 10));
  if (nums.length === 1) return nums[0] * 60;
  if (nums.length === 2) return nums[0] * 60 + nums[1];
  if (nums.length === 3) return nums[0] * 3600 + nums[1] * 60 + nums[2];
  return 0;
}

/** Distanza digitata a mano: accetta sia la virgola sia il punto decimale. */
export function parseDistance(input: string): number {
  const raw = (input ?? '').trim().replace(',', '.');
  if (!/^\d*\.?\d+$/.test(raw)) return 0;
  const n = parseFloat(raw);
  return isFinite(n) && n > 0 ? n : 0;
}

/** Chilometri con una decimale e la virgola, come si scrivono in italiano. */
export function formatKm(km: number): string {
  if (!isFinite(km) || km <= 0) return '0';
  return km.toFixed(1).replace('.', ',');
}

/** Quanto e' stato corso in una settimana, e quanto manca all'obiettivo. */
export interface WeekTotals {
  km: number;
  runs: number;
  durationSec: number;
  /** Passo medio della settimana: tempo totale su distanza totale, non media dei passi. */
  paceSecPerKm: number;
}

/**
 * Somma le uscite che cadono nella settimana di calendario indicata.
 *
 * Il filtro e' sul lunedi' della data, non su un intervallo di giorni contati
 * all'indietro da oggi: cosi' i totali si azzerano la notte fra domenica e
 * lunedi', in un istante solo e uguale per tutti, invece di scivolare di
 * giorno in giorno.
 */
export function weekTotals(runs: readonly Run[], weekMondayISO: string): WeekTotals {
  let km = 0, durationSec = 0, count = 0;
  for (const r of runs) {
    if (!r?.date || mondayISO(r.date) !== weekMondayISO) continue;
    count++;
    km += r.distanceKm > 0 ? r.distanceKm : 0;
    durationSec += r.durationSec > 0 ? r.durationSec : 0;
  }
  return { km, runs: count, durationSec, paceSecPerKm: paceSecPerKm(km, durationSec) };
}

/** Percentuale di completamento di un obiettivo, limitata a 100: la barra non deve straripare. */
export function goalPct(done: number, target: number): number {
  if (!isFinite(target) || target <= 0) return 0;
  return Math.min(100, Math.max(0, (done / target) * 100));
}
