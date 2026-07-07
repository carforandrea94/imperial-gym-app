import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DietDataService } from '../../services/diet-data.service';
import { WorkoutStateService } from '../../services/workout-state.service';
import { DietDay, Meal, MEAL_LABELS, DietMode } from '../../models/diet.model';

interface DietModeCard {
  mode: DietMode;
  label: string;
  sub: string;
  itemCount: number;
  hasData: boolean;
}

@Component({
  selector: 'app-dieta',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dieta.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class DietaComponent implements OnInit {
  cards: DietModeCard[] = [];

  constructor(
    public dietData: DietDataService,
    public state: WorkoutStateService,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    await this.state.loadDietMode();
    this.buildCards();
  }

  private countItems(day: DietDay): number {
    return (Object.keys(MEAL_LABELS) as (keyof DietDay)[]).reduce((acc, key) => {
      const meal: Meal = day[key];
      const fromItems = meal.items?.length ?? 0;
      const fromVariants = meal.variants?.reduce((a, v) => a + (v.items?.length ?? 0), 0) ?? 0;
      return acc + fromItems + fromVariants;
    }, 0);
  }

  private buildCards(): void {
    const onCount = this.countItems(this.dietData.diet.on);
    const offCount = this.countItems(this.dietData.diet.off);
    this.cards = [
      { mode: 'on', label: 'Giorno ON', sub: 'Giorno di allenamento', itemCount: onCount, hasData: onCount > 0 },
      { mode: 'off', label: 'Giorno OFF', sub: 'Giorno di riposo', itemCount: offCount, hasData: offCount > 0 }
    ];
  }

  get hasAnyDietData(): boolean {
    return this.cards.some(c => c.hasData);
  }

  openCard(card: DietModeCard): void {
    if (!card.hasData) return;
    this.router.navigate(['/dieta', card.mode]);
  }
}
