import { Component, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DietDataService } from '../../services/diet-data.service';
import { WorkoutStateService } from '../../services/workout-state.service';
import { DietDay, Meal, FoodItem, MEAL_LABELS } from '../../models/diet.model';

interface MealVM {
  key: string;
  label: string;
  open: boolean;
  selectedVariant: number;
  altOpen: boolean[];
}

@Component({
  selector: 'app-dieta',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dieta.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class DietaComponent implements OnInit {
  readonly mealOrder = ['colazione', 'spuntino', 'pranzo', 'merenda', 'cena'];
  readonly mealLabels = MEAL_LABELS;

  meals: MealVM[] = this.mealOrder.map(key => ({
    key,
    label: MEAL_LABELS[key],
    open: true,
    selectedVariant: 0,
    altOpen: []
  }));

  constructor(
    public dietData: DietDataService,
    public state: WorkoutStateService
  ) {
    this.meals.forEach(vm => {
      vm.altOpen = this.getItems(vm).map(() => true);
    });
  }

  async ngOnInit(): Promise<void> {
    await this.state.loadDietMode();
  }

  get mode() { return this.state.dietMode(); }

  get currentDiet(): DietDay {
    return this.dietData.diet[this.mode];
  }

  getMeal(key: string): Meal {
    return (this.currentDiet as any)[key] as Meal;
  }

  toggleMeal(vm: MealVM): void {
    vm.open = !vm.open;
    if (vm.open) {
      const items = this.getItems(vm);
      vm.altOpen = items.map(() => true);
    }
  }

  get hasAnyFood(): boolean {
    return this.meals.some(vm => this.getItems(vm).length > 0);
  }

  hasVariants(vm: MealVM): boolean {
    return !!(this.getMeal(vm.key)?.variants?.length);
  }

  getItems(vm: MealVM): FoodItem[] {
    const meal = this.getMeal(vm.key);
    if (meal.variants?.length) {
      return meal.variants[vm.selectedVariant]?.items ?? [];
    }
    return meal.items ?? [];
  }

  getVariants(vm: MealVM) {
    return this.getMeal(vm.key)?.variants ?? [];
  }

  selectVariant(vm: MealVM, idx: number): void {
    vm.selectedVariant = idx;
    const items = this.getItems(vm);
    vm.altOpen = items.map(() => true);
  }

  toggleAlt(vm: MealVM, idx: number): void {
    if (!vm.altOpen[idx]) {
      vm.altOpen[idx] = true;
    } else {
      vm.altOpen[idx] = false;
    }
  }

  toggleMode(): void {
    this.state.toggleDietMode();
  }
}
