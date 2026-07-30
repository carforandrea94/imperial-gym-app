import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef, ElementRef, Renderer2, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { WorkoutDataService } from '../../services/workout-data.service';
import { WorkoutStateService } from '../../services/workout-state.service';
import { AppStateService, WorkoutDraftRow } from '../../services/app-state.service';
import { WorkoutSessionsService } from '../../services/workout-sessions.service';
import { WorkoutSessionStateService } from '../../services/workout-session-state.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { Day, Exercise, WorkoutSession, ExInsight } from '../../models/workout.model';
import { todayLocalISO } from '../../core/utils/date.util';
import { findClosestSlideIndex, scrollToSlide } from '../../core/utils/horizontal-slider.util';
import { ToastService } from '../../services/toast.service';
import { RestWaveComponent } from '../../components/rest-wave/rest-wave.component';

interface SerieRow {
  reps: string;
  load: string;
  done: boolean;
  ripPlaceholder: string;
  loadPlaceholder: string;
}

interface ExerciseVM {
  ex: Exercise;
  rows: SerieRow[];
  open: boolean;
  insightVisible: boolean;
  insight: ExInsight | null;
  restSeconds: number;
  isFirst: boolean;
  warmup: string | null;
}

@Component({
  selector: 'app-scheda-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RestWaveComponent],
  templateUrl: './scheda-detail.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class SchedaDetailComponent implements OnInit, AfterViewInit, OnDestroy {
  day!: Day;
  dayIndex = 0;
  exercises: ExerciseVM[] = [];
  loading = true;
  errorMsg = '';
  private draftTimer: ReturnType<typeof setTimeout> | null = null;
  private paramSub: Subscription | null = null;

  // Guardia contro `loadAll()` sovrapposte: cambiare giorno rapidamente puo'
  // lasciare "in volo" piu' fetch contemporaneamente. Solo la generazione
  // avviata per ultima ha il permesso di scrivere lo stato del componente
  // (stesso pattern di `mutationCount` in workout-session-state.service.ts).
  private loadGeneration = 0;

  restModalOpen = false;
  restModalVm: ExerciseVM | null = null;
  restModalValue = 90;

  /** Indice della slide visibile, contando anche le due card di sessione:
   *  0 = "Avvia sessione", 1..n = esercizi, n+1 = "Termina e salva". */
  sliderIndex = 0;
  private scrollTicking = false;

  @ViewChild('sliderEl') sliderEl?: ElementRef<HTMLDivElement>;
  @ViewChild('restSheetOverlay') restSheetOverlayEl?: ElementRef<HTMLDivElement>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public workoutData: WorkoutDataService,
    public state: WorkoutStateService,
    private appState: AppStateService,
    private sessions: WorkoutSessionsService,
    private confirm: ConfirmDialogService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    private toast: ToastService,
    private renderer: Renderer2,
    public sessionState: WorkoutSessionStateService
  ) {
    // Il toggle vive nella navbar (fuori da questa pagina): quando si passa
    // a "slider" da un'altra vista/pagina, riparte sempre dalla prima card.
    effect(() => {
      if (this.state.viewMode() === 'slider') {
        this.sliderIndex = 0;
        setTimeout(() => this.scrollToIndex(0), 0);
      }
    });
  }

  ngOnInit(): void {
    this.paramSub = this.route.paramMap.subscribe(params => {
      const n = parseInt(params.get('n') ?? '0', 10);
      // Una bozza in attesa appartiene al giorno che si sta lasciando: va
      // annullata PRIMA di sostituire `this.day`, altrimenti scriverebbe
      // sotto la chiave del giorno sbagliato.
      if (this.draftTimer) { clearTimeout(this.draftTimer); this.draftTimer = null; }

      this.dayIndex = n;
      this.day = this.workoutData.days[n];
      if (!this.day) { this.router.navigate(['/scheda']); return; }

      // Come nell'effect() del costruttore quando si passa a modalita' slider:
      // azzerare solo l'indice (i puntini) non basta, va riportato all'inizio
      // anche lo scroll fisico del contenitore, dopo che si e' ridisegnato
      // con gli esercizi del nuovo giorno (da cui il setTimeout(..., 0)).
      this.sliderIndex = 0;
      setTimeout(() => this.scrollToIndex(0), 0);
      // Il bottom sheet "Recupero" appartiene al giorno che si sta lasciando:
      // se resta aperto mostra l'esercizio sbagliato sotto la pagina nuova.
      this.closeRestModal();
      this.restModalVm = null;
      // Il timer di recupero vive dentro la card dell'esercizio da cui e'
      // partito: se quell'esercizio appartiene a un altro giorno resterebbe in
      // corso senza essere disegnato da nessuna parte, e senza modo di fermarlo.
      const timer = this.state.restTimer();
      if (timer.show && !timer.exKey?.startsWith(`${this.day.id}:`)) this.state.stopRestTimer();
      this.loadAll();
    });
  }

  // Aspetta bozze/override/insight da Firestore prima di mostrare le card,
  // cosi' non compaiono prima con dati incompleti (peso pre-compilato,
  // "Ultimo", suggerimento di progressione) e poi si aggiornano di scatto.
  async loadAll(): Promise<void> {
    // Guardia contro `loadAll()` sovrapposte (vedi `loadGeneration`): la
    // fetch cattura il giorno di QUESTA esecuzione, non quello che risultera'
    // corrente quando la Promise si risolve.
    const generation = ++this.loadGeneration;
    const dayId = this.day.id;

    this.loading = true;
    this.errorMsg = '';

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 12000)
    );

    try {
      const [appState, daySessions] = await Promise.race([
        Promise.all([this.appState.load(), this.sessions.listForDay(dayId)]),
        timeout
      ]);
      // Un caricamento piu' recente e' partito prima che questo si risolvesse:
      // i suoi dati sono superati e non vanno applicati allo stato corrente.
      if (generation !== this.loadGeneration) return;
      this.buildExercises(appState.restOverrides);
      this.loadDraft(appState.workoutDrafts[dayId]);
      this.loadInsights(daySessions);
    } catch (e: any) {
      if (generation !== this.loadGeneration) return;
      console.error('Errore caricamento scheda:', e);
      this.errorMsg = e?.message === 'TIMEOUT'
        ? 'La connessione sta impiegando troppo tempo. Controlla la rete e riprova.'
        : 'Errore nel caricamento della scheda. Riprova.';
    } finally {
      // Solo il caricamento corrente puo' spegnere `loading`: se lo facesse
      // anche uno superato, la pagina si mostrerebbe come pronta mentre la
      // fetch del giorno visualizzato e' ancora in volo. Non resta bloccato a
      // `true`: il caricamento vincente passa comunque da qui.
      if (generation === this.loadGeneration) this.loading = false;
      this.cdr.detectChanges();
    }
  }

  /**
   * Sposta il bottom sheet del recupero fuori da `.wrap` (che crea un proprio
   * stacking context via position:relative + z-index) direttamente in
   * document.body, altrimenti resta sempre sotto la tabbar indipendentemente
   * dal suo z-index interno.
   */
  ngAfterViewInit(): void {
    if (this.restSheetOverlayEl) {
      this.renderer.appendChild(document.body, this.restSheetOverlayEl.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.paramSub?.unsubscribe();
    if (this.draftTimer) clearTimeout(this.draftTimer);
    if (this.restSheetOverlayEl?.nativeElement.parentNode === document.body) {
      this.renderer.removeChild(document.body, this.restSheetOverlayEl.nativeElement);
    }
  }

  private buildExercises(restOverrides: Record<string, number>): void {
    const week = this.state.currentWeek;
    const protocolDefault = this.parseRecSeconds(this.day.rec);
    this.exercises = this.day.ex.map((ex, exIdx) => {
      const { sets, reps } = this.workoutData.getExSetsReps(ex, week);
      const rows: SerieRow[] = Array.from({ length: sets }, (_, i) => ({
        reps: String(reps[i] ?? ''),
        load: '',
        done: false,
        ripPlaceholder: String(reps[i] ?? ''),
        loadPlaceholder: ''
      }));
      const override = restOverrides[this.restKey(ex.name)];
      const restSeconds = override && override > 0 ? override : protocolDefault;
      return { ex, rows, open: true, insightVisible: false, insight: null, restSeconds, isFirst: exIdx === 0, warmup: null };
    });
  }

  /** Converte la stringa del protocollo (es. "60-90" oppure "90") nel numero di secondi di default. */
  private parseRecSeconds(rec: string | undefined): number {
    if (!rec) return 90;
    const nums = (rec.match(/\d+/g) ?? []).map(n => parseInt(n, 10));
    if (nums.length === 0) return 90;
    if (nums.length === 1) return nums[0];
    return Math.round((nums[0] + nums[1]) / 2);
  }

  /** Chiave stabile dell'esercizio nel giorno: usata sia per l'override del
   *  recupero salvato sull'account sia per sapere in quale card disegnare il timer. */
  restKey(exName: string): string {
    return `${this.day.id}:${exName}`;
  }

  private loadDraft(draft: { rows: WorkoutDraftRow[] }[] | undefined): void {
    if (!draft) return;
    draft.forEach((dex, i) => {
      if (this.exercises[i]) {
        dex.rows.forEach((row, j) => {
          if (this.exercises[i].rows[j]) {
            this.exercises[i].rows[j].reps = row.reps ?? '';
            this.exercises[i].rows[j].load = row.load ?? '';
            this.exercises[i].rows[j].done = row.done ?? false;
          }
        });
      }
    });
  }

  private loadInsights(daySessions: { id: string; session: WorkoutSession }[]): void {
    if (daySessions.length === 0) return;
    const sessions = daySessions.map(s => s.session);

    this.exercises.forEach((vm) => {
      const exName = vm.ex.name;

      // Collect max loads per session for this exercise
      const maxLoads: number[] = [];
      let lastSessionData: { load: string | null; reps: string | null }[] = [];

      sessions.forEach(s => {
        const sexData = s.exercises.find(e => e.name === exName);
        if (!sexData) return;
        const loads = sexData.sets.map(sr => parseFloat(sr.load ?? '') || 0);
        const maxLoad = Math.max(...loads.filter(l => l > 0));
        if (maxLoad > 0) maxLoads.push(maxLoad);
        lastSessionData = sexData.sets.map(sr => ({ load: sr.load, reps: sr.reps }));
      });

      // Set load placeholder from last session
      if (lastSessionData.length > 0) {
        lastSessionData.forEach((sr, j) => {
          if (vm.rows[j] && sr.load) {
            vm.rows[j].loadPlaceholder = sr.load;
          }
        });
      }

      const lastSession = sessions[sessions.length - 1];
      const lastEx = lastSession?.exercises.find(e => e.name === exName);
      let lastText = '';
      if (lastEx && lastSession) {
        const d = lastSession.date ? new Date(lastSession.date + 'T00:00:00') : null;
        const dd = d ? `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}` : '';
        const maxLoad = Math.max(...lastEx.sets.map(s => parseFloat(s.load ?? '') || 0).filter(l => l > 0));
        lastText = dd ? `Ultimo (${dd}): ${maxLoad > 0 ? maxLoad + ' kg' : '—'}` : '';
      }

      let sparkSvg: string | null = null;
      let delta: string | null = null;
      let deltaClass = '';

      if (maxLoads.length >= 2) {
        sparkSvg = this.workoutData.sparklineSVG(maxLoads);
        const diff = maxLoads[maxLoads.length - 1] - maxLoads[maxLoads.length - 2];
        if (diff > 0) { delta = `+${diff} kg`; deltaClass = 'up'; }
        else if (diff < 0) { delta = `${diff} kg`; deltaClass = 'down'; }
        else { delta = '= kg'; deltaClass = ''; }
      } else if (maxLoads.length === 1) {
        sparkSvg = this.workoutData.sparklineSVG(maxLoads);
      }

      let suggestion: string | null = null;
      if (vm.ex.scheme === 'wave' && maxLoads.length > 0) {
        const lastMax = maxLoads[maxLoads.length - 1];
        const suggested = lastMax + 2.5;
        suggestion = `Prova <b>${suggested} kg</b> — +2.5 kg rispetto all'ultima volta`;
      }

      if (lastText || sparkSvg || suggestion) {
        vm.insight = { lastText, sparkSvg, delta, deltaClass, suggestion };
        vm.insightVisible = true;
      }

      if (vm.isFirst && maxLoads.length > 0) {
        const lastMax = maxLoads[maxLoads.length - 1];
        const baseReps = parseInt(vm.rows[0]?.ripPlaceholder ?? '', 10);
        if (!isNaN(baseReps)) {
          const round5 = (kg: number) => Math.round(kg / 5) * 5;
          const w1 = round5(lastMax * 0.4);
          const w2 = round5(lastMax * 0.6);
          const w3 = round5(lastMax * 0.8);
          const r1 = Math.round(baseReps * 0.4);
          const r2 = Math.round(baseReps * 0.6);
          const r3 = Math.round(baseReps * 0.8);
          vm.warmup = `Riscaldamento: <b>${w1} kg</b> x${r1}, <b>${w2} kg</b> x${r2}, <b>${w3} kg</b> x${r3}`;
        }
      }
    });
  }

  toggleEx(vm: ExerciseVM): void {
    vm.open = !vm.open;
  }

  onSliderScroll(): void {
    if (this.scrollTicking) return;
    this.scrollTicking = true;
    requestAnimationFrame(() => {
      this.scrollTicking = false;
      const el = this.sliderEl?.nativeElement;
      if (!el) return;
      const closest = findClosestSlideIndex(el);
      if (closest !== this.sliderIndex) {
        this.sliderIndex = closest;
        this.cdr.detectChanges();
      }
    });
  }

  scrollToIndex(idx: number): void {
    scrollToSlide(this.sliderEl?.nativeElement, idx);
  }

  /** Esercizio attualmente visibile nello slider, oppure -1 sulle due card di
   *  sessione: i pallini sono uno per esercizio, quindi li' nessuno e' attivo. */
  get exerciseSlideIndex(): number {
    return this.sliderIndex - 1;
  }

  /** Tap su un pallino: l'esercizio i-esimo e' la slide i+1 (la 0 e' "Avvia sessione"). */
  scrollToExercise(i: number): void {
    this.scrollToIndex(i + 1);
  }

  onSetCheck(vm: ExerciseVM, rowIdx: number): void {
    vm.rows[rowIdx].done = !vm.rows[rowIdx].done;
    this.scheduleDraft();
    if (vm.rows[rowIdx].done) {
      this.state.startRestTimer(vm.restSeconds, this.restKey(vm.ex.name));
    }
  }

  onInput(): void {
    this.scheduleDraft();
  }

  private scheduleDraft(): void {
    if (this.draftTimer) clearTimeout(this.draftTimer);
    this.draftTimer = setTimeout(() => this.saveDraft(), 500);
  }

  private saveDraft(): void {
    const data = this.exercises.map(vm => ({ rows: vm.rows }));
    this.appState.patchField(`workoutDrafts.${this.day.id}`, data);
  }

  getDoneCount(vm: ExerciseVM): number {
    return vm.rows.filter(r => r.done).length;
  }

  isComplete(vm: ExerciseVM): boolean {
    return vm.rows.length > 0 && vm.rows.every(r => r.done);
  }

  getMuscleInfo(muscle: string) {
    return this.workoutData.MUSCLES[muscle] ?? { color: '#64D2FF', dim: 'rgba(100,210,255,0.16)' };
  }

  getMuscleIcon(muscle: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(
      this.workoutData.MUSCLE_ICONS[muscle] ?? this.workoutData.MUSCLE_ICONS['Core']
    );
  }

  openRestModal(vm: ExerciseVM, event: Event): void {
    event.stopPropagation();
    this.restModalVm = vm;
    this.restModalValue = vm.restSeconds;
    this.restModalOpen = true;
  }

  closeRestModal(): void {
    this.restModalOpen = false;
  }

  onRestOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('resttimer-sheet-overlay')) {
      this.closeRestModal();
    }
  }

  adjustRestModalValue(delta: number): void {
    this.restModalValue = Math.min(600, Math.max(5, this.restModalValue + delta));
  }

  resetRestModalToDefault(): void {
    if (!this.restModalVm) return;
    this.restModalValue = this.parseRecSeconds(this.day.rec);
  }

  async saveRestModal(): Promise<void> {
    if (!this.restModalVm) return;
    this.restModalVm.restSeconds = this.restModalValue;
    await this.appState.patchField(`restOverrides.${this.restKey(this.restModalVm.ex.name)}`, this.restModalValue);
    this.closeRestModal();
    this.cdr.detectChanges();
  }

  /** Wrapper pubblico per il template: default del protocollo per il giorno corrente. */
  parseRecSecondsPublic(): number {
    return this.parseRecSeconds(this.day.rec);
  }

  formatRest(seconds: number): string {
    if (seconds % 60 === 0) return `${seconds / 60}:00`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`;
  }

  /** true se esiste una sessione in corso, ma su un giorno diverso da questo. */
  get hasOtherSession(): boolean {
    const s = this.sessionState.activeSession();
    return !!s && s.dayId !== this.day.id;
  }

  /** Indice del giorno su cui e' in corso la sessione, per il link "vai alla sessione".
   *  null se la sessione e' su questo giorno, assente, oppure se il suo dayId non
   *  esiste piu' nel protocollo attuale (protocollo cambiato dopo l'avvio). */
  get otherSessionDayIndex(): number | null {
    const s = this.sessionState.activeSession();
    if (!s || s.dayId === this.day.id) return null;
    const idx = this.workoutData.days.findIndex(d => d.id === s.dayId);
    return idx >= 0 ? idx : null;
  }

  get endButtonLabel(): string {
    switch (this.state.saveStatus()) {
      case 'saving': return 'Salvataggio…';
      case 'saved': return 'Salvato ✓';
      case 'err': return 'Errore, riprova';
      default: return 'Termina e salva';
    }
  }

  startSession(): void {
    this.sessionState.start(this.day.id);
  }

  goToOtherSession(): void {
    const idx = this.otherSessionDayIndex;
    if (idx === null) return;
    this.router.navigate(['/scheda/day', idx]);
  }

  async cancelSession(): Promise<void> {
    const ok = await this.confirm.confirm(
      'Vuoi annullare la sessione in corso? Il tempo verra\' perso e l\'allenamento non verra\' salvato nello storico.',
      { confirmLabel: 'Annulla sessione', dangerous: true }
    );
    if (!ok) return;
    this.sessionState.cancel();
    this.cdr.detectChanges();
  }

  async saveWorkout(): Promise<void> {
    if (this.state.saveStatus() === 'saving') return; // evita doppio invio mentre e' gia' in corso
    // Il salvataggio esiste solo come chiusura di una sessione avviata su questo giorno.
    if (!this.sessionState.isActiveForDay(this.day.id)) return;
    this.state.saveStatus.set('saving');
    if (this.draftTimer) { clearTimeout(this.draftTimer); this.draftTimer = null; }

    const isoDate = todayLocalISO();
    // Durata letta PRIMA del salvataggio: la sessione viene chiusa solo a
    // salvataggio riuscito, cosi' un errore di rete non la distrugge.
    const durationSec = this.sessionState.elapsedSec();
    const session: WorkoutSession = {
      dayId: this.day.id,
      dayLabel: this.day.label,
      date: isoDate,
      exercises: this.exercises.map(vm => ({
        name: vm.ex.name,
        sets: vm.rows.map(r => ({ load: r.load || null, reps: r.reps || null, done: r.done }))
      })),
      durationSec
    };

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 12000)
    );

    try {
      const ok = await Promise.race([this.sessions.save(session), timeout]);
      if (ok) {
        await this.appState.deleteFieldPath(`workoutDrafts.${this.day.id}`);
        this.sessionState.finish();
        this.state.saveStatus.set('saved');
        this.toast.success('Allenamento salvato ✓');
      } else {
        this.state.saveStatus.set('err');
        this.toast.error('Errore durante il salvataggio. Riprova.');
      }
    } catch (e: any) {
      console.error('Errore salvataggio allenamento:', e);
      this.state.saveStatus.set('err');
      this.toast.error('Errore durante il salvataggio. Riprova.');
    } finally {
      setTimeout(() => this.state.saveStatus.set('idle'), 2000);
    }
  }
}
