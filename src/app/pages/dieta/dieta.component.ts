import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DietDataService } from '../../services/diet-data.service';
import { DietPlan } from '../../models/diet.model';

interface DietPlanCard {
  plan: DietPlan;
  itemCount: number;
}

@Component({
  selector: 'app-dieta',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dieta.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class DietaComponent implements OnInit {
  cards: DietPlanCard[] = [];

  constructor(
    public dietData: DietDataService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.buildCards();
  }

  private countItems(plan: DietPlan): number {
    return plan.meals.reduce((acc, meal) => {
      const inCombos = meal.combinations.reduce((a, c) =>
        a + (c.carb ? 1 : 0) + (c.protein ? 1 : 0) + (c.fat ? 1 : 0), 0);
      const inAlt = (['carb', 'protein', 'fat'] as const).reduce((a, cat) => a + meal.alternatives[cat].length, 0);
      return acc + inCombos + inAlt;
    }, 0);
  }

  private buildCards(): void {
    this.cards = this.dietData.diet.map(plan => ({ plan, itemCount: this.countItems(plan) }));
  }

  get hasAnyDietData(): boolean {
    return this.cards.length > 0;
  }

  openCard(card: DietPlanCard): void {
    this.router.navigate(['/dieta', card.plan.id]);
  }
}
