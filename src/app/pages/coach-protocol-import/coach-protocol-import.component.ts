import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { PdfImportService } from '../../services/pdf-import.service';
import { ProtocolService } from '../../services/protocol.service';
import { AuthService } from '../../core/services/auth.service';

/** Tempo massimo per ciascuna fase prima di rinunciare e segnalare un errore
 *  invece di restare bloccati a tempo indeterminato senza alcun feedback
 *  (es. se il worker di pdf.js non riesce a caricarsi/rispondere). */
const STEP_TIMEOUT_MS = 25000;

@Component({
  selector: 'app-coach-protocol-import',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './coach-protocol-import.component.html',
  styles: [`
    :host { display: block; animation: fade .4s var(--spring-soft); }
    .pdf-spinner {
      width: 16px; height: 16px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,.35); border-top-color: #fff;
      animation: pdf-spin .8s linear infinite; flex-shrink: 0;
    }
    @keyframes pdf-spin { to { transform: rotate(360deg); } }
  `]
})
export class CoachProtocolImportComponent {
  clientId = '';

  schedaFile: File | null = null;
  dietaFile: File | null = null;
  integrazioneFile: File | null = null;

  processing = false;
  errorMsg = '';
  /** Fase corrente mostrata all'utente durante l'elaborazione (vedi template). */
  stage = '';

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

  private async withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${label}: tempo scaduto. Riprova, o verifica che il PDF non sia troppo pesante/corrotto.`)),
        STEP_TIMEOUT_MS
      );
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timer!);
    }
  }

  async process(): Promise<void> {
    if (!this.canProcess) return;
    this.processing = true;
    this.errorMsg = '';

    try {
      this.stage = 'Creazione bozza protocollo…';
      const coach = this.auth.currentUser()!;
      const id = await this.protocolSvc.create(this.clientId, coach.uid);

      this.stage = 'Lettura scheda allenamento…';
      const schedaText = await this.withTimeout(this.pdfSvc.extractText(this.schedaFile!), 'Lettura scheda');

      this.stage = 'Lettura dieta…';
      const dietaText = await this.withTimeout(this.pdfSvc.extractText(this.dietaFile!), 'Lettura dieta');

      this.stage = 'Analisi esercizi e alimenti…';
      const days = this.pdfSvc.parseWorkoutText(schedaText);
      const diet = this.pdfSvc.parseDietText(dietaText);
      const durationWeeks = this.pdfSvc.detectProgramDurationWeeks(schedaText);

      let infoNote = this.pdfSvc.extractDietNotes(dietaText);
      if (this.integrazioneFile) {
        this.stage = 'Lettura integrazione…';
        const integrazioneText = await this.withTimeout(this.pdfSvc.extractText(this.integrazioneFile), 'Lettura integrazione');
        infoNote = [infoNote, integrazioneText.trim()].filter(Boolean).join('\n\n');
      }

      this.stage = 'Salvataggio protocollo…';
      await this.protocolSvc.update(this.clientId, id, {
        name: 'Protocollo da PDF',
        source: 'pdf',
        workout: { weekPlan: Array.from({ length: durationWeeks }, () => ({ sets: 4, reps: 10 })), days, programStart: new Date().toISOString().split('T')[0] },
        diet,
        infoNote
      });

      this.router.navigate(['/coach/clienti', this.clientId, 'builder', id]);
    } catch (e: any) {
      console.error('Errore importazione PDF:', e);
      this.errorMsg = e?.message || 'Errore durante la lettura dei PDF. Riprova o crea il protocollo manualmente.';
    } finally {
      this.processing = false;
      this.stage = '';
    }
  }
}
