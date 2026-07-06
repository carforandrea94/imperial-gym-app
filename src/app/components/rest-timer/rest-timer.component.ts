import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkoutStateService } from '../../services/workout-state.service';

@Component({
  selector: 'app-rest-timer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="resttimer" [class.show]="svc.restTimer().show" [class.finished]="svc.restTimer().finished">
      <div class="resttimer-fill" [style.width.%]="svc.restTimer().fillPct"></div>
      <div class="resttimer-content">
        <span class="resttimer-label">
          {{ svc.restTimer().finished ? 'Recupero finito — vai!' : 'Recupero' }}
        </span>
        <span class="resttimer-time">
          {{ svc.restTimer().finished ? '✓' : formatTime(svc.restTimer().remaining) }}
        </span>
        <button class="resttimer-close" (click)="stop()">✕</button>
      </div>
    </div>
  `
})
export class RestTimerComponent {
  constructor(public svc: WorkoutStateService) {}

  stop(): void {
    this.svc.stopRestTimer();
  }

  formatTime(s: number): string {
    return this.svc.formatTime(s);
  }
}
