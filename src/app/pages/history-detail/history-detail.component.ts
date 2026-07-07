import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { WorkoutSessionsService } from '../../services/workout-sessions.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { WorkoutSession } from '../../models/workout.model';
import { WorkoutDataService } from '../../services/workout-data.service';

@Component({
  selector: 'app-history-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './history-detail.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class HistoryDetailComponent implements OnInit {
  session: WorkoutSession | null = null;
  displayDate = '';
  key = '';
  openExercises: boolean[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private sessionsSvc: WorkoutSessionsService,
    private confirm: ConfirmDialogService,
    public workoutData: WorkoutDataService,
    private sanitizer: DomSanitizer
  ) {}

  getMuscleIcon(name: string): SafeHtml {
    const muscle = this.getMuscle(name);
    return this.sanitizer.bypassSecurityTrustHtml(
      this.workoutData.MUSCLE_ICONS[muscle] ?? this.workoutData.MUSCLE_ICONS['Core']
    );
  }

  async ngOnInit(): Promise<void> {
    const rawKey = this.route.snapshot.paramMap.get('key') ?? '';
    this.key = decodeURIComponent(rawKey);
    this.session = await this.sessionsSvc.get(this.key);
    if (this.session) {
      const date = new Date(this.session.date);
      this.displayDate = date.toLocaleDateString('it-IT', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
      this.openExercises = this.session.exercises.map(() => true);
    }
  }

  toggleEx(i: number): void {
    this.openExercises[i] = !this.openExercises[i];
  }

  getMuscleInfo(name: string) {
    const day = this.workoutData.days.find(d => d.id === this.session?.dayId);
    const ex = day?.ex.find(e => e.name === name);
    if (!ex) return { color: '#64D2FF', dim: 'rgba(100,210,255,0.16)' };
    return this.workoutData.MUSCLES[ex.muscle] ?? { color: '#64D2FF', dim: 'rgba(100,210,255,0.16)' };
  }

  getMuscle(name: string): string {
    const day = this.workoutData.days.find(d => d.id === this.session?.dayId);
    return day?.ex.find(e => e.name === name)?.muscle ?? '';
  }

  async deleteSession(): Promise<void> {
    const ok = await this.confirm.confirm('Eliminare questa seduta dallo storico?');
    if (ok) {
      await this.sessionsSvc.delete(this.key);
      this.router.navigate(['/scheda/storico']);
    }
  }

  getDoneCount(sets: { done: boolean }[]): number {
    return sets.filter(s => s.done).length;
  }
}
