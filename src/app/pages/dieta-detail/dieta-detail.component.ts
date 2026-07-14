import { Component, OnInit, ChangeDetectorRef, ElementRef, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DietDataService } from '../../services/diet-data.service';
import { DietStateService } from '../../services/diet-state.service';
import { findClosestSlideIndex, scrollToSlide } from '../../core/utils/horizontal-slider.util';
import { findCurrentMealIndex } from '../../core/utils/meal-time.util';
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

  sliderIndex = 0;
  private scrollTicking = false;

  @ViewChild('sliderEl') sliderEl?: ElementRef<HTMLDivElement>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public dietData: DietDataService,
    public state: DietStateService,
    private cdr: ChangeDetectorRef
  ) {
    // Il toggle vive nella navbar (fuori da questa pagina): quando si passa
    // a "slider" da un'altra vista/pagina, parte dal pasto della fascia
    // oraria corrente (findCurrentMealIndex), non sempre dalla prima card.
    effect(() => {
      if (this.state.viewMode() === 'slider') {
        this.sliderIndex = findCurrentMealIndex(this.plan?.meals ?? []);
        setTimeout(() => this.scrollToIndex(this.sliderIndex), 0);
      }
    });
  }

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

  // --- Alternative per macro a livello di pasto (un unico accordion 'Alternative') ---
  totalAlternatives(vm: MealVM): number {
    return this.foodCategories.reduce((acc, cat) => acc + vm.meal.alternatives[cat].length, 0);
  }

  macroAlternatives(vm: MealVM, cat: FoodCategory): FoodItem[] {
    return vm.meal.alternatives[cat];
  }

  private macroAltExpanded = new Set<string>();

  isMacroAltExpanded(vm: MealVM): boolean {
    return this.macroAltExpanded.has(vm.meal.id);
  }

  toggleMacroAltExpanded(vm: MealVM): void {
    if (this.macroAltExpanded.has(vm.meal.id)) this.macroAltExpanded.delete(vm.meal.id);
    else this.macroAltExpanded.add(vm.meal.id);
  }

  onSliderScroll(): void {
    if (this.scrollTicking) return;
    this.scrollTicking = true;
    requestAnimationFrame(() => {
      this.scrollTicking = false;
      const el = this.sliderEl?.nativeElement;
      if (!el) return;
      const closest = findClosestSlideIndex(el);
      if (closest !== this.sliderIndex) {
        this.sliderIndex = closest;
        this.cdr.detectChanges();
      }
    });
  }

  scrollToIndex(idx: number): void {
    scrollToSlide(this.sliderEl?.nativeElement, idx);
  }
}
