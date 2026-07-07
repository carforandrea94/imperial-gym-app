import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProtocolService } from '../../services/protocol.service';
import { WorkoutDataService } from '../../services/workout-data.service';
import { Protocol } from '../../models/protocol.model';
import { Day, Exercise } from '../../models/workout.model';
import { DietDay, Meal, FoodItem, MEAL_LABELS } from '../../models/diet.model';

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
  dietMode: 'on' | 'off' = 'on';

  readonly mealOrder = ['colazione', 'spuntino', 'pranzo', 'merenda', 'cena'] as const;
  readonly mealLabels = MEAL_LABELS;
  readonly muscles = ['Petto', 'Spalle', 'Tricipiti', 'Dorso', 'Bicipiti', 'Gambe', 'Core'];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private protocolSvc: ProtocolService,
    public workoutData: WorkoutDataService
  ) {}

  async ngOnInit(): Promise<void> {
    this.clientId = this.route.snapshot.paramMap.get('clientId') ?? '';
    this.protocolId = this.route.snapshot.paramMap.get('protocolId') ?? '';
    this.loading = true;
    this.protocol = await this.protocolSvc.get(this.clientId, this.protocolId);
    if (!this.protocol) { this.router.navigate(['/coach/clienti', this.clientId]); return; }
    this.loading = false;
  }

  // ===== Scheda =====

  addDay(): void {
    if (!this.protocol) return;
    const n = this.protocol.workout.days.length + 1;
    const day: Day = { id: `day${n}`, label: `Giorno ${n}`, rec: '60-90"', ex: [] };
    this.protocol.workout.days.push(day);
  }

  removeDay(i: number): void {
    this.protocol?.workout.days.splice(i, 1);
  }

  addExercise(day: Day): void {
    const ex: Exercise = { name: '', scheme: 'plain', sets: 3, muscle: this.muscles[0], text: '', reps: ['', '', ''] };
    day.ex.push(ex);
  }

  removeExercise(day: Day, i: number): void {
    day.ex.splice(i, 1);
  }

  onSchemeChange(ex: Exercise): void {
    if (ex.scheme === 'plain' && (!ex.reps || ex.reps.length !== ex.sets)) {
      ex.reps = Array.from({ length: ex.sets }, () => '');
    }
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

  addWeek(): void {
    this.protocol?.workout.weekPlan.push({ sets: 4, reps: 10 });
  }

  removeWeek(i: number): void {
    this.protocol?.workout.weekPlan.splice(i, 1);
  }

  // ===== Dieta =====

  getMeal(key: string): Meal {
    const day: DietDay = this.protocol!.diet[this.dietMode];
    return (day as any)[key] as Meal;
  }

  addItem(key: string): void {
    const meal = this.getMeal(key);
    if (!meal.items) meal.items = [];
    meal.items.push({ name: '', qty: '' });
  }

  removeItem(key: string, i: number): void {
    this.getMeal(key).items?.splice(i, 1);
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
