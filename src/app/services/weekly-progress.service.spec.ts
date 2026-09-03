import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi } from 'vitest';
import { WeeklyProgressService } from './weekly-progress.service';

function makeService(opts: { sessions?: any[]; fallisce?: boolean; week?: number } = {}) {
  const listAll = vi.fn(() => opts.fallisce
    ? Promise.reject(new Error('offline'))
    : Promise.resolve((opts.sessions ?? []).map((session, i) => ({ id: `s${i}`, session }))));
  const sessions = { listAll } as any;
  const state = {
    currentWeek: opts.week ?? 2,
    DEFAULT_PROGRAM_START: '2026-07-06',
    // Stessa formula del servizio reale, gia' coperta dai suoi test.
    weekNumberForDate: (dateISO: string, start: string) => {
      const d = new Date(dateISO + 'T00:00:00').getTime();
      const s = new Date(start + 'T00:00:00').getTime();
      return Math.floor(Math.floor((d - s) / 86400000) / 7) + 1;
    }
  } as any;
  const service = TestBed.runInInjectionContext(() => new WeeklyProgressService(sessions, state));
  return { service, listAll };
}

describe('WeeklyProgressService', () => {
  it('segna solo i giorni allenati nella settimana corrente', async () => {
    const { service } = makeService({
      week: 2,
      sessions: [
        { dayId: 'day1', date: '2026-07-14' },  // settimana 2
        { dayId: 'day3', date: '2026-07-15' },  // settimana 2
        { dayId: 'day2', date: '2026-07-07' }   // settimana 1: non deve comparire
      ]
    });

    await service.refresh();

    expect(service.isDone('day1')).toBe(true);
    expect(service.isDone('day3')).toBe(true);
    expect(service.isDone('day2')).toBe(false);
  });

  it('al cambio di settimana le spunte si azzerano da sole', async () => {
    const sessions = [{ dayId: 'day1', date: '2026-07-14' }];
    const settimana2 = makeService({ week: 2, sessions });
    await settimana2.service.refresh();
    expect(settimana2.service.isDone('day1')).toBe(true);

    // Stesse sedute salvate, ma ora si e' in settimana 3: nessuna spunta.
    const settimana3 = makeService({ week: 3, sessions });
    await settimana3.service.refresh();
    expect(settimana3.service.isDone('day1')).toBe(false);
  });

  it('una lettura fallita non cancella le spunte gia\' note', async () => {
    const { service } = makeService({ week: 2, sessions: [{ dayId: 'day1', date: '2026-07-14' }] });
    await service.refresh();
    expect(service.isDone('day1')).toBe(true);

    // La rilettura fallisce (rete assente, token in rinnovo): il valore resta.
    (service as any).sessions.listAll = () => Promise.reject(new Error('offline'));
    await service.refresh();

    expect(service.isDone('day1')).toBe(true);
  });

  it('lo stesso giorno fatto due volte conta una volta sola', async () => {
    const { service } = makeService({
      week: 2,
      sessions: [{ dayId: 'day1', date: '2026-07-13' }, { dayId: 'day1', date: '2026-07-15' }]
    });

    await service.refresh();

    expect(service.doneDayIds().size).toBe(1);
  });

  it('letture ravvicinate condividono la stessa richiesta', async () => {
    const { service, listAll } = makeService({ week: 2, sessions: [] });

    await Promise.all([service.refresh(), service.refresh(), service.refresh()]);

    expect(listAll).toHaveBeenCalledTimes(1);
  });

  it('ignora le sedute senza data o senza giorno', async () => {
    const { service } = makeService({
      week: 2,
      sessions: [{ dayId: 'day1', date: '' }, { dayId: '', date: '2026-07-14' }, null]
    });

    await service.refresh();

    expect(service.doneDayIds().size).toBe(0);
  });
});
