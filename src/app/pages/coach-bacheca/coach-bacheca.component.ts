import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AnnouncementsService } from '../../services/announcements.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { Announcement } from '../../core/models/user.model';

@Component({
  selector: 'app-coach-bacheca',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './coach-bacheca.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class CoachBachecaComponent implements OnInit {
  announcements: Announcement[] = [];
  newText = '';
  loading = true;
  posting = false;
  errorMsg = '';

  constructor(
    private svc: AnnouncementsService,
    private confirm: ConfirmDialogService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.errorMsg = '';

    const timeout = new Promise<Announcement[]>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 12000)
    );

    try {
      this.announcements = await Promise.race([this.svc.listForCoach(), timeout]);
    } catch (e: any) {
      console.error('Errore caricamento bacheca:', e);
      this.errorMsg = e?.message === 'TIMEOUT'
        ? 'La connessione sta impiegando troppo tempo. Controlla la rete e riprova.'
        : 'Errore nel caricamento. Riprova.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async post(): Promise<void> {
    const text = this.newText.trim();
    if (!text) return;
    this.posting = true;
    try {
      await this.svc.create(text);
      this.newText = '';
      await this.load();
    } finally {
      this.posting = false;
      this.cdr.detectChanges();
    }
  }

  async remove(id: string): Promise<void> {
    const ok = await this.confirm.confirm('Eliminare questo avviso dalla bacheca?');
    if (ok) {
      await this.svc.delete(id);
      await this.load();
    }
  }

  displayDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  }
}
