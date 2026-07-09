import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { PdfImportService } from '../../services/pdf-import.service';
import { ProtocolService } from '../../services/protocol.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-coach-protocol-import',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './coach-protocol-import.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class CoachProtocolImportComponent {
  clientId = '';

  schedaFile: File | null = null;
  dietaFile: File | null = null;
  integrazioneFile: File | null = null;

  processing = false;
  errorMsg = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private pdfSvc: PdfImportService,
    private protocolSvc: ProtocolService,
    private auth: AuthService
  ) {
    this.clientId = this.route.snapshot.paramMap.get('clientId') ?? '';
  }

  onFile(event: Event, which: 'scheda' | 'dieta' | 'integrazione'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (which === 'scheda') this.schedaFile = file;
    if (which === 'dieta') this.dietaFile = file;
    if (which === 'integrazione') this.integrazioneFile = file;
  }

  get canProcess(): boolean {
    return !!this.schedaFile && !!this.dietaFile && !this.processing;
  }

  async process(): Promise<void> {
    if (!this.canProcess) return;
    this.processing = true;
    this.errorMsg = '';

    try {
      const coach = this.auth.currentUser()!;
      const id = await this.protocolSvc.create(this.clientId, coach.uid);

      const schedaText = await this.pdfSvc.extractText(this.schedaFile!);
      const dietaText = await this.pdfSvc.extractText(this.dietaFile!);
      const days = this.pdfSvc.parseWorkoutText(schedaText);
      const diet = this.pdfSvc.parseDietText(dietaText);

      let infoNote = this.pdfSvc.extractDietNotes(dietaText);
      if (this.integrazioneFile) {
        const integrazioneText = await this.pdfSvc.extractText(this.integrazioneFile);
        infoNote = [infoNote, integrazioneText.trim()].filter(Boolean).join('\n\n');
      }

      await this.protocolSvc.update(this.clientId, id, {
        name: 'Protocollo da PDF',
        source: 'pdf',
        workout: { weekPlan: Array.from({ length: 8 }, () => ({ sets: 4, reps: 10 })), days, programStart: new Date().toISOString().split('T')[0] },
        diet,
        infoNote
      });

      this.router.navigate(['/coach/clienti', this.clientId, 'builder', id]);
    } catch (e: any) {
      console.error('Errore importazione PDF:', e);
      this.errorMsg = e?.message || 'Errore durante la lettura dei PDF. Riprova o crea il protocollo manualmente.';
    } finally {
      this.processing = false;
    }
  }
}
