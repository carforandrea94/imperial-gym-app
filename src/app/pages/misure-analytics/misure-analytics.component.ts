import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MeasurementDataService } from '../../services/measurement-data.service';
import {
  MeasureField,
  MeasurementKey,
  MEASURE_CARD_1,
  MEASURE_CARD_2,
  MEASURE_CARD_3
} from '../../models/measurement.model';

interface FieldOption {
  field: MeasureField;
  hasData: boolean;
  lastValue: string | null;
}

@Component({
  selector: 'app-misure-analytics',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './misure-analytics.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class MisureAnalyticsComponent implements OnInit {
  group1: FieldOption[] = [];
  group2: FieldOption[] = [];
  group3: FieldOption[] = [];

  selectedKey: MeasurementKey = 'peso';
  selectedField: MeasureField | null = null;

  chartSvg: SafeHtml | null = null;
  hasEnoughData = false;
  hasAnyHistory = false;

  firstValue: string | null = null;
  lastValue: string | null = null;
  delta: number | null = null;

  private allEntries: import('../../models/measurement.model').MeasurementEntry[] = [];
  private allHistory: { date: string; value: number }[] = [];
  loading = true;
  errorMsg = '';

  constructor(
    private data: MeasurementDataService,
    private sanitizer: DomSanitizer,
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
      const [history, lastValues] = await Promise.race([
        Promise.all([this.data.loadHistory(), this.data.getLastValues()]),
        timeout
      ]);
      this.allEntries = history;
      this.hasAnyHistory = history.length > 0;

      const buildGroup = (fields: MeasureField[]): FieldOption[] =>
        fields.map(field => ({
          field,
          hasData: history.some(e => !!e[field.key]),
          lastValue: lastValues[field.key] ?? null
        }));

      this.group1 = buildGroup(MEASURE_CARD_1);
      this.group2 = buildGroup(MEASURE_CARD_2);
      this.group3 = buildGroup(MEASURE_CARD_3);

      // Seleziona di default il primo campo con dati sufficienti (almeno 2 punti), altrimenti 'peso'
      const allOptions = [...this.group1, ...this.group2, ...this.group3];
      const firstWithData = allOptions.find(o => o.hasData);
      this.selectField(firstWithData ? firstWithData.field : this.group1[0].field);
    } catch (e: any) {
      console.error('Errore caricamento analisi misure:', e);
      this.errorMsg = e?.message === 'TIMEOUT'
        ? 'La connessione sta impiegando troppo tempo. Controlla la rete e riprova.'
        : 'Errore nel caricamento dei dati. Riprova.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  selectField(field: MeasureField): void {
    this.selectedKey = field.key;
    this.selectedField = field;

    const history = this.allEntries.slice().reverse(); // dal piu' vecchio al piu' recente
    const points = history
      .filter(e => !!e[field.key])
      .map(e => ({ date: e.date, value: parseFloat(e[field.key] as string) }))
      .filter(p => !isNaN(p.value));

    this.allHistory = points;
    this.hasEnoughData = points.length >= 2;

    if (points.length >= 1) {
      this.firstValue = points[0].value.toString();
      this.lastValue = points[points.length - 1].value.toString();
    } else {
      this.firstValue = null;
      this.lastValue = null;
    }

    if (this.hasEnoughData) {
      const diff = points[points.length - 1].value - points[0].value;
      this.delta = Math.round(diff * 10) / 10;
      const svg = this.data.buildTrendSVG(points);
      this.chartSvg = this.sanitizer.bypassSecurityTrustHtml(svg);
    } else {
      this.delta = null;
      this.chartSvg = null;
    }
  }

  isSelected(field: MeasureField): boolean {
    return this.selectedKey === field.key;
  }

  getDeltaClass(): string {
    if (this.delta === null || this.delta === 0) return 'delta';
    return this.delta > 0 ? 'delta up' : 'delta down';
  }
}
