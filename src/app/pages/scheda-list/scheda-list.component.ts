import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { WorkoutDataService } from '../../services/workout-data.service';
import { WorkoutStateService } from '../../services/workout-state.service';
import { AppStateService } from '../../services/app-state.service';
import { WeeklyProgressService } from '../../services/weekly-progress.service';

@Component({
  selector: 'app-scheda-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scheda-list.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class SchedaListComponent implements OnInit {
  readonly days;
  readonly currentWeek;
  readonly weekPlan;
  readonly weeks: number[];

  private draftDayIds = new Set<string>();

  constructor(
    public workoutData: WorkoutDataService,
    public state: WorkoutStateService,
    private router: Router,
    private appState: AppStateService,
    public weekly: WeeklyProgressService
  ) {
    this.days = workoutData.days;
    this.currentWeek = state.currentWeek;
    this.weekPlan = workoutData.WEEK_PLAN;
    this.weeks = Array.from({ length: this.weekPlan.length }, (_, i) => i + 1);
  }

  ngOnInit(): void {
    // Le spunte vivono nel servizio: se la pagina viene ricreata (ritorno sulla
    // scheda, rinnovo del token) quelle gia' calcolate restano a schermo mentre
    // la rilettura e' in corso, invece di sparire e ricomparire.
    this.weekly.refresh();

    this.appState.load()
      .then(state => { this.draftDayIds = new Set(Object.keys(state.workoutDrafts ?? {})); })
      // Le bozze sono contorno: se la lettura fallisce la lista resta usabile.
      .catch(e => console.error('Lettura delle bozze fallita:', e));
  }

  /** true se questo allenamento e' gia' stato fatto in questa settimana. */
  isDoneThisWeek(dayId: string): boolean {
    return this.weekly.isDone(dayId);
  }

  goToDay(idx: number): void {
    this.router.navigate(['/scheda/day', idx]);
  }

  getExCount(idx: number): number {
    return this.days[idx].ex.length;
  }

  hasDraft(dayId: string): boolean {
    return this.draftDayIds.has(dayId);
  }

  getWaveInfo(): string {
    const wp = this.workoutData.WEEK_PLAN[this.currentWeek - 1];
    return `${wp.sets}×${wp.reps} reps`;
  }

  get todayWeekday(): string {
    const raw = new Date().toLocaleDateString('it-IT', { weekday: 'long' });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }
}
