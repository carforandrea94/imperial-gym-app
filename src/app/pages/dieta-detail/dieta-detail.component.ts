import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DietDataService } from '../../services/diet-data.service';
import { DietPlan, NamedMeal, FoodItem, FoodCategory, FOOD_CATEGORIES, FOOD_CATEGORY_LABELS } from '../../models/diet.model';

interface MealVM {
  meal: NamedMeal;
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
  plan: DietPlan | null = null;
  meals: MealVM[] = [];

  readonly foodCategories = FOOD_CATEGORIES;
  readonly foodCategoryLabels = FOOD_CATEGORY_LABELS;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public dietData: DietDataService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('mode') ?? ''; // param storico 'mode', ora contiene l'id del piano
    this.plan = this.dietData.getPlan(id);
    if (!this.plan) { this.router.navigate(['/dieta']); return; }

    this.meals = this.plan.meals.map(meal => ({
      meal,
      open: true,
      selectedVariant: 0,
      altOpen: []
    }));
    this.meals.forEach(vm => {
      vm.altOpen = this.getItems(vm).map(() => true);
    });
  }

  toggleMeal(vm: MealVM): void {
    vm.open = !vm.open;
    if (vm.open) {
      const items = this.getItems(vm);
      vm.altOpen = items.map(() => true);
    }
  }

  hasVariants(vm: MealVM): boolean {
    return !!(vm.meal.variants?.length);
  }

  getItems(vm: MealVM): FoodItem[] {
    if (vm.meal.variants?.length) {
      return vm.meal.variants[vm.selectedVariant]?.items ?? [];
    }
    return vm.meal.items ?? [];
  }

  itemsByCategory(vm: MealVM, category: FoodCategory): FoodItem[] {
    return this.getItems(vm).filter(i => (i.category ?? 'carb') === category);
  }

  getVariants(vm: MealVM) {
    return vm.meal.variants ?? [];
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
