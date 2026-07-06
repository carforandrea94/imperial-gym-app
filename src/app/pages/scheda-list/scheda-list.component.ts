import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { WorkoutDataService } from '../../services/workout-data.service';
import { WorkoutStateService } from '../../services/workout-state.service';
import { StorageService } from '../../services/storage.service';

@Component({
  selector: 'app-scheda-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scheda-list.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class SchedaListComponent {
  readonly days;
  readonly currentWeek;
  readonly weeks = [1,2,3,4,5,6,7,8];

  constructor(
    public workoutData: WorkoutDataService,
    public state: WorkoutStateService,
    private router: Router,
    private storage: StorageService
  ) {
    this.days = workoutData.days;
    this.currentWeek = state.currentWeek;
  }

  goToDay(idx: number): void {
    this.router.navigate(['/scheda/day', idx]);
  }

  getExCount(idx: number): number {
    return this.days[idx].ex.length;
  }

  hasDraft(dayId: string): boolean {
    return this.storage.get(`draft:${dayId}`) !== null;
  }

  getWaveInfo(): string {
    const wp = this.workoutData.WEEK_PLAN[this.currentWeek - 1];
    return `${wp.sets}×${wp.reps} reps`;
  }
}
