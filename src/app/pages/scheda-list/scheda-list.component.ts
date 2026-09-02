import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { WorkoutDataService } from '../../services/workout-data.service';
import { WorkoutStateService } from '../../services/workout-state.service';
import { AppStateService } from '../../services/app-state.service';
import { WorkoutSessionsService } from '../../services/workout-sessions.service';

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
  /** Giorni gia' allenati nella settimana di protocollo corrente. */
  private doneDayIds = new Set<string>();

  constructor(
    public workoutData: WorkoutDataService,
    public state: WorkoutStateService,
    private router: Router,
    private appState: AppStateService,
    private sessions: WorkoutSessionsService
  ) {
    this.days = workoutData.days;
    this.currentWeek = state.currentWeek;
    this.weekPlan = workoutData.WEEK_PLAN;
    this.weeks = Array.from({ length: this.weekPlan.length }, (_, i) => i + 1);
  }

  async ngOnInit(): Promise<void> {
    try {
      const [state, saved] = await Promise.all([this.appState.load(), this.sessions.listAll()]);
      this.draftDayIds = new Set(Object.keys(state.workoutDrafts ?? {}));
      this.doneDayIds = this.doneThisWeek(saved.map(s => s.session));
    } catch (e) {
      // Bozze e spunte sono contorno: se la lettura fallisce la lista degli
      // allenamenti resta comunque utilizzabile, senza decorazioni.
      console.error('Lettura di bozze e sedute fallita:', e);
    }
  }

  /**
   * Giorni con almeno una seduta salvata nella settimana di protocollo in corso.
   *
   * La spunta e' DERIVATA dalla data delle sedute, non memorizzata da nessuna
   * parte: al passare della settimana cambia il numero di riferimento e le
   * spunte si azzerano da sole, senza niente da resettare e senza rischio che
   * uno stato salvato resti indietro rispetto al calendario.
   */
  private doneThisWeek(sessions: { dayId: string; date: string }[]): Set<string> {
    const start = this.state.DEFAULT_PROGRAM_START;
    const done = new Set<string>();
    for (const s of sessions) {
      if (!s.date || !s.dayId) continue;
      if (this.state.weekNumberForDate(s.date, start) === this.currentWeek) done.add(s.dayId);
    }
    return done;
  }

  /** true se questo allenamento e' gia' stato fatto in questa settimana. */
  isDoneThisWeek(dayId: string): boolean {
    return this.doneDayIds.has(dayId);
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
