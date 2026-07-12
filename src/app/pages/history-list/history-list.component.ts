import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { WorkoutSessionsService } from '../../services/workout-sessions.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { WorkoutSession } from '../../models/workout.model';

interface SessionEntry {
  key: string;
  session: WorkoutSession;
  displayDate: string;
  completedSets: number;
}

@Component({
  selector: 'app-history-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './history-list.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class HistoryListComponent implements OnInit {
  sessions: SessionEntry[] = [];
  loading = true;
  errorMsg = '';

  constructor(
    private sessionsSvc: WorkoutSessionsService,
    private confirm: ConfirmDialogService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadSessions();
  }

  async loadSessions(): Promise<void> {
    this.loading = true;
    this.errorMsg = '';

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 12000)
    );

    try {
      const all = await Promise.race([this.sessionsSvc.listAll(), timeout]);
      this.sessions = all.map(({ id, session }) => {
        const date = new Date(session.date + 'T00:00:00');
        const displayDate = date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        const completedSets = session.exercises.reduce((acc, ex) =>
          acc + ex.sets.filter(s => s.done).length, 0);
        return { key: id, session, displayDate, completedSets };
      });
    } catch (e: any) {
      console.error('Errore caricamento storico allenamenti:', e);
      this.errorMsg = e?.message === 'TIMEOUT'
        ? 'La connessione sta impiegando troppo tempo. Controlla la rete e riprova.'
        : 'Errore nel caricamento dello storico. Riprova.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  goToDetail(key: string): void {
    this.router.navigate(['/scheda/storico', encodeURIComponent(key)]);
  }

  async deleteSession(key: string, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    const confirmed = await this.confirm.confirm('Eliminare questa seduta dallo storico?');
    if (!confirmed) return;
    const ok = await this.sessionsSvc.delete(key);
    if (ok) {
      await this.loadSessions();
    } else {
      this.errorMsg = 'Errore durante l\'eliminazione. Riprova.';
      this.cdr.detectChanges();
    }
  }
}
