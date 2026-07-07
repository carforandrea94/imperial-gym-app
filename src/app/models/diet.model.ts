export interface FoodItem {
  name: string;
  qty: string;
  alt?: { name: string; qty: string }[];
}

export interface MealVariant {
  label: string;
  items: FoodItem[];
}

export interface Meal {
  items?: FoodItem[];
  variants?: MealVariant[];
}

export interface DietMeals {
  colazione: Meal;
  spuntino: Meal;
  pranzo: Meal;
  merenda: Meal;
  cena: Meal;
}

/** Un piano dieta con nome libero (es. "Giorno ON", "Giorno OFF", "Rifeed", "Vacanza"...). */
export interface DietPlan extends DietMeals {
  id: string;
  name: string;
}

/** Il protocollo puo' contenere piu' diete, non piu' fisse a due (ON/OFF). */
export type Diet = DietPlan[];

export const MEAL_LABELS: Record<string, string> = {
  colazione: 'Colazione',
  spuntino: 'Spuntino',
  pranzo: 'Pranzo',
  merenda: 'Merenda',
  cena: 'Cena'
};

export function emptyMeals(): DietMeals {
  return {
    colazione: { items: [] },
    spuntino: { items: [] },
    pranzo: { items: [] },
    merenda: { items: [] },
    cena: { items: [] }
  };
}

export function newDietPlan(name: string): DietPlan {
  return { id: `diet_${Date.now()}_${Math.floor(Math.random() * 1000)}`, name, ...emptyMeals() };
}
