import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { WorkoutSessionsService } from '../../services/workout-sessions.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { WorkoutSession } from '../../models/workout.model';
import { WorkoutDataService } from '../../services/workout-data.service';
import { todayLocalISO } from '../../core/utils/date.util';

@Component({
  selector: 'app-history-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './history-detail.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class HistoryDetailComponent implements OnInit, OnDestroy {
  session: WorkoutSession | null = null;
  displayDate = '';
  key = '';
  openExercises: boolean[] = [];
  loading = true;
  errorMsg = '';

  editMode = false;
  editSession: WorkoutSession | null = null;
  editDate = '';
  maxDate = todayLocalISO();

  private paramSub: Subscription | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private sessionsSvc: WorkoutSessionsService,
    private confirm: ConfirmDialogService,
    public workoutData: WorkoutDataService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) {}

  getMuscleIcon(name: string): SafeHtml {
    const muscle = this.getMuscle(name);
    return this.sanitizer.bypassSecurityTrustHtml(
      this.workoutData.MUSCLE_ICONS[muscle] ?? this.workoutData.MUSCLE_ICONS['Core']
    );
  }

  ngOnInit(): void {
    this.paramSub = this.route.paramMap.subscribe(params => {
      const rawKey = params.get('key') ?? '';
      this.key = decodeURIComponent(rawKey);
      this.editMode = false;
      this.editSession = null;
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.paramSub?.unsubscribe();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.errorMsg = '';

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 12000)
    );

    try {
      this.session = await Promise.race([this.sessionsSvc.get(this.key), timeout]);
      if (this.session) {
        this.setDisplayDate(this.session.date);
        this.openExercises = this.session.exercises.map(() => true);
      }
    } catch (e: any) {
      console.error('Errore caricamento seduta:', e);
      this.errorMsg = e?.message === 'TIMEOUT'
        ? 'La connessione sta impiegando troppo tempo. Controlla la rete e riprova.'
        : 'Errore nel caricamento della seduta. Riprova.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  private setDisplayDate(isoDate: string): void {
    const date = new Date(isoDate + 'T00:00:00');
    this.displayDate = date.toLocaleDateString('it-IT', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
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
    const confirmed = await this.confirm.confirm('Eliminare questa seduta dallo storico?');
    if (!confirmed) return;
    const ok = await this.sessionsSvc.delete(this.key);
    if (ok) {
      this.router.navigate(['/scheda/storico']);
    } else {
      this.errorMsg = 'Errore durante l\'eliminazione. Riprova.';
      this.cdr.detectChanges();
    }
  }

  getDoneCount(sets: { done: boolean }[]): number {
    return sets.filter(s => s.done).length;
  }

  enterEditMode(): void {
    if (!this.session) return;
    this.editSession = structuredClone(this.session);
    this.editDate = this.session.date;
    this.errorMsg = '';
    this.editMode = true;
  }

  cancelEdit(): void {
    this.editSession = null;
    this.editMode = false;
    this.errorMsg = '';
  }

  getEditSet(exIdx: number, setIdx: number): { load: string | null; reps: string | null; done: boolean } {
    return this.editSession!.exercises[exIdx].sets[setIdx];
  }

  toggleSetDone(exIdx: number, setIdx: number): void {
    const s = this.getEditSet(exIdx, setIdx);
    s.done = !s.done;
  }

  async saveEdit(): Promise<void> {
    if (!this.editSession) return;
    this.errorMsg = '';

    const result = await this.sessionsSvc.moveSession(this.editSession, this.key, this.editDate);

    if (result === 'ok') {
      const newId = this.sessionsSvc.sessionId(this.editSession.dayId, this.editDate);
      if (newId !== this.key) {
        this.router.navigate(['/scheda/storico', encodeURIComponent(newId)]);
        return;
      }
      this.session = this.editSession;
      this.setDisplayDate(this.session.date);
      this.editSession = null;
      this.editMode = false;
      this.cdr.detectChanges();
    } else if (result === 'collision') {
      this.errorMsg = 'Esiste gia\' una seduta per questo giorno di allenamento in questa data.';
      this.cdr.detectChanges();
    } else {
      this.errorMsg = 'Errore durante il salvataggio. Riprova.';
      this.cdr.detectChanges();
    }
  }
}
