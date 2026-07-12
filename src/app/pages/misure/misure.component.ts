import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MeasurementDataService } from '../../services/measurement-data.service';
import { todayLocalISO } from '../../core/utils/date.util';
import {
  MeasurementEntry,
  MeasurementKey,
  MeasureField,
  MEASURE_CARD_1,
  MEASURE_CARD_2,
  MEASURE_CARD_3,
  emptyMeasurementEntry
} from '../../models/measurement.model';

@Component({
  selector: 'app-misure',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './misure.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class MisureComponent implements OnInit, OnDestroy {
  card1 = MEASURE_CARD_1;
  card2 = MEASURE_CARD_2;
  card3 = MEASURE_CARD_3;

  entry: MeasurementEntry = emptyMeasurementEntry(this.todayISO());
  placeholders: Partial<Record<MeasurementKey, string>> = {};
  saveStatus: 'idle' | 'saved' | 'err' = 'idle';

  private draftTimer: ReturnType<typeof setTimeout> | null = null;

  loading = true;

  constructor(
    private data: MeasurementDataService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    this.loading = true;
    this.placeholders = await this.data.getLastValues();
    const draft = await this.data.loadDraft();
    if (draft) {
      this.entry = draft;
    }
    this.loading = false;
  }

  ngOnDestroy(): void {
    if (this.draftTimer) clearTimeout(this.draftTimer);
  }

  private todayISO(): string {
    return todayLocalISO();
  }

  onInput(): void {
    this.scheduleDraft();
  }

  private scheduleDraft(): void {
    if (this.draftTimer) clearTimeout(this.draftTimer);
    this.draftTimer = setTimeout(() => this.data.saveDraft(this.entry), 500);
  }

  hasAnyValue(): boolean {
    return [this.card1, this.card2, this.card3]
      .flat()
      .some(f => !!this.entry[f.key]);
  }

  async saveMeasures(): Promise<void> {
    if (!this.hasAnyValue()) return;
    if (this.draftTimer) { clearTimeout(this.draftTimer); this.draftTimer = null; }
    this.entry.date = this.todayISO();
    const ok = await this.data.saveEntry(this.entry);
    if (ok) {
      await this.data.clearDraft();
      this.placeholders = await this.data.getLastValues();
      this.entry = emptyMeasurementEntry(this.todayISO());
      this.saveStatus = 'saved';
      setTimeout(() => { this.saveStatus = 'idle'; this.cdr.detectChanges(); }, 2000);
    } else {
      this.saveStatus = 'err';
      setTimeout(() => { this.saveStatus = 'idle'; this.cdr.detectChanges(); }, 2000);
    }
    this.cdr.detectChanges();
  }

  getSaveBtnClass(): string {
    if (this.saveStatus === 'saved') return 'savebtn saved';
    if (this.saveStatus === 'err') return 'savebtn err';
    return 'savebtn';
  }

  getSaveBtnText(): string {
    if (this.saveStatus === 'saved') return '✓ Misure salvate!';
    if (this.saveStatus === 'err') return '✕ Errore salvataggio';
    return 'Salva misure';
  }

  goToHistory(): void {
    this.router.navigate(['/misure/storico']);
  }
}
