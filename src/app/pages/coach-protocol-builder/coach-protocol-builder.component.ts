import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProtocolService } from '../../services/protocol.service';
import { WorkoutDataService } from '../../services/workout-data.service';
import { Protocol } from '../../models/protocol.model';
import { Day, Exercise } from '../../models/workout.model';
import { FoodItem, DietPlan, NamedMeal, newDietPlan, newNamedMeal, FoodCategory, FOOD_CATEGORIES, FOOD_CATEGORY_LABELS } from '../../models/diet.model';

type Tab = 'scheda' | 'dieta' | 'info';

@Component({
  selector: 'app-coach-protocol-builder',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './coach-protocol-builder.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class CoachProtocolBuilderComponent implements OnInit {
  clientId = '';
  protocolId = '';
  protocol: Protocol | null = null;
  loading = true;
  saving = false;
  saveMsg = '';

  tab: Tab = 'scheda';
  editingPlan: DietPlan | null = null;
  editingMeal: NamedMeal | null = null;
  editingExercise: { day: Day; ex: Exercise; isNew: boolean } | null = null;

  readonly muscles = ['Petto', 'Spalle', 'Tricipiti', 'Dorso', 'Bicipiti', 'Gambe', 'Core'];
  readonly foodCategories = FOOD_CATEGORIES;
  readonly foodCategoryLabels = FOOD_CATEGORY_LABELS;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private protocolSvc: ProtocolService,
    public workoutData: WorkoutDataService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    this.clientId = this.route.snapshot.paramMap.get('clientId') ?? '';
    this.protocolId = this.route.snapshot.paramMap.get('protocolId') ?? '';
    this.loading = true;
    this.protocol = await this.protocolSvc.get(this.clientId, this.protocolId);
    if (!this.protocol) { this.router.navigate(['/coach/clienti', this.clientId]); return; }
    this.loading = false;
    this.cdr.detectChanges();
  }

  // ===== Scheda =====

  addDay(): void {
    if (!this.protocol) return;
    const n = this.protocol.workout.days.length + 1;
    const day: Day = { id: `day${n}`, label: `Giorno ${n}`, rec: '60-90"', ex: [] };
    this.protocol.workout.days.push(day);
    this.cdr.detectChanges();
  }

  removeDay(i: number): void {
    this.protocol?.workout.days.splice(i, 1);
    this.cdr.detectChanges();
  }

  // --- Editor esercizio (nome, muscolo, schema, progressione settimanale se wave) ---

  addExercise(day: Day): void {
    const ex: Exercise = { name: '', scheme: 'plain', sets: 3, muscle: this.muscles[0], text: '', reps: ['', '', ''] };
    this.editingExercise = { day, ex, isNew: true };
    this.cdr.detectChanges();
  }

  editExercise(day: Day, ex: Exercise): void {
    this.editingExercise = { day, ex, isNew: false };
    this.cdr.detectChanges();
  }

  saveExercise(): void {
    if (!this.editingExercise) return;
    const { day, ex, isNew } = this.editingExercise;
    if (isNew) day.ex.push(ex);
    this.editingExercise = null;
    this.cdr.detectChanges();
  }

  cancelExercise(): void {
    this.editingExercise = null;
    this.cdr.detectChanges();
  }

  removeExerciseFromEditor(): void {
    if (!this.editingExercise) return;
    const { day, ex } = this.editingExercise;
    const idx = day.ex.indexOf(ex);
    if (idx >= 0) day.ex.splice(idx, 1);
    this.editingExercise = null;
    this.cdr.detectChanges();
  }

  onSchemeChange(ex: Exercise): void {
    if (ex.scheme === 'plain' && (!ex.reps || ex.reps.length !== ex.sets)) {
      ex.reps = Array.from({ length: ex.sets }, () => '');
    }
    if (ex.scheme === 'wave' && (!ex.weekPlan || ex.weekPlan.length === 0)) {
      ex.weekPlan = Array.from({ length: 8 }, () => ({ sets: 4, reps: 10 }));
    }
    this.cdr.detectChanges();
  }

  onSetsChange(ex: Exercise): void {
    const sets = Math.max(1, ex.sets || 1);
    ex.sets = sets;
    const reps = ex.reps ? [...ex.reps] : [];
    while (reps.length < sets) reps.push('');
    reps.length = sets;
    ex.reps = reps;
  }

  repsAsString(ex: Exercise): string {
    return (ex.reps ?? []).join(', ');
  }

  setRepsFromString(ex: Exercise, value: string): void {
    ex.reps = value.split(',').map(s => s.trim());
  }

  addExWeek(ex: Exercise): void {
    if (!ex.weekPlan) ex.weekPlan = [];
    ex.weekPlan.push({ sets: 4, reps: 10 });
    this.cdr.detectChanges();
  }

  removeExWeek(ex: Exercise, i: number): void {
    ex.weekPlan?.splice(i, 1);
    this.cdr.detectChanges();
  }

  exerciseSummary(ex: Exercise): string {
    if (ex.scheme === 'wave') {
      const n = ex.weekPlan?.length ?? 0;
      return n > 0 ? `Wave · ${n} settimane` : 'Wave · da configurare';
    }
    return `${ex.sets}×${(ex.reps ?? []).join('-') || '?'}`;
  }

  // ===== Dieta =====

  addDietPlan(): void {
    if (!this.protocol) return;
    try {
      if (!Array.isArray(this.protocol.diet)) this.protocol.diet = [];
      const plan = newDietPlan('Nuova dieta');
      this.protocol.diet.push(plan);
      this.editingPlan = plan;
    } catch (e: any) {
      console.error('Errore aggiunta piano dieta:', e);
      this.saveMsg = 'Errore nell\'aggiungere il piano. Riprova.';
    } finally {
      this.cdr.detectChanges();
    }
  }

  openPlan(plan: DietPlan): void {
    this.editingPlan = plan;
    this.editingMeal = null;
    this.cdr.detectChanges();
  }

  closePlan(): void {
    this.editingPlan = null;
    this.editingMeal = null;
    this.cdr.detectChanges();
  }

  removePlan(plan: DietPlan, event: Event): void {
    event.stopPropagation();
    if (!this.protocol) return;
    this.protocol.diet = this.protocol.diet.filter(p => p.id !== plan.id);
    if (this.editingPlan?.id === plan.id) this.editingPlan = null;
  }

  countPlanItems(plan: DietPlan): number {
    return plan.meals.reduce((acc, meal) => {
      const fromItems = meal.items?.length ?? 0;
      const fromVariants = meal.variants?.reduce((a, v) => a + (v.items?.length ?? 0), 0) ?? 0;
      return acc + fromItems + fromVariants;
    }, 0);
  }

  addMeal(): void {
    if (!this.editingPlan) return;
    const meal = newNamedMeal('Nuovo pasto');
    this.editingPlan.meals.push(meal);
    this.editingMeal = meal;
    this.cdr.detectChanges();
  }

  openMeal(meal: NamedMeal): void {
    this.editingMeal = meal;
    this.cdr.detectChanges();
  }

  closeMeal(): void {
    this.editingMeal = null;
    this.cdr.detectChanges();
  }

  removeMeal(meal: NamedMeal, event: Event): void {
    event.stopPropagation();
    if (!this.editingPlan) return;
    this.editingPlan.meals = this.editingPlan.meals.filter(m => m.id !== meal.id);
    if (this.editingMeal?.id === meal.id) this.editingMeal = null;
    this.cdr.detectChanges();
  }

  removeMealFromEditor(): void {
    if (!this.editingPlan || !this.editingMeal) return;
    this.editingPlan.meals = this.editingPlan.meals.filter(m => m.id !== this.editingMeal!.id);
    this.editingMeal = null;
    this.cdr.detectChanges();
  }

  countMealItems(meal: NamedMeal): number {
    const fromItems = meal.items?.length ?? 0;
    const fromVariants = meal.variants?.reduce((a, v) => a + (v.items?.length ?? 0), 0) ?? 0;
    return fromItems + fromVariants;
  }

  itemsByCategory(meal: NamedMeal, category: FoodCategory): FoodItem[] {
    if (!meal.items) meal.items = [];
    return meal.items.filter(i => (i.category ?? 'carb') === category);
  }

  addItem(meal: NamedMeal, category: FoodCategory): void {
    if (!meal.items) meal.items = [];
    meal.items.push({ name: '', qty: '', category });
  }

  removeItem(meal: NamedMeal, item: FoodItem): void {
    if (!meal.items) return;
    const idx = meal.items.indexOf(item);
    if (idx >= 0) meal.items.splice(idx, 1);
  }

  // ===== Salvataggio =====

  async save(activateAfter: boolean): Promise<void> {
    if (!this.protocol) return;
    this.saving = true;
    this.saveMsg = '';
    try {
      await this.protocolSvc.update(this.clientId, this.protocolId, {
        name: this.protocol.name,
        workout: this.protocol.workout,
        diet: this.protocol.diet,
        infoNote: this.protocol.infoNote
      });
      if (activateAfter) {
        await this.protocolSvc.activate(this.clientId, this.protocolId);
      }
      this.router.navigate(['/coach/clienti', this.clientId]);
    } catch (e: any) {
      console.error('Errore salvataggio protocollo:', e);
      this.saveMsg = e?.message || 'Errore durante il salvataggio.';
    } finally {
      this.saving = false;
    }
  }
}
