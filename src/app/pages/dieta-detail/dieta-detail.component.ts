import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DietDataService } from '../../services/diet-data.service';
import { DietDay, Meal, FoodItem, MEAL_LABELS, DietMode } from '../../models/diet.model';

interface MealVM {
  key: string;
  label: string;
  open: boolean;
  selectedVariant: number;
  altOpen: boolean[];
}

@Component({
  selector: 'app-dieta-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dieta-detail.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class DietaDetailComponent implements OnInit {
  readonly mealOrder = ['colazione', 'spuntino', 'pranzo', 'merenda', 'cena'];
  readonly mealLabels = MEAL_LABELS;

  mode: DietMode = 'on';
  meals: MealVM[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public dietData: DietDataService
  ) {}

  ngOnInit(): void {
    const m = this.route.snapshot.paramMap.get('mode');
    if (m !== 'on' && m !== 'off') { this.router.navigate(['/dieta']); return; }
    this.mode = m;

    this.meals = this.mealOrder.map(key => ({
      key,
      label: MEAL_LABELS[key],
      open: true,
      selectedVariant: 0,
      altOpen: []
    }));
    this.meals.forEach(vm => {
      vm.altOpen = this.getItems(vm).map(() => true);
    });

    if (this.meals.every(vm => this.getItems(vm).length === 0)) {
      // nessun alimento per questa modalita': torna alla lista
      this.router.navigate(['/dieta']);
    }
  }

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
    vm.altOpen[idx] = !vm.altOpen[idx];
  }
}
