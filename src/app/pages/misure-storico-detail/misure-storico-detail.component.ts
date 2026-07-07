import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MeasurementDataService } from '../../services/measurement-data.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import {
  MeasurementEntry,
  MeasureField,
  MEASURE_CARD_1,
  MEASURE_CARD_2,
  MEASURE_CARD_3
} from '../../models/measurement.model';

interface FieldRow {
  field: MeasureField;
  value: string | null;
  delta: number | null;
}

@Component({
  selector: 'app-misure-storico-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './misure-storico-detail.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class MisureStoricoDetailComponent implements OnInit {
  entry: MeasurementEntry | null = null;
  displayDate = '';
  date = '';

  rows1: FieldRow[] = [];
  rows2: FieldRow[] = [];
  rows3: FieldRow[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private data: MeasurementDataService,
    private confirm: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.date = this.route.snapshot.paramMap.get('key') ?? '';
    this.entry = this.data.loadHistory().find(e => e.date === this.date) ?? null;
    if (!this.entry) { this.router.navigate(['/misure/storico']); return; }

    const d = new Date(this.entry.date + 'T00:00:00');
    this.displayDate = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const prev = this.data.getPreviousEntry(this.entry.date);
    this.rows1 = this.buildRows(MEASURE_CARD_1, this.entry, prev);
    this.rows2 = this.buildRows(MEASURE_CARD_2, this.entry, prev);
    this.rows3 = this.buildRows(MEASURE_CARD_3, this.entry, prev);
  }

  private buildRows(fields: MeasureField[], entry: MeasurementEntry, prev: MeasurementEntry | null): FieldRow[] {
    return fields.map(field => {
      const value = entry[field.key];
      let delta: number | null = null;
      if (value && prev?.[field.key]) {
        const diff = parseFloat(value) - parseFloat(prev[field.key] as string);
        if (!isNaN(diff)) delta = Math.round(diff * 10) / 10;
      }
      return { field, value, delta };
    });
  }

  hasValue(rows: FieldRow[]): boolean {
    return rows.some(r => !!r.value);
  }

  async deleteEntry(): Promise<void> {
    const ok = await this.confirm.confirm('Eliminare questa misurazione dallo storico?');
    if (ok) {
      this.data.deleteEntry(this.date);
      this.router.navigate(['/misure/storico']);
    }
  }
}
