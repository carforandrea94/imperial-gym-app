import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { PdfImportService } from '../../services/pdf-import.service';
import { ProtocolService } from '../../services/protocol.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { AuthService } from '../../core/services/auth.service';
import { todayLocalISO } from '../../core/utils/date.util';
import { Protocol } from '../../models/protocol.model';

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
      background: linear-gradient(90deg, var(--state-success-deep), var(--imp-red));
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
  /** Vuoto in modalita' creazione; valorizzato in modalita' aggiornamento (route con :protocolId). */
  protocolId = '';
  private existingProtocol: Protocol | null = null;
  /** true dal momento in cui sappiamo che siamo in modalita' aggiornamento (c'e' un
   *  protocolId) fino a quando il protocollo esistente e' stato letto da Firestore
   *  (con successo o meno). Finche' e' true, "Aggiorna protocollo" resta disabilitato:
   *  senza questa guardia era possibile scegliere un file e cliccare il bottone PRIMA
   *  che la lettura fosse completata, con existingProtocol ancora null - processUpdate()
   *  crashava leggendo un campo su null non appena tentava di consultare il protocollo
   *  esistente (mai un problema del PDF o della logica di estrazione). */
  loadingExisting = false;
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
    private confirm: ConfirmDialogService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  get isUpdateMode(): boolean {
    return !!this.protocolId;
  }

  ngOnInit(): void {
    this.paramSub = this.route.paramMap.subscribe(params => {
      this.clientId = params.get('clientId') ?? '';
      this.protocolId = params.get('protocolId') ?? '';
      if (this.protocolId) {
        this.loadingExisting = true;
        this.loadExisting();
      }
    });
  }

  ngOnDestroy(): void {
    this.paramSub?.unsubscribe();
  }

  private async loadExisting(): Promise<void> {
    try {
      const p = await this.protocolSvc.get(this.clientId, this.protocolId);
      if (!p) { this.router.navigate(['/coach/clienti', this.clientId]); return; }
      this.existingProtocol = p;
    } catch (e: any) {
      console.error('Errore caricamento protocollo esistente:', e);
      this.errorMsg = 'Errore nel caricamento del protocollo esistente. Ricarica la pagina e riprova.';
    } finally {
      this.loadingExisting = false;
      this.cdr.detectChanges();
    }
  }

  onFile(event: Event, which: 'scheda' | 'dieta' | 'integrazione'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (which === 'scheda') this.schedaFile = file;
    if (which === 'dieta') this.dietaFile = file;
    if (which === 'integrazione') this.integrazioneFile = file;
  }

  get canProcess(): boolean {
    if (this.processing) return false;
    if (this.isUpdateMode) {
      if (this.loadingExisting) return false;
      return !!(this.schedaFile || this.dietaFile || this.integrazioneFile);
    }
    return !!this.schedaFile && !!this.dietaFile;
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
    // App senza zone.js: senza questa chiamata esplicita la vista non si
    // ridisegna dopo un await su Promise "pure" (Firestore, worker pdf.js),
    // restando visivamente bloccata sull'ultimo stage anche se lo stato interno
    // e' gia' avanzato (stesso problema che ZoneFixService risolve altrove).
    this.cdr.detectChanges();
  }

  private buildConfirmMessage(): string {
    const parts: string[] = [];
    if (this.schedaFile) parts.push('giorni di allenamento e onda di carico');
    if (this.dietaFile) parts.push('dieta e note');
    if (this.integrazioneFile) parts.push('note integrazione');
    return `Verranno aggiornati: ${parts.join(', ')}. Continuare?`;
  }

  async process(): Promise<void> {
    if (!this.canProcess) return;

    if (this.isUpdateMode) {
      const ok = await this.confirm.confirm(this.buildConfirmMessage(), { confirmLabel: 'Continua', dangerous: false });
      if (!ok) return;
    }

    this.processing = true;
    this.errorMsg = '';

    try {
      if (this.isUpdateMode) {
        await this.processUpdate();
      } else {
        await this.processCreate();
      }
    } catch (e: any) {
      console.error('Errore importazione PDF:', e);
      this.errorMsg = e?.message || 'Errore durante la lettura dei PDF. Riprova o crea il protocollo manualmente.';
    } finally {
      this.processing = false;
      this.stage = '';
      this.progressPercent = 0;
      this.cdr.detectChanges();
    }
  }

  private async processCreate(): Promise<void> {
    this.setStage('Creazione bozza protocollo…', 5);
    const coach = this.auth.currentUser()!;
    const id = await this.withTimeout(this.protocolSvc.create(this.clientId, coach.uid), 'Creazione bozza protocollo');

    this.setStage('Lettura scheda allenamento…', 20);
    const schedaText = await this.withTimeout(this.pdfSvc.extractText(this.schedaFile!), 'Lettura scheda');

    this.setStage('Lettura dieta…', 40);
    const dietaText = await this.withTimeout(this.pdfSvc.extractText(this.dietaFile!), 'Lettura dieta');

    this.setStage('Analisi esercizi e alimenti…', 65);
    const days = this.pdfSvc.parseWorkoutText(schedaText);
    const diet = this.pdfSvc.parseDietText(dietaText);
    const durationWeeks = this.pdfSvc.detectProgramDurationWeeks(schedaText);
    const weekPlan = this.pdfSvc.detectProtocolWeekPlan(days, durationWeeks);

    const dietNotesSource = this.pdfSvc.extractDietNotes(dietaText);
    let supplementNotesSource = '';
    if (this.integrazioneFile) {
      this.setStage('Lettura integrazione…', 75);
      const integrazioneText = await this.withTimeout(this.pdfSvc.extractText(this.integrazioneFile), 'Lettura integrazione');
      supplementNotesSource = integrazioneText.trim();
    }
    const infoNote = [dietNotesSource, supplementNotesSource].filter(Boolean).join('\n\n');

    this.setStage('Salvataggio protocollo…', 90);
    await this.withTimeout(this.protocolSvc.update(this.clientId, id, {
      name: 'Protocollo da PDF',
      source: 'pdf',
      workout: { weekPlan, days, programStart: todayLocalISO() },
      diet,
      dietNotesSource,
      supplementNotesSource,
      infoNote
    }), 'Salvataggio protocollo');

    this.setStage('Completato', 100);
    this.router.navigate(['/coach/clienti', this.clientId]);
  }

  private async processUpdate(): Promise<void> {
    const existing = this.existingProtocol!;
    const patch: Partial<Protocol> = {};
    let percent = 10;

    if (this.schedaFile) {
      this.setStage('Lettura scheda allenamento…', percent);
      const schedaText = await this.withTimeout(this.pdfSvc.extractText(this.schedaFile), 'Lettura scheda');
      const days = this.pdfSvc.parseWorkoutText(schedaText);
      const durationWeeks = this.pdfSvc.detectProgramDurationWeeks(schedaText);
      const weekPlan = this.pdfSvc.detectProtocolWeekPlan(days, durationWeeks);
      patch.workout = { ...existing.workout, days, weekPlan };
      percent = 40;
    }

    // Un protocollo creato prima di questa feature ha dietNotesSource/supplementNotesSource
    // entrambi undefined anche se infoNote contiene gia' testo reale (scritto alla vecchia
    // maniera). Teniamo traccia qui, PRIMA di leggere i PDF, di quali dei due erano gia'
    // "tracciati": ci serve piu' sotto per capire se e' sicuro ricalcolare infoNote.
    const dietSourceWasTracked = existing.dietNotesSource !== undefined;
    const supplementSourceWasTracked = existing.supplementNotesSource !== undefined;

    let dietNotesSource = existing.dietNotesSource ?? '';
    let supplementNotesSource = existing.supplementNotesSource ?? '';

    if (this.dietaFile) {
      this.setStage('Lettura dieta…', percent);
      const dietaText = await this.withTimeout(this.pdfSvc.extractText(this.dietaFile), 'Lettura dieta');
      patch.diet = this.pdfSvc.parseDietText(dietaText);
      dietNotesSource = this.pdfSvc.extractDietNotes(dietaText);
      percent = 65;
    }

    if (this.integrazioneFile) {
      this.setStage('Lettura integrazione…', percent);
      const integrazioneText = await this.withTimeout(this.pdfSvc.extractText(this.integrazioneFile), 'Lettura integrazione');
      supplementNotesSource = integrazioneText.trim();
    }

    if (this.dietaFile || this.integrazioneFile) {
      // Scriviamo un campo sorgente nel patch SOLO se e' stato genuinamente ricaricato
      // in questa operazione, oppure era gia' tracciato in precedenza. Se scrivessimo
      // sempre entrambi i campi (anche quello NON ricaricato), un protocollo legacy
      // (entrambi undefined) verrebbe silenziosamente "promosso" a tracciato-come-vuoto
      // sul lato non toccato. Al ricaricamento singolo SUCCESSIVO dello stesso lato,
      // l'altra sorgente risulterebbe erroneamente gia' nota, facendo ricalcolare
      // infoNote e cancellando comunque il contenuto legacy mai davvero ricaricato.
      if (this.dietaFile || dietSourceWasTracked) {
        patch.dietNotesSource = dietNotesSource;
      }
      if (this.integrazioneFile || supplementSourceWasTracked) {
        patch.supplementNotesSource = supplementNotesSource;
      }

      const bothReloadedTogether = !!this.dietaFile && !!this.integrazioneFile;
      const otherSourceIsKnown = this.dietaFile
        ? (this.integrazioneFile ? true : supplementSourceWasTracked)
        : dietSourceWasTracked;

      if (bothReloadedTogether || otherSourceIsKnown) {
        patch.infoNote = [dietNotesSource, supplementNotesSource].filter(Boolean).join('\n\n');
      }
      // else: il protocollo e' precedente a questa feature e l'altra sorgente non era mai
      // stata tracciata — non possiamo sapere quale porzione di infoNote le apparteneva,
      // quindi lo lasciamo invariato invece di rischiare di cancellarne il contenuto.
      // dietNotesSource/supplementNotesSource restano comunque aggiornati (solo per il
      // lato genuinamente ricaricato), cosi' il PROSSIMO ricaricamento su questo
      // protocollo potra' ricalcolare infoNote in sicurezza.
    }

    this.setStage('Salvataggio protocollo…', 90);
    try {
      await this.withTimeout(this.protocolSvc.update(this.clientId, this.protocolId, patch), 'Salvataggio protocollo');
    } catch (e: any) {
      throw new Error(`[processUpdate:protocolSvc.update] ${e?.message ?? e}`);
    }

    this.setStage('Completato', 100);
    this.router.navigate(['/coach/clienti', this.clientId, 'builder', this.protocolId]);
  }
}
