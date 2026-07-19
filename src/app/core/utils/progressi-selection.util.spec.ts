import { describe, it, expect } from 'vitest';
import { toggleSelection } from './progressi-selection.util';

describe('toggleSelection', () => {
  it('aggiunge una data se la selezione è vuota', () => {
    expect(toggleSelection([], '2026-07-10')).toEqual(['2026-07-10']);
  });

  it('aggiunge una seconda data', () => {
    expect(toggleSelection(['2026-07-10'], '2026-07-15')).toEqual(['2026-07-10', '2026-07-15']);
  });

  it('deseleziona una data già selezionata', () => {
    expect(toggleSelection(['2026-07-10', '2026-07-15'], '2026-07-10')).toEqual(['2026-07-15']);
  });

  it('con 2 già selezionate, scarta la meno recente e aggiunge la nuova', () => {
    expect(toggleSelection(['2026-07-10', '2026-07-15'], '2026-07-20')).toEqual(['2026-07-15', '2026-07-20']);
  });

  it('scarta la meno recente indipendentemente dall\'ordine nell\'array', () => {
    expect(toggleSelection(['2026-07-15', '2026-07-10'], '2026-07-20')).toEqual(['2026-07-15', '2026-07-20']);
  });
});
