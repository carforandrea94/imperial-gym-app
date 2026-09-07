import { describe, it, expect } from 'vitest';
import {
  paceSecPerKm, formatPace, formatDuration, parseDuration, parseDistance, formatKm,
  weekTotals, goalPct
} from './run-math.util';
import { Run } from '../../models/run.model';

describe('run-math', () => {
  it('calcola il passo da distanza e tempo', () => {
    // 8,2 km in 47:12 -> 5:45 al km
    expect(formatPace(paceSecPerKm(8.2, 47 * 60 + 12))).toBe('5:45');
    expect(formatPace(paceSecPerKm(10, 50 * 60))).toBe('5:00');
  });

  it('non inventa un passo quando i dati non bastano', () => {
    expect(paceSecPerKm(0, 1800)).toBe(0);
    expect(paceSecPerKm(5, 0)).toBe(0);
    expect(paceSecPerKm(-5, 1800)).toBe(0);
    expect(formatPace(0)).toBe('');
  });

  it('arrotonda al secondo prima di separare minuti e secondi', () => {
    // 5:59,6 non deve diventare 5:60
    expect(formatPace(359.6)).toBe('6:00');
    expect(formatPace(359.4)).toBe('5:59');
  });

  it('mostra la durata con le ore solo quando servono', () => {
    expect(formatDuration(47 * 60 + 12)).toBe('47:12');
    expect(formatDuration(9)).toBe('0:09');
    expect(formatDuration(3930)).toBe('1:05:30');
  });

  it('interpreta il tempo scritto a mano nei modi naturali', () => {
    expect(parseDuration('47:12')).toBe(47 * 60 + 12);
    expect(parseDuration('1:05:30')).toBe(3930);
    expect(parseDuration('47')).toBe(47 * 60);       // solo minuti
    expect(parseDuration(' 47:12 ')).toBe(47 * 60 + 12);
  });

  it('rifiuta un tempo che non si capisce invece di indovinare', () => {
    expect(parseDuration('')).toBe(0);
    expect(parseDuration('abc')).toBe(0);
    expect(parseDuration('47:')).toBe(0);
    expect(parseDuration('1:2:3:4')).toBe(0);
  });

  it('accetta la distanza sia con la virgola sia col punto', () => {
    expect(parseDistance('8,2')).toBe(8.2);
    expect(parseDistance('8.2')).toBe(8.2);
    expect(parseDistance('10')).toBe(10);
    expect(parseDistance('')).toBe(0);
    expect(parseDistance('otto')).toBe(0);
    expect(parseDistance('-3')).toBe(0);
  });

  it('scrive i chilometri come si scrivono in italiano', () => {
    expect(formatKm(8.2)).toBe('8,2');
    expect(formatKm(10)).toBe('10,0');
  });
});

describe('weekTotals', () => {
  const run = (date: string, distanceKm: number, durationSec: number): Run => ({
    date, distanceKm, durationSec, type: 'lento', effort: 'giusta'
  });

  // 2026-09-07 e' un lunedi'; 2026-09-13 la domenica della stessa settimana.
  const SETTIMANA = '2026-09-07';

  it('somma solo le uscite della settimana indicata', () => {
    const totals = weekTotals([
      run('2026-09-07', 8, 2400),
      run('2026-09-10', 5, 1500),
      run('2026-09-06', 10, 3000)   // domenica precedente: fuori
    ], SETTIMANA);

    expect(totals.runs).toBe(2);
    expect(totals.km).toBe(13);
    expect(totals.durationSec).toBe(3900);
  });

  it('la domenica appartiene alla settimana che inizia sei giorni prima', () => {
    const totals = weekTotals([run('2026-09-13', 12, 3600)], SETTIMANA);
    expect(totals.runs).toBe(1);
  });

  it('il lunedi\' successivo apre una settimana nuova: i totali ripartono da zero', () => {
    const totals = weekTotals([run('2026-09-14', 12, 3600)], SETTIMANA);
    expect(totals.runs).toBe(0);
    expect(totals.km).toBe(0);
  });

  it('il passo medio e\' tempo totale su distanza totale, non la media dei passi', () => {
    // 10 km in 50' (5:00/km) + 2 km in 8' (4:00/km): la media dei passi darebbe
    // 4:30, il passo reale e' 58'/12 km = 4:50.
    const totals = weekTotals([
      run('2026-09-07', 10, 3000),
      run('2026-09-09', 2, 480)
    ], SETTIMANA);

    expect(formatPace(totals.paceSecPerKm)).toBe('4:50');
  });

  it('senza uscite non inventa un passo', () => {
    const totals = weekTotals([], SETTIMANA);
    expect(totals.paceSecPerKm).toBe(0);
    expect(formatPace(totals.paceSecPerKm)).toBe('');
  });
});

describe('goalPct', () => {
  it('restituisce la percentuale raggiunta', () => {
    expect(goalPct(15, 30)).toBe(50);
  });

  it('si ferma a 100: superare l\'obiettivo non deve far straripare la barra', () => {
    expect(goalPct(45, 30)).toBe(100);
  });

  it('senza obiettivo non c\'e\' percentuale', () => {
    expect(goalPct(15, 0)).toBe(0);
  });
});
