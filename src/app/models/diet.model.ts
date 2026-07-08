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

export interface MealVariant {
  label: string;
  items: FoodItem[];
}

/** Un pasto con nome libero (Colazione, Spuntino, ma anche "Pre-workout", ecc.). */
export interface NamedMeal {
  id: string;
  name: string;
  items?: FoodItem[];
  variants?: MealVariant[];
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

function newMealId(): string {
  return `meal_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

export function newNamedMeal(name: string): NamedMeal {
  return { id: newMealId(), name, items: [] };
}

export function defaultMeals(): NamedMeal[] {
  return DEFAULT_MEAL_NAMES.map(name => newNamedMeal(name));
}

export function newDietPlan(name: string): DietPlan {
  return { id: `diet_${Date.now()}_${Math.floor(Math.random() * 1000)}`, name, meals: defaultMeals() };
}
