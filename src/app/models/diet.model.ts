export type FoodCategory = 'carb' | 'protein' | 'fat';

export interface FoodItem {
  name: string;
  qty: string;
  category?: FoodCategory;
  alt?: { name: string; qty: string }[];
}

export const FOOD_CATEGORY_LABELS: Record<FoodCategory, string> = {
  carb: 'Carboidrati',
  protein: 'Proteine',
  fat: 'Grassi'
};

export const FOOD_CATEGORIES: FoodCategory[] = ['carb', 'protein', 'fat'];

/** Una combinazione di carbo+proteine+grassi per un pasto (es. "Opzione 1", "Combo pollo e riso"). */
export interface MealCombination {
  id: string;
  label: string;
  items: FoodItem[];
}

/** Un pasto con nome libero (Colazione, Spuntino, ma anche "Pre-workout", ecc.).
 *  Ha sempre almeno una combinazione; se ce n'e' piu' di una vengono mostrate come tab. */
export interface NamedMeal {
  id: string;
  name: string;
  combinations: MealCombination[];
}

/** Un piano dieta con nome libero (es. "Giorno ON", "Giorno OFF", "Rifeed", "Vacanza"...). */
export interface DietPlan {
  id: string;
  name: string;
  meals: NamedMeal[];
}

/** Il protocollo puo' contenere piu' diete, non piu' fisse a due (ON/OFF). */
export type Diet = DietPlan[];

export const DEFAULT_MEAL_NAMES = ['Colazione', 'Spuntino', 'Pranzo', 'Merenda', 'Cena'];

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

export function newCombination(label: string): MealCombination {
  return { id: newId('combo'), label, items: [] };
}

export function newNamedMeal(name: string): NamedMeal {
  return { id: newId('meal'), name, combinations: [newCombination('Base')] };
}

export function defaultMeals(): NamedMeal[] {
  return DEFAULT_MEAL_NAMES.map(name => newNamedMeal(name));
}

export function newDietPlan(name: string): DietPlan {
  return { id: newId('diet'), name, meals: defaultMeals() };
}
