import { describe, it, expect } from 'vitest';
import { findCurrentMealIndex } from './meal-time.util';
import { NamedMeal, newNamedMeal } from '../../models/diet.model';

function mealsWithNames(names: string[]): NamedMeal[] {
  return names.map(n => newNamedMeal(n));
}

describe('findCurrentMealIndex', () => {
  it('alle 08:00 sceglie il pasto che contiene "colazione"', () => {
    const meals = mealsWithNames(['Colazione', 'Pranzo', 'Cena']);
    const now = new Date(2026, 0, 1, 8, 0);
    expect(findCurrentMealIndex(meals, now)).toBe(0);
  });

  it('alle 13:00 sceglie il pasto che contiene "pranzo"', () => {
    const meals = mealsWithNames(['Colazione', 'Pranzo', 'Cena']);
    const now = new Date(2026, 0, 1, 13, 0);
    expect(findCurrentMealIndex(meals, now)).toBe(1);
  });

  it('alle 02:00 (dopo mezzanotte) sceglie il pasto che contiene "cena"', () => {
    const meals = mealsWithNames(['Colazione', 'Pranzo', 'Cena']);
    const now = new Date(2026, 0, 1, 2, 0);
    expect(findCurrentMealIndex(meals, now)).toBe(2);
  });

  it('riconosce la parola chiave anche come sottostringa del nome', () => {
    const meals = mealsWithNames(['Colazione dolce', 'Pranzo leggero']);
    const now = new Date(2026, 0, 1, 8, 0);
    expect(findCurrentMealIndex(meals, now)).toBe(0);
  });

  it('se nessun pasto ha un nome riconosciuto, restituisce 0', () => {
    const meals = mealsWithNames(['Pre-workout', 'Post-workout']);
    const now = new Date(2026, 0, 1, 8, 0);
    expect(findCurrentMealIndex(meals, now)).toBe(0);
  });

  it('con nessun pasto restituisce 0 senza lanciare errori', () => {
    const now = new Date(2026, 0, 1, 8, 0);
    expect(findCurrentMealIndex([], now)).toBe(0);
  });

  it('alle 18:00 sceglie il pasto che contiene "merenda"', () => {
    const meals = mealsWithNames(['Merenda', 'Cena']);
    const now = new Date(2026, 0, 1, 18, 0);
    expect(findCurrentMealIndex(meals, now)).toBe(0);
  });

  it('alle 11:00 sceglie il pasto che contiene "spuntino"', () => {
    const meals = mealsWithNames(['Colazione', 'Spuntino', 'Pranzo']);
    const now = new Date(2026, 0, 1, 11, 0);
    expect(findCurrentMealIndex(meals, now)).toBe(1);
  });
});
