import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ProgressiDataService } from '../../services/progressi-data.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { AuthService } from '../../core/services/auth.service';
import { ProgressiRecord } from '../../models/progressi.model';
import { toggleSelection } from '../../core/utils/progressi-selection.util';

interface ProgressiRow {
  record: ProgressiRecord;
  displayDate: string;
}

@Component({
  selector: 'app-progressi-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './progressi-list.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class ProgressiListComponent implements OnInit {
  rows: ProgressiRow[] = [];
  selected: string[] = [];
  loading = true;
  errorMsg = '';
  readonly = false;
  private uid = '';
  private clientId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private data: ProgressiDataService,
    private confirm: ConfirmDialogService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.clientId = this.route.snapshot.paramMap.get('clientId');
    this.readonly = !!this.clientId;
    this.uid = this.clientId ?? this.auth.currentUser()!.uid;
    this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.errorMsg = '';

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 12000)
    );

    try {
      const history = await Promise.race([this.data.loadHistory(this.uid), timeout]);
      this.rows = history.map(record => {
        const d = new Date(record.date + 'T00:00:00');
        const displayDate = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        return { record, displayDate };
      });
    } catch (e: any) {
      console.error('Errore caricamento progressi:', e);
      this.errorMsg = e?.message === 'TIMEOUT'
        ? 'La connessione sta impiegando troppo tempo. Controlla la rete e riprova.'
        : 'Errore nel caricamento. Riprova.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  toggleRow(date: string): void {
    this.selected = toggleSelection(this.selected, date);
  }

  isSelected(date: string): boolean {
    return this.selected.includes(date);
  }

  compare(): void {
    const [d1, d2] = [...this.selected].sort();
    if (this.readonly) {
      this.router.navigate(['/coach/clienti', this.clientId, 'progressi', 'confronto', d1, d2]);
    } else {
      this.router.navigate(['/misure/progressi/confronto', d1, d2]);
    }
  }

  newProgressi(): void {
    this.router.navigate(['/misure/progressi/nuovo']);
  }

  async deleteEntry(date: string, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    const ok = await this.confirm.confirm('Eliminare questo record progressi?');
    if (ok) {
      await this.data.delete(this.uid, date);
      this.selected = this.selected.filter(d => d !== date);
      await this.load();
    }
  }
}
