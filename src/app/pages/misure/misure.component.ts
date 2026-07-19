import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MeasureCategory, CATEGORY_LABELS, CATEGORY_UNIT_BADGE } from '../../models/measurement.model';

interface CategoryTile {
  id: MeasureCategory;
  label: string;
  badge: string;
}

@Component({
  selector: 'app-misure',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './misure.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class MisureComponent {
  categories: CategoryTile[] = (['peso', 'centimetri', 'pliche'] as MeasureCategory[]).map(id => ({
    id,
    label: CATEGORY_LABELS[id],
    badge: CATEGORY_UNIT_BADGE[id]
  }));

  constructor(private router: Router) {}

  goTo(id: MeasureCategory): void {
    this.router.navigate(['/misure', id]);
  }

  goToProgressi(): void {
    this.router.navigate(['/misure/progressi']);
  }
}
