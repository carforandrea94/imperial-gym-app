import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef, ElementRef, Renderer2, ViewChild, effect } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { WorkoutDataService } from '../../services/workout-data.service';
import { WorkoutStateService } from '../../services/workout-state.service';
import { AppStateService, WorkoutDraftRow } from '../../services/app-state.service';
import { buildSessionSummary, SessionSummary } from '../../core/utils/session-summary.util';
import { sessionTonnage, formatKg } from '../../core/utils/tonnage.util';
import { WorkoutSessionsService } from '../../services/workout-sessions.service';
import { WorkoutSessionStateService } from '../../services/workout-session-state.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { Day, Exercise, WorkoutSession, ExInsight } from '../../models/workout.model';
import { todayLocalISO } from '../../core/utils/date.util';
import { findClosestSlideIndex, scrollToSlide } from '../../core/utils/horizontal-slider.util';
import { PerformedSet, suggestLoad } from '../../core/utils/load-estimate.util';
import { ToastService } from '../../services/toast.service';

/** Passo di arrotondamento del carico consigliato: i dischi da 2,5 kg per lato. */
const LOAD_STEP_KG = 5;

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
  /**
   * La serie su cui si sta lavorando: e' l'unica aperta, con i comandi grandi.
   * Le altre stanno in una riga sola. null quando non ce n'e' nessuna da fare
   * e l'utente non ne ha riaperta una.
   */
  activeRow: number | null;
  insightVisible: boolean;
  insight: ExInsight | null;
  restSeconds: number;
  isFirst: boolean;
  warmup: string | null;
}

@Component({
  selector: 'app-scheda-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
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
  /** Le sedute gia' salvate di questo giorno, dalla piu' vecchia: servono ai
   *  suggerimenti e, a fine allenamento, al confronto del riepilogo. */
  private daySessions: WorkoutSession[] = [];
  /** Il resoconto dell'allenamento appena chiuso. Finche' e' null si sta
   *  ancora allenando; quando c'e', la pagina mostra lui. */
  summary: SessionSummary | null = null;

  restModalOpen = false;
  restModalVm: ExerciseVM | null = null;
  restModalValue = 90;

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
      // La fascia del recupero si vede solo dentro l'allenamento in corso: un
      // timer partito su un altro giorno resterebbe acceso senza essere
      // disegnato da nessuna parte, e senza modo di fermarlo.
      const timer = this.state.restTimer();
      if (timer.show && timer.dayId !== this.day.id) this.state.stopRestTimer();
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
      this.daySessions = daySessions.map(d => d.session);
      this.loadInsights(daySessions);
      this.exercises.forEach(vm => this.syncActiveRow(vm));
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
      return { ex, rows, open: true, activeRow: 0, insightVisible: false, insight: null, restSeconds, isFirst: exIdx === 0, warmup: null };
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

  /** Chiave stabile dell'esercizio nel giorno, per l'override del recupero
   *  salvato sull'account. */
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
      // Carico e ripetizioni della stessa serie vanno tenuti insieme: e' la
      // coppia, non il solo carico, a dire quanto e' stato faticoso.
      const performed: PerformedSet[] = [];

      sessions.forEach(s => {
        const sexData = s.exercises.find(e => e.name === exName);
        if (!sexData) return;
        const loads = sexData.sets.map(sr => parseFloat(sr.load ?? '') || 0);
        const maxLoad = Math.max(...loads.filter(l => l > 0));
        if (maxLoad > 0) maxLoads.push(maxLoad);
        sexData.sets.forEach(sr => {
          const load = parseFloat(sr.load ?? '');
          const reps = parseFloat(sr.reps ?? '');
          if (load > 0 && reps > 0) performed.push({ load, reps });
        });
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

      // Il carico da provare dipende dalle ripetizioni previste oggi: lo stesso
      // peso di un 5x6 non regge in un 4x10. Si passa dal massimale stimato
      // (vedi load-estimate.util) e vale per qualsiasi schema, non solo wave.
      let suggestion: string | null = null;
      const targetReps = parseInt(vm.rows[0]?.ripPlaceholder ?? '', 10);
      const advice = isNaN(targetReps) ? null : suggestLoad(performed, targetReps, LOAD_STEP_KG);
      if (advice) {
        suggestion = `Prova <b>${advice.load} kg</b> per ${targetReps} rip.`
          + ` — dal tuo ${advice.from.load} kg × ${advice.from.reps}`;
      }

      if (lastText || suggestion) {
        vm.insight = { lastText, suggestion };
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

  onSetCheck(vm: ExerciseVM, rowIdx: number): void {
    // La spunta e' un div, non un <button>: "disabilitato" non esiste per lui e
    // il click arriva comunque. Il controllo vero sta qui.
    if (this.setsLocked) return;
    const row = vm.rows[rowIdx];
    row.done = !row.done;

    // Spuntare la serie e' il momento in cui i suggerimenti diventano valori
    // veri: il carico dell'ultima volta e le ripetizioni del protocollo entrano
    // nei campi e finiscono nello storico. Vale solo qui, perche' una serie non
    // spuntata non e' stata fatta e non deve portarsi dietro un carico. Solo i
    // campi vuoti: quello che hai digitato non si tocca.
    if (row.done) {
      if (!row.reps && row.ripPlaceholder) row.reps = row.ripPlaceholder;
      if (!row.load && row.loadPlaceholder) row.load = row.loadPlaceholder;
    }

    this.scheduleDraft();
    if (row.done) {
      this.state.startRestTimer(vm.restSeconds, vm.ex.name, this.day.id);
    }
  }

  // ---- La serie corrente ----

  /**
   * Porta la riga aperta sulla prima ancora da fare. Chiamata dopo ogni
   * cambiamento: se l'utente aveva aperto una riga gia' spuntata per
   * correggerla, quella resta dov'e' finche' non la chiude lui.
   */
  private syncActiveRow(vm: ExerciseVM): void {
    const next = vm.rows.findIndex(r => !r.done);
    vm.activeRow = next === -1 ? null : next;
  }

  /** Apre una riga per lavorarci: e' l'unica che mostra i comandi. */
  setActive(vm: ExerciseVM, rowIdx: number): void {
    if (this.setsLocked) return;
    vm.activeRow = vm.activeRow === rowIdx ? null : rowIdx;
  }

  /**
   * Il valore su cui si muovono i tasti: quello digitato, oppure il
   * suggerimento. Senza questo, il primo tocco di "+" partirebbe da zero e
   * butterebbe via il carico proposto.
   */
  private valueOf(raw: string, placeholder: string): number {
    const n = parseFloat((raw || placeholder || '').replace(',', '.'));
    return isFinite(n) ? n : 0;
  }

  private write(n: number): string {
    return (Math.round(n * 100) / 100).toString().replace('.', ',');
  }

  adjustLoad(vm: ExerciseVM, rowIdx: number, delta: number): void {
    if (this.setsLocked) return;
    const row = vm.rows[rowIdx];
    const next = Math.max(0, this.valueOf(row.load, row.loadPlaceholder) + delta);
    row.load = next === 0 ? '' : this.write(next);
    this.scheduleDraft();
  }

  adjustReps(vm: ExerciseVM, rowIdx: number, delta: number): void {
    if (this.setsLocked) return;
    const row = vm.rows[rowIdx];
    const next = Math.max(0, this.valueOf(row.reps, row.ripPlaceholder) + delta);
    row.reps = next === 0 ? '' : this.write(next);
    this.scheduleDraft();
  }

  /** Il passo del carico: mezzo disco piccolo per lato, che e' il salto vero
   *  in palestra. Le ripetizioni vanno di una. */
  readonly loadStep = 2.5;

  /** Chiude la serie aperta e passa alla prossima da fare. */
  confirmSet(vm: ExerciseVM, rowIdx: number): void {
    if (this.setsLocked || vm.rows[rowIdx].done) return;
    this.onSetCheck(vm, rowIdx);
    this.syncActiveRow(vm);
  }

  /** Toglie la spunta e riapre quella riga: e' li' che si sta correggendo. */
  undoSet(vm: ExerciseVM, rowIdx: number): void {
    if (this.setsLocked || !vm.rows[rowIdx].done) return;
    this.onSetCheck(vm, rowIdx);
    vm.activeRow = rowIdx;
  }

  /** La riga chiusa in una riga sola: "10 × 80 kg". */
  rowSummary(row: SerieRow): string {
    const reps = row.reps || row.ripPlaceholder;
    const load = row.load || row.loadPlaceholder;
    if (row.done) {
      if (reps && load) return `${reps} × ${load} kg`;
      if (reps) return `${reps} rip.`;
      return load ? `${load} kg` : 'fatta';
    }
    return 'da fare';
  }

  loadFor(row: SerieRow): string {
    return row.load || row.loadPlaceholder || '0';
  }

  repsFor(row: SerieRow): string {
    return row.reps || row.ripPlaceholder || '0';
  }

  // ---- La chiusura dell'allenamento ----

  /** Il volume gia' accumulato, per la card di chiusura. */
  get liveVolumeKg(): string {
    return formatKg(sessionTonnage({
      dayId: this.day?.id ?? '', dayLabel: '', date: '',
      exercises: this.exercises.map(vm => ({
        name: vm.ex.name,
        sets: vm.rows.map(r => ({ load: r.load || null, reps: r.reps || null, done: r.done }))
      }))
    }));
  }

  get doneSets(): number {
    return this.exercises.reduce((tot, vm) => tot + vm.rows.filter(r => r.done).length, 0);
  }

  get totalSets(): number {
    return this.exercises.reduce((tot, vm) => tot + vm.rows.length, 0);
  }

  get closingTitle(): string {
    if (this.allSetsDone) return 'Hai finito';
    return this.doneSets === 0 ? 'Non hai ancora spuntato niente' : 'Sei a buon punto';
  }

  formatDuration(seconds: number): string {
    return this.sessionState.formatDuration(seconds);
  }

  /** Il volume del riepilogo, gia' scritto. */
  summaryVolume(kg: number): string {
    return formatKg(kg);
  }

  summaryDelta(kg: number): string {
    return (kg > 0 ? '+' : '−') + formatKg(Math.abs(kg));
  }

  summaryPrevDate(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  backToScheda(): void {
    this.router.navigate(['/scheda']);
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
    this.appState.patchField(`workoutDrafts.${this.day.id}`, data).catch(() => { /* gia' segnalato da AppStateService */ });
  }

  getDoneCount(vm: ExerciseVM): number {
    return vm.rows.filter(r => r.done).length;
  }

  /** Quanto dell'anello del badge e' chiuso, in centesimi: il tracciato e'
   *  normalizzato con pathLength=100, quindi qui non serve sapere quanto
   *  misuri davvero il perimetro di un rettangolo smussato. */
  donePct(vm: ExerciseVM): number {
    return vm.rows.length ? (this.getDoneCount(vm) / vm.rows.length) * 100 : 0;
  }

  isComplete(vm: ExerciseVM): boolean {
    return vm.rows.length > 0 && vm.rows.every(r => r.done);
  }

  getMuscleInfo(muscle: string) {
    return this.workoutData.MUSCLES[muscle] ?? { color: '#64D2FF', dim: 'rgba(100,210,255,0.16)' };
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
    if ((event.target as HTMLElement).classList.contains('bottomsheet-overlay')) {
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

  /** La sessione in corso appartiene a QUESTO allenamento: stesso id e stessa
   *  etichetta. Se il protocollo e' cambiato sotto i piedi, l'id da solo
   *  mentirebbe (vedi matchesDay nel servizio). */
  get isSessionOnThisDay(): boolean {
    return this.sessionState.matchesDay(this.day.id, this.day.label);
  }

  /** true se esiste una sessione in corso che non e' di questo allenamento. */
  get hasOtherSession(): boolean {
    return !!this.sessionState.activeSession() && !this.isSessionOnThisDay;
  }

  /** Indice del giorno su cui e' in corso la sessione, per il link "vai alla sessione".
   *  null se la sessione e' su questo giorno, assente, oppure se il suo dayId non
   *  esiste piu' nel protocollo attuale (protocollo cambiato dopo l'avvio). */
  get otherSessionDayIndex(): number | null {
    const s = this.sessionState.activeSession();
    if (!s || this.isSessionOnThisDay) return null;
    const idx = this.workoutData.days.findIndex(
      d => d.id === s.dayId && (!s.dayLabel || d.label === s.dayLabel)
    );
    return idx >= 0 ? idx : null;
  }

  /** Etichetta corta: nella barra convive con cronometro e tre comandi.
   *  A sessione avviata dice quanto manca alla chiusura, altrimenti il tasto
   *  salva resterebbe spento senza spiegare perche'. */
  get sessionBarLabel(): string {
    if (this.isSessionOnThisDay) {
      if (this.sessionState.isPaused()) return 'In pausa';
      // Con un errore di caricamento le serie in memoria non ci sono: dire
      // "Completo" sarebbe una bugia, e "mancano 0 serie" pure.
      if (this.errorMsg) return 'In corso';
      const left = this.remainingSets;
      if (left === 0) return 'Completo';
      return left === 1 ? 'Manca 1 serie' : `Mancano ${left} serie`;
    }
    // Sessione avviata su un giorno che il protocollo non ha piu': non e'
    // raggiungibile, l'unica uscita e' annullarla.
    if (this.hasOtherSession) return 'Da chiudere';
    return 'Sessione';
  }

  /**
   * I campi della scheda (ripetizioni, carico, spunta della serie) si
   * compilano solo a sessione avviata su QUESTO giorno.
   *
   * Prima erano sempre aperti, e questo permetteva di registrare un
   * allenamento senza mai far partire il cronometro: la seduta finiva nello
   * storico con una durata che non era mai stata misurata. Vale anche quando
   * la sessione e' aperta su un altro giorno — quei numeri appartengono a
   * quell'allenamento, non a questo.
   *
   * In pausa NON si blocca: una sessione in pausa e' comunque avviata, e
   * bloccare i campi mentre si riprende fiato sarebbe solo un intralcio.
   */
  get setsLocked(): boolean {
    return !this.isSessionOnThisDay;
  }

  get isSessionRunning(): boolean {
    return this.isSessionOnThisDay && !this.sessionState.isPaused();
  }

  get playPauseLabel(): string {
    if (!this.isSessionOnThisDay) return 'Avvia la sessione di allenamento';
    return this.sessionState.isPaused() ? 'Riprendi la sessione' : 'Metti in pausa la sessione';
  }

  /** Nessuna serie lasciata indietro, in nessun esercizio: e' la condizione per
   *  poter chiudere l'allenamento. Contata sulle righe e non su isComplete()
   *  cosi' un esercizio senza serie (schema degenere) non blocca il salvataggio
   *  per sempre; un giorno senza esercizi resta non salvabile. */
  get allSetsDone(): boolean {
    return this.exercises.length > 0 && this.remainingSets === 0;
  }

  /** Quante serie mancano alla chiusura, per dirlo invece di lasciare un tasto spento e muto. */
  get remainingSets(): number {
    return this.exercises.reduce((tot, vm) => tot + vm.rows.filter(r => !r.done).length, 0);
  }

  /** Con un errore di caricamento gli esercizi in memoria sono vuoti o vecchi:
   *  salvare scriverebbe nello storico una seduta sbagliata. Annullare invece
   *  resta possibile, altrimenti la sessione sarebbe in trappola. */
  get canSaveSession(): boolean {
    return this.isSessionOnThisDay && !this.errorMsg && this.state.saveStatus() !== 'saving';
  }

  /** Annulla vale anche per una sessione orfana (giorno sparito dal protocollo):
   *  senza questa via d'uscita non si potrebbe piu' avviarne nessuna. */
  get canCancelSession(): boolean {
    return this.isSessionOnThisDay
      || (this.hasOtherSession && this.otherSessionDayIndex === null);
  }

  /** Etichetta accessibile del tasto salva (il bottone mostra solo l'icona). */
  get saveButtonLabel(): string {
    switch (this.state.saveStatus()) {
      case 'saving': return 'Salvataggio in corso';
      case 'saved': return 'Allenamento salvato';
      case 'err': return 'Errore, riprova a salvare';
    }
    if (this.isSessionOnThisDay && !this.allSetsDone) {
      const left = this.remainingSets;
      return left === 1
        ? 'Termina e salva: manca 1 serie da spuntare, verra\' chiesta conferma'
        : `Termina e salva: mancano ${left} serie da spuntare, verra' chiesta conferma`;
    }
    return 'Termina la sessione e salva l\'allenamento';
  }

  onPlayPause(): void {
    if (!this.sessionState.activeSession()) { this.startSession(); return; }
    if (this.isSessionOnThisDay) this.sessionState.togglePause();
  }

  startSession(): void {
    this.sessionState.start(this.day.id, this.day.label);
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
    if (!this.isSessionOnThisDay) return;

    // Chiudere con delle serie non spuntate e' legittimo (un esercizio saltato,
    // un allenamento interrotto), ma quasi sempre e' una dimenticanza: si chiede
    // conferma invece di bloccare, cosi' la sessione non va persa per forza.
    if (!this.allSetsDone) {
      const left = this.remainingSets;
      const ok = await this.confirm.confirm(
        left === 1
          ? 'Manca 1 serie da spuntare. Vuoi salvare lo stesso l\'allenamento?'
          : `Mancano ${left} serie da spuntare. Vuoi salvare lo stesso l'allenamento?`,
        { confirmLabel: 'Salva lo stesso', dangerous: false }
      );
      if (!ok) return;
      // La conferma e' asincrona: nel frattempo la sessione puo' essere stata
      // annullata o chiusa da un'altra scheda, quindi la guardia va rifatta.
      if (!this.isSessionOnThisDay) return;
      if (this.state.saveStatus() === 'saving') return;
    }

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
        // Il resoconto si costruisce dalla seduta appena scritta e dall'ultima
        // volta che si era fatto LO STESSO giorno: un Giorno 1 di petto e un
        // Giorno 2 di gambe non hanno niente da dirsi.
        this.summary = buildSessionSummary(session, this.daySessions[this.daySessions.length - 1] ?? null);
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
