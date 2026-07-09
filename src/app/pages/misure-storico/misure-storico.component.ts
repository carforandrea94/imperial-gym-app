import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MeasurementDataService } from '../../services/measurement-data.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { MeasurementEntry } from '../../models/measurement.model';

interface EntryRow {
  entry: MeasurementEntry;
  displayDate: string;
  pesoDelta: number | null;
}

@Component({
  selector: 'app-misure-storico',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './misure-storico.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class MisureStoricoComponent implements OnInit {
  rows: EntryRow[] = [];
  loading = true;
  errorMsg = '';

  constructor(
    private data: MeasurementDataService,
    private confirm: ConfirmDialogService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.errorMsg = '';

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 12000)
    );

    try {
      const history = await Promise.race([this.data.loadHistory(), timeout]); // dalla piu' recente
      this.rows = history.map((entry, i) => {
        const date = new Date(entry.date + 'T00:00:00');
        const displayDate = date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        const prev = history[i + 1];
        let pesoDelta: number | null = null;
        if (entry.peso && prev?.peso) {
          const diff = parseFloat(entry.peso) - parseFloat(prev.peso);
          if (!isNaN(diff)) pesoDelta = Math.round(diff * 10) / 10;
        }
        return { entry, displayDate, pesoDelta };
      });
    } catch (e: any) {
      console.error('Errore caricamento storico misure:', e);
      this.errorMsg = e?.message === 'TIMEOUT'
        ? 'La connessione sta impiegando troppo tempo. Controlla la rete e riprova.'
        : 'Errore nel caricamento dello storico. Riprova.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  goToDetail(date: string): void {
    this.router.navigate(['/misure/storico', date]);
  }

  async deleteEntry(date: string, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    const ok = await this.confirm.confirm('Eliminare questa misurazione dallo storico?');
    if (ok) {
      await this.data.deleteEntry(date);
      await this.load();
    }
  }
}
