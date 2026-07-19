import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DietDataService } from '../../services/diet-data.service';
import { AppStateService } from '../../services/app-state.service';
import { FoodItem } from '../../models/diet.model';

interface ShoppingItem {
  key: string;
  name: string;
  qtys: string[];
  sources: string[]; // "Nome piano · Pasto"
  checked: boolean;
}

interface CustomShoppingItem {
  id: string;
  name: string;
  checked: boolean;
}

@Component({
  selector: 'app-lista-spesa',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lista-spesa.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class ListaSpesaComponent implements OnInit {
  items: ShoppingItem[] = [];
  customItems: CustomShoppingItem[] = [];
  newItemName = '';
  loading = true;
  errorMsg = '';

  get checkedCount() {
    return this.items.filter(i => i.checked).length + this.customItems.filter(i => i.checked).length;
  }

  constructor(
    private dietData: DietDataService,
    private appState: AppStateService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.errorMsg = '';

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 12000)
    );

    try {
      const appState = await Promise.race([this.appState.load(), timeout]);
      this.buildItems(appState.shoppingChecked ?? {});
      this.customItems = appState.shoppingCustomItems ?? [];
    } catch (e: any) {
      console.error('Errore caricamento lista della spesa:', e);
      this.errorMsg = e?.message === 'TIMEOUT'
        ? 'La connessione sta impiegando troppo tempo. Controlla la rete e riprova.'
        : 'Errore nel caricamento della lista. Riprova.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  private buildItems(checked: Record<string, boolean>): void {
    const map = new Map<string, ShoppingItem>();

    const addFood = (food: FoodItem | null, plan: string, source: string) => {
      if (!food || !food.name) return;
      const key = food.name.trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, { key, name: food.name.trim(), qtys: [], sources: [], checked: !!checked[this.safeKey(key)] });
      }
      const entry = map.get(key)!;
      if (food.qty && !entry.qtys.includes(food.qty)) entry.qtys.push(food.qty);
      if (!entry.sources.includes(source)) entry.sources.push(source);

      // Alternative annidate del singolo alimento (item.alt, es. "Farina d'avena" ->
      // "Farina di riso"), popolate dal coach builder e dall'import PDF: senza questo
      // giro mancavano dalla lista tutte le alternative-per-alimento, distinte dalle
      // alternative-per-macro del pasto (meal.alternatives) gia' incluse sopra.
      (food.alt ?? []).forEach(alt => addFood(alt as FoodItem, plan, `${source} (alternativa)`));
    };

    for (const plan of this.dietData.diet) {
      for (const meal of plan.meals) {
        for (const combo of meal.combinations) {
          const label = meal.combinations.length > 1 ? `${plan.name} · ${meal.name} (${combo.label})` : `${plan.name} · ${meal.name}`;
          addFood(combo.carb, plan.name, label);
          addFood(combo.protein, plan.name, label);
          addFood(combo.fat, plan.name, label);
        }
        (['carb', 'protein', 'fat'] as const).forEach(cat => {
          meal.alternatives[cat].forEach(food => addFood(food, plan.name, `${plan.name} · ${meal.name} (alternativa)`));
        });
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

  addCustomItem(): void {
    const name = this.newItemName.trim();
    if (!name) return;
    this.customItems.push({ id: `${Date.now()}_${Math.floor(Math.random() * 1000)}`, name, checked: false });
    this.newItemName = '';
    this.appState.patch({ shoppingCustomItems: this.customItems });
  }

  toggleCustom(item: CustomShoppingItem): void {
    item.checked = !item.checked;
    this.appState.patch({ shoppingCustomItems: this.customItems });
  }

  removeCustom(item: CustomShoppingItem, event: MouseEvent): void {
    event.stopPropagation();
    this.customItems = this.customItems.filter(i => i.id !== item.id);
    this.appState.patch({ shoppingCustomItems: this.customItems });
  }

  async resetAll(): Promise<void> {
    this.items.forEach(i => { i.checked = false; });
    this.customItems.forEach(i => { i.checked = false; });
    await this.appState.patch({ shoppingChecked: {}, shoppingCustomItems: this.customItems });
  }
}
