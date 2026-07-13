import { TestBed } from '@angular/core/testing';
import { WorkoutStateService } from './workout-state.service';

describe('WorkoutStateService.weekNumberForDate', () => {
  let service: WorkoutStateService;

  beforeEach(() => {
    const appStateStub = {} as any;
    const authStub = { authReady: () => false, currentUser: () => null } as any;
    service = TestBed.runInInjectionContext(() =>
      new WorkoutStateService(appStateStub, authStub)
    );
  });

  it("restituisce un numero <= 0 per una data precedente all'inizio del programma", () => {
    expect(service.weekNumberForDate('2026-06-28', '2026-07-05')).toBeLessThanOrEqual(0);
  });

  it('restituisce 1 per il giorno esatto di inizio del programma', () => {
    expect(service.weekNumberForDate('2026-07-05', '2026-07-05')).toBe(1);
  });

  it('resta in settimana 1 al settimo giorno dall\'inizio', () => {
    expect(service.weekNumberForDate('2026-07-11', '2026-07-05')).toBe(1);
  });

  it("passa a settimana 2 all'ottavo giorno dall'inizio", () => {
    expect(service.weekNumberForDate('2026-07-12', '2026-07-05')).toBe(2);
  });

  it('non applica alcun clamp superiore oltre la durata pianificata del protocollo', () => {
    expect(service.weekNumberForDate('2026-09-06', '2026-07-05')).toBe(10);
  });
});
