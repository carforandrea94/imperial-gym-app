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
      const fromItems = meal.items?.length ?? 0;
      const fromVariants = meal.variants?.reduce((a, v) => a + (v.items?.length ?? 0), 0) ?? 0;
      return acc + fromItems + fromVariants;
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
