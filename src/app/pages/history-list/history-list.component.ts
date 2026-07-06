import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { StorageService } from '../../services/storage.service';
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

  constructor(
    private storage: StorageService,
    private confirm: ConfirmDialogService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadSessions();
  }

  private loadSessions(): void {
    const keys = this.storage.list('workout:').sort().reverse();
    this.sessions = keys.map(key => {
      const session = this.storage.getJSON<WorkoutSession>(key)!;
      const date = new Date(session.date);
      const displayDate = date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const completedSets = session.exercises.reduce((acc, ex) =>
        acc + ex.sets.filter(s => s.done).length, 0);
      return { key, session, displayDate, completedSets };
    });
  }

  goToDetail(key: string): void {
    this.router.navigate(['/scheda/storico', encodeURIComponent(key)]);
  }

  async deleteSession(key: string, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    const ok = await this.confirm.confirm('Eliminare questa seduta dallo storico?');
    if (ok) {
      this.storage.delete(key);
      this.loadSessions();
    }
  }
}
