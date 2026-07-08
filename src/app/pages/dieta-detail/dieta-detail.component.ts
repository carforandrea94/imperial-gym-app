import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DietDataService } from '../../services/diet-data.service';
import { DietPlan, NamedMeal, MealCombination, FoodItem, FoodCategory, FOOD_CATEGORIES, FOOD_CATEGORY_LABELS } from '../../models/diet.model';

interface MealVM {
  meal: NamedMeal;
  open: boolean;
  selectedComboId: string;
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
      selectedComboId: meal.combinations[0]?.id ?? ''
    }));
  }

  toggleMeal(vm: MealVM): void {
    vm.open = !vm.open;
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
  }

  comboItem(vm: MealVM, cat: FoodCategory): FoodItem | null {
    return this.getActiveCombo(vm)[cat];
  }

  // --- Alternative dell'alimento della combinazione (item.alt) ---
  private itemAltOpen = new Set<string>();

  isItemAltOpen(vm: MealVM, cat: FoodCategory): boolean {
    return this.itemAltOpen.has(`${vm.meal.id}:${vm.selectedComboId}:${cat}`);
  }

  toggleItemAlt(vm: MealVM, cat: FoodCategory): void {
    const key = `${vm.meal.id}:${vm.selectedComboId}:${cat}`;
    if (this.itemAltOpen.has(key)) this.itemAltOpen.delete(key);
    else this.itemAltOpen.add(key);
  }

  // --- Alternative per macro a livello di pasto (accordion separati sotto i tab) ---
  hasAnyMacroAlternatives(vm: MealVM): boolean {
    return this.foodCategories.some(cat => vm.meal.alternatives[cat].length > 0);
  }

  macroAlternatives(vm: MealVM, cat: FoodCategory): FoodItem[] {
    return vm.meal.alternatives[cat];
  }

  private macroAltExpanded = new Set<string>();

  isMacroAltExpanded(vm: MealVM, cat: FoodCategory): boolean {
    return this.macroAltExpanded.has(`${vm.meal.id}:${cat}`);
  }

  toggleMacroAltExpanded(vm: MealVM, cat: FoodCategory): void {
    const key = `${vm.meal.id}:${cat}`;
    if (this.macroAltExpanded.has(key)) this.macroAltExpanded.delete(key);
    else this.macroAltExpanded.add(key);
  }
}
