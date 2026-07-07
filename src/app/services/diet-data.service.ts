import { Injectable } from '@angular/core';
import { Diet } from '../models/diet.model';

function emptyDietDay() {
  return {
    colazione: { items: [] },
    spuntino: { items: [] },
    pranzo: { items: [] },
    merenda: { items: [] },
    cena: { items: [] }
  };
}

@Injectable({ providedIn: 'root' })
export class DietDataService {

  applyDiet(diet: Diet): void {
    this.diet = diet;
  }

  diet: Diet = {
    on: emptyDietDay(),
    off: emptyDietDay()
  };
}
