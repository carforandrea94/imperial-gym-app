import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkoutStateService } from '../../services/workout-state.service';
import { WorkoutDataService } from '../../services/workout-data.service';

@Component({
  selector: 'app-scheda-info',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scheda-info.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class SchedaInfoComponent {
  readonly currentWeek;
  readonly weekPlan;

  constructor(
    public state: WorkoutStateService,
    public workoutData: WorkoutDataService
  ) {
    this.currentWeek = state.currentWeek;
    this.weekPlan = workoutData.WEEK_PLAN;
  }
}
