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

export interface DietDay {
  colazione: Meal;
  spuntino: Meal;
  pranzo: Meal;
  merenda: Meal;
  cena: Meal;
}

export interface Diet {
  on: DietDay;
  off: DietDay;
}

export type DietMode = 'on' | 'off';

export const MEAL_LABELS: Record<string, string> = {
  colazione: 'Colazione',
  spuntino: 'Spuntino',
  pranzo: 'Pranzo',
  merenda: 'Merenda',
  cena: 'Cena'
};
