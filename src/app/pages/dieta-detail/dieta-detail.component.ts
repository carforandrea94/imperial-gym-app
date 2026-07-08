import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DietDataService } from '../../services/diet-data.service';
import { DietPlan, NamedMeal, MealCombination, FoodItem, FoodCategory, FOOD_CATEGORIES, FOOD_CATEGORY_LABELS } from '../../models/diet.model';

interface MealVM {
  meal: NamedMeal;
  open: boolean;
  selectedComboId: string;
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
      selectedComboId: meal.combinations[0]?.id ?? '',
      altOpen: []
    }));
    this.meals.forEach(vm => {
      vm.altOpen = this.getItems(vm).map(() => true);
    });
  }

  toggleMeal(vm: MealVM): void {
    vm.open = !vm.open;
    if (vm.open) {
      vm.altOpen = this.getItems(vm).map(() => true);
    }
  }

  hasMultipleCombinations(vm: MealVM): boolean {
    return vm.meal.combinations.length > 1;
  }

  getCombinations(vm: MealVM): MealCombination[] {
    return vm.meal.combinations;
  }

  getActiveCombo(vm: MealVM): MealCombination {
    return vm.meal.combinations.find(c => c.id === vm.selectedComboId) ?? vm.meal.combinations[0];
  }

  selectCombo(vm: MealVM, combo: MealCombination): void {
    vm.selectedComboId = combo.id;
    vm.altOpen = this.getItems(vm).map(() => true);
  }

  getItems(vm: MealVM): FoodItem[] {
    return this.getActiveCombo(vm)?.items ?? [];
  }

  itemsByCategory(vm: MealVM, category: FoodCategory): FoodItem[] {
    return this.getItems(vm).filter(i => (i.category ?? 'carb') === category);
  }

  firstItem(vm: MealVM, cat: FoodCategory): FoodItem | null {
    return this.itemsByCategory(vm, cat)[0] ?? null;
  }

  restItems(vm: MealVM, cat: FoodCategory): FoodItem[] {
    return this.itemsByCategory(vm, cat).slice(1);
  }

  private expandedCats = new Set<string>();

  isCatExpanded(vm: MealVM, cat: FoodCategory): boolean {
    return this.expandedCats.has(`${vm.meal.id}:${vm.selectedComboId}:${cat}`);
  }

  toggleCatExpanded(vm: MealVM, cat: FoodCategory): void {
    const key = `${vm.meal.id}:${vm.selectedComboId}:${cat}`;
    if (this.expandedCats.has(key)) this.expandedCats.delete(key);
    else this.expandedCats.add(key);
  }

  toggleAlt(vm: MealVM, idx: number): void {
    vm.altOpen[idx] = !vm.altOpen[idx];
  }
}
