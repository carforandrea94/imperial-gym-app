import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { WorkoutDataService } from '../../services/workout-data.service';
import { WorkoutStateService } from '../../services/workout-state.service';
import { AppStateService } from '../../services/app-state.service';

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
    private appState: AppStateService
  ) {
    this.days = workoutData.days;
    this.currentWeek = state.currentWeek;
    this.weekPlan = workoutData.WEEK_PLAN;
    this.weeks = Array.from({ length: this.weekPlan.length }, (_, i) => i + 1);
  }

  async ngOnInit(): Promise<void> {
    const s = await this.appState.load();
    this.draftDayIds = new Set(Object.keys(s.workoutDrafts ?? {}));
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
}
