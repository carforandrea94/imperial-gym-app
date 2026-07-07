import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DietDataService } from '../../services/diet-data.service';
import { WorkoutStateService } from '../../services/workout-state.service';
import { AppStateService } from '../../services/app-state.service';
import { DietDay, MEAL_LABELS } from '../../models/diet.model';

interface ShoppingItem {
  key: string;
  name: string;
  qtys: string[];
  meals: string[];
  checked: boolean;
}

@Component({
  selector: 'app-lista-spesa',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './lista-spesa.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class ListaSpesaComponent implements OnInit {
  items: ShoppingItem[] = [];
  loading = true;

  get mode() { return this.state.dietMode(); }
  get checkedCount() { return this.items.filter(i => i.checked).length; }

  constructor(
    private dietData: DietDataService,
    public state: WorkoutStateService,
    private appState: AppStateService
  ) {}

  async ngOnInit(): Promise<void> {
    this.loading = true;
    await this.state.loadDietMode();
    const appState = await this.appState.load();
    this.buildItems(appState.shoppingChecked ?? {});
    this.loading = false;
  }

  private buildItems(checked: Record<string, boolean>): void {
    const day: DietDay = this.dietData.diet[this.mode];
    const map = new Map<string, ShoppingItem>();

    (Object.keys(MEAL_LABELS) as (keyof DietDay)[]).forEach(mealKey => {
      const meal = day[mealKey];
      const allFoods = [
        ...(meal.items ?? []),
        ...(meal.variants ?? []).flatMap(v => v.items)
      ];
      for (const food of allFoods) {
        if (!food.name) continue;
        const key = food.name.trim().toLowerCase();
        if (!map.has(key)) {
          map.set(key, { key, name: food.name.trim(), qtys: [], meals: [], checked: !!checked[this.safeKey(key)] });
        }
        const entry = map.get(key)!;
        if (food.qty && !entry.qtys.includes(food.qty)) entry.qtys.push(food.qty);
        const mealLabel = MEAL_LABELS[mealKey];
        if (!entry.meals.includes(mealLabel)) entry.meals.push(mealLabel);
      }
    });

    this.items = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  toggle(item: ShoppingItem): void {
    item.checked = !item.checked;
    this.appState.patchField(`shoppingChecked.${this.safeKey(item.key)}`, item.checked);
  }

  private safeKey(key: string): string {
    return key.replace(/[.\[\]\/]/g, '_');
  }

  async resetAll(): Promise<void> {
    this.items.forEach(i => { i.checked = false; });
    await this.appState.patch({ shoppingChecked: {} });
  }
}
