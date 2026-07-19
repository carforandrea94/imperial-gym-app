import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ProgressiDataService } from '../../services/progressi-data.service';
import { AuthService } from '../../core/services/auth.service';
import { ProgressiRecord, ProgressiPhotoType, PROGRESSI_PHOTO_TYPES, PROGRESSI_PHOTO_LABELS } from '../../models/progressi.model';

@Component({
  selector: 'app-progressi-confronto',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './progressi-confronto.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class ProgressiConfrontoComponent implements OnInit {
  readonly types = PROGRESSI_PHOTO_TYPES;
  readonly labels = PROGRESSI_PHOTO_LABELS;
  activeType: ProgressiPhotoType = 'fronte';

  record1: ProgressiRecord | null = null;
  record2: ProgressiRecord | null = null;
  displayDate1 = '';
  displayDate2 = '';

  loading = true;
  errorMsg = '';

  constructor(
    private route: ActivatedRoute,
    private data: ProgressiDataService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.errorMsg = '';

    const clientId = this.route.snapshot.paramMap.get('clientId');
    const uid = clientId ?? this.auth.currentUser()!.uid;
    const date1 = this.route.snapshot.paramMap.get('data1') ?? '';
    const date2 = this.route.snapshot.paramMap.get('data2') ?? '';

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 12000)
    );

    try {
      const history = await Promise.race([this.data.loadHistory(uid), timeout]);
      this.record1 = history.find(r => r.date === date1) ?? null;
      this.record2 = history.find(r => r.date === date2) ?? null;
      this.displayDate1 = this.formatDate(date1);
      this.displayDate2 = this.formatDate(date2);
      if (!this.record1 || !this.record2) {
        this.errorMsg = 'Uno o entrambi i progressi selezionati non sono più disponibili.';
      }
    } catch (e: any) {
      console.error('Errore caricamento confronto progressi:', e);
      this.errorMsg = e?.message === 'TIMEOUT'
        ? 'La connessione sta impiegando troppo tempo. Controlla la rete e riprova.'
        : 'Errore nel caricamento. Riprova.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  private formatDate(date: string): string {
    if (!date) return '';
    const d = new Date(date + 'T00:00:00');
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  selectType(type: ProgressiPhotoType): void {
    this.activeType = type;
  }

  photoUrl(record: ProgressiRecord | null, type: ProgressiPhotoType): string | null {
    if (!record) return null;
    if (type === 'fronte') return record.fronteUrl;
    if (type === 'retro') return record.retroUrl;
    return record.lateraleUrl;
  }
}
