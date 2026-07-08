import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DietDataService } from '../../services/diet-data.service';
import { AppStateService } from '../../services/app-state.service';

interface ShoppingItem {
  key: string;
  name: string;
  qtys: string[];
  sources: string[]; // "Nome piano · Pasto"
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

  get checkedCount() { return this.items.filter(i => i.checked).length; }

  constructor(
    private dietData: DietDataService,
    private appState: AppStateService
  ) {}

  async ngOnInit(): Promise<void> {
    this.loading = true;
    const appState = await this.appState.load();
    this.buildItems(appState.shoppingChecked ?? {});
    this.loading = false;
  }

  private buildItems(checked: Record<string, boolean>): void {
    const map = new Map<string, ShoppingItem>();

    for (const plan of this.dietData.diet) {
      for (const meal of plan.meals) {
        for (const combo of meal.combinations) {
          for (const food of combo.items ?? []) {
            if (!food.name) continue;
            const key = food.name.trim().toLowerCase();
            if (!map.has(key)) {
              map.set(key, { key, name: food.name.trim(), qtys: [], sources: [], checked: !!checked[this.safeKey(key)] });
            }
            const entry = map.get(key)!;
            if (food.qty && !entry.qtys.includes(food.qty)) entry.qtys.push(food.qty);
            const source = `${plan.name} · ${meal.name}`;
            if (!entry.sources.includes(source)) entry.sources.push(source);
          }
        }
      }
    }

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
