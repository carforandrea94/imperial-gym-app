import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { MeasurementDataService } from '../../services/measurement-data.service';
import { todayLocalISO } from '../../core/utils/date.util';
import { MeasureCategory, MeasureField, CATEGORY_FIELDS, CATEGORY_LABELS } from '../../models/measurement.model';

@Component({
  selector: 'app-misura-categoria',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './misura-categoria.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class MisuraCategoriaComponent implements OnInit, OnDestroy {
  category!: MeasureCategory;
  fields: MeasureField[] = [];
  title = '';

  isEdit = false;
  originalDate = '';
  dateValue = '';
  maxDate = todayLocalISO();

  values: Record<string, string | null> = {};
  placeholders: Partial<Record<string, string>> = {};

  saveStatus: 'idle' | 'err' = 'idle';
  errorMsg = '';
  loading = true;

  private draftTimer: ReturnType<typeof setTimeout> | null = null;
  private paramSub: Subscription | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private data: MeasurementDataService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.paramSub = this.route.paramMap.subscribe(params => {
      this.category = params.get('categoria') as MeasureCategory;
      this.fields = CATEGORY_FIELDS[this.category];
      this.title = CATEGORY_LABELS[this.category];
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.paramSub?.unsubscribe();
    if (this.draftTimer) clearTimeout(this.draftTimer);
  }

  private emptyValues(): Record<string, string | null> {
    const out: Record<string, string | null> = {};
    this.fields.forEach(f => { out[f.key] = null; });
    return out;
  }

  async load(): Promise<void> {
    this.loading = true;
    this.errorMsg = '';
    const dateParam = this.route.snapshot.queryParamMap.get('date');
    this.isEdit = !!dateParam;

    try {
      if (this.isEdit) {
        this.originalDate = dateParam!;
        this.dateValue = dateParam!;
        this.values = await this.data.getCategoryValues(this.category, dateParam!);
      } else {
        this.dateValue = todayLocalISO();
        this.values = this.emptyValues();
        const lastValues = await this.data.getLastValues();
        this.placeholders = {};
        this.fields.forEach(f => { if (lastValues[f.key]) this.placeholders[f.key] = lastValues[f.key]!; });
        const draft = await this.data.loadDraft(this.category);
        if (draft) this.values = draft;
      }
    } catch (e: any) {
      console.error('Errore caricamento misura:', e);
      this.errorMsg = 'Errore nel caricamento. Riprova.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  onInput(): void {
    if (this.isEdit) return;
    if (this.draftTimer) clearTimeout(this.draftTimer);
    this.draftTimer = setTimeout(() => this.data.saveDraft(this.category, this.values), 500);
  }

  hasAnyValue(): boolean {
    return this.fields.some(f => !!this.values[f.key]);
  }

  getSaveBtnClass(): string {
    return this.saveStatus === 'err' ? 'savebtn err' : 'savebtn';
  }

  getSaveBtnText(): string {
    return this.saveStatus === 'err' ? '✕ Errore salvataggio' : 'Salva';
  }

  async save(): Promise<void> {
    if (!this.hasAnyValue()) return;
    if (this.dateValue > this.maxDate) {
      this.errorMsg = 'Non puoi registrare una misurazione in una data futura.';
      this.cdr.detectChanges();
      return;
    }
    if (this.draftTimer) { clearTimeout(this.draftTimer); this.draftTimer = null; }
    this.errorMsg = '';

    if (!this.isEdit) {
      const ok = await this.data.saveCategoryToday(this.category, this.values);
      if (ok) {
        await this.data.clearDraft(this.category);
        this.router.navigate(['/misure']);
      } else {
        this.saveStatus = 'err';
        this.cdr.detectChanges();
        setTimeout(() => { this.saveStatus = 'idle'; this.cdr.detectChanges(); }, 2000);
      }
      return;
    }

    const result = await this.data.moveCategoryEntry(this.category, this.originalDate, this.dateValue, this.values);
    if (result === 'ok') {
      this.router.navigate(['/misure/storico', this.dateValue]);
    } else if (result === 'collision') {
      this.errorMsg = 'Esiste gia\' una misurazione di questo tipo in questa data.';
      this.cdr.detectChanges();
    } else {
      this.saveStatus = 'err';
      this.cdr.detectChanges();
      setTimeout(() => { this.saveStatus = 'idle'; this.cdr.detectChanges(); }, 2000);
    }
  }
}
