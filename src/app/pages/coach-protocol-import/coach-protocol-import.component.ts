import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
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

    .pdf-overlay {
      position: fixed; inset: 0; z-index: 1000;
      display: flex; align-items: center; justify-content: center;
      background: rgba(4, 10, 8, 0.72);
      backdrop-filter: blur(6px) saturate(120%);
      -webkit-backdrop-filter: blur(6px) saturate(120%);
      animation: fade .25s var(--spring-soft);
    }
    .pdf-overlay-card {
      width: min(340px, 86vw);
      padding: 28px 24px;
      border-radius: 24px;
      background: var(--content-glass-bg, rgba(20,26,24,0.9));
      border: 1px solid var(--content-glass-border, rgba(255,255,255,.12));
      box-shadow: 0 20px 50px rgba(0,0,0,.45);
      text-align: center;
    }
    .pdf-overlay-stage {
      font-family: 'Inter', sans-serif; font-weight: 600; font-size: 15px;
      color: #fff; margin-bottom: 18px;
    }
    .pdf-progress-track {
      width: 100%; height: 8px; border-radius: 999px;
      background: rgba(255,255,255,.12); overflow: hidden;
    }
    .pdf-progress-fill {
      height: 100%; border-radius: 999px;
      background: linear-gradient(90deg, #0F7A57, var(--imp-red));
      transition: width .35s var(--spring-soft, ease);
    }
    .pdf-progress-pct {
      margin-top: 10px; font-family: 'IBM Plex Mono', monospace;
      font-size: 12.5px; color: var(--label-2, rgba(255,255,255,.6));
    }
  `]
})
export class CoachProtocolImportComponent implements OnInit, OnDestroy {
  clientId = '';
  private paramSub: Subscription | null = null;

  schedaFile: File | null = null;
  dietaFile: File | null = null;
  integrazioneFile: File | null = null;

  processing = false;
  errorMsg = '';
  /** Fase corrente mostrata all'utente durante l'elaborazione (vedi template). */
  stage = '';
  /** Avanzamento indicativo per fase (0-100), mostrato nella progress bar dell'overlay. */
  progressPercent = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private pdfSvc: PdfImportService,
    private protocolSvc: ProtocolService,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.paramSub = this.route.paramMap.subscribe(params => {
      this.clientId = params.get('clientId') ?? '';
    });
  }

  ngOnDestroy(): void {
    this.paramSub?.unsubscribe();
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

  private setStage(stage: string, percent: number): void {
    this.stage = stage;
    this.progressPercent = percent;
  }

  async process(): Promise<void> {
    if (!this.canProcess) return;
    this.processing = true;
    this.errorMsg = '';

    try {
      this.setStage('Creazione bozza protocollo…', 5);
      const coach = this.auth.currentUser()!;
      const id = await this.protocolSvc.create(this.clientId, coach.uid);

      this.setStage('Lettura scheda allenamento…', 20);
      const schedaText = await this.withTimeout(this.pdfSvc.extractText(this.schedaFile!), 'Lettura scheda');

      this.setStage('Lettura dieta…', 40);
      const dietaText = await this.withTimeout(this.pdfSvc.extractText(this.dietaFile!), 'Lettura dieta');

      this.setStage('Analisi esercizi e alimenti…', 65);
      const days = this.pdfSvc.parseWorkoutText(schedaText);
      const diet = this.pdfSvc.parseDietText(dietaText);
      const durationWeeks = this.pdfSvc.detectProgramDurationWeeks(schedaText);

      let infoNote = this.pdfSvc.extractDietNotes(dietaText);
      if (this.integrazioneFile) {
        this.setStage('Lettura integrazione…', 75);
        const integrazioneText = await this.withTimeout(this.pdfSvc.extractText(this.integrazioneFile), 'Lettura integrazione');
        infoNote = [infoNote, integrazioneText.trim()].filter(Boolean).join('\n\n');
      }

      this.setStage('Salvataggio protocollo…', 90);
      await this.protocolSvc.update(this.clientId, id, {
        name: 'Protocollo da PDF',
        source: 'pdf',
        workout: { weekPlan: Array.from({ length: durationWeeks }, () => ({ sets: 4, reps: 10 })), days, programStart: new Date().toISOString().split('T')[0] },
        diet,
        infoNote
      });

      this.setStage('Completato', 100);
      this.router.navigate(['/coach/clienti', this.clientId]);
    } catch (e: any) {
      console.error('Errore importazione PDF:', e);
      this.errorMsg = e?.message || 'Errore durante la lettura dei PDF. Riprova o crea il protocollo manualmente.';
    } finally {
      this.processing = false;
      this.stage = '';
      this.progressPercent = 0;
    }
  }
}
