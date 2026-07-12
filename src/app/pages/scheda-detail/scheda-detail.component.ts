import { Component, OnInit, OnDestroy, ChangeDetectorRef, ElementRef, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { WorkoutDataService } from '../../services/workout-data.service';
import { WorkoutStateService } from '../../services/workout-state.service';
import { AppStateService, WorkoutDraftRow } from '../../services/app-state.service';
import { WorkoutSessionsService } from '../../services/workout-sessions.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { Day, Exercise, WorkoutSession, ExInsight } from '../../models/workout.model';
import { todayLocalISO } from '../../core/utils/date.util';

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
}

@Component({
  selector: 'app-scheda-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './scheda-detail.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class SchedaDetailComponent implements OnInit, OnDestroy {
  day!: Day;
  dayIndex = 0;
  exercises: ExerciseVM[] = [];
  loading = true;
  errorMsg = '';
  private draftTimer: ReturnType<typeof setTimeout> | null = null;

  restModalOpen = false;
  restModalVm: ExerciseVM | null = null;
  restModalValue = 90;

  sliderIndex = 0;
  private scrollTicking = false;

  @ViewChild('sliderEl') sliderEl?: ElementRef<HTMLDivElement>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public workoutData: WorkoutDataService,
    public state: WorkoutStateService,
    private appState: AppStateService,
    private sessions: WorkoutSessionsService,
    private confirm: ConfirmDialogService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
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
    const n = parseInt(this.route.snapshot.paramMap.get('n') ?? '0', 10);
    this.dayIndex = n;
    this.day = this.workoutData.days[n];
    if (!this.day) { this.router.navigate(['/scheda']); return; }

    this.state.registerSaveHandler(() => this.saveWorkout());
    this.loadAll();
  }

  // Aspetta bozze/override/insight da Firestore prima di mostrare le card,
  // cosi' non compaiono prima con dati incompleti (peso pre-compilato,
  // "Ultimo", suggerimento di progressione) e poi si aggiornano di scatto.
  async loadAll(): Promise<void> {
    this.loading = true;
    this.errorMsg = '';

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 12000)
    );

    try {
      const [appState, daySessions] = await Promise.race([
        Promise.all([this.appState.load(), this.sessions.listForDay(this.day.id)]),
        timeout
      ]);
      this.buildExercises(appState.restOverrides);
      this.loadDraft(appState.workoutDrafts[this.day.id]);
      this.loadInsights(daySessions);
    } catch (e: any) {
      console.error('Errore caricamento scheda:', e);
      this.errorMsg = e?.message === 'TIMEOUT'
        ? 'La connessione sta impiegando troppo tempo. Controlla la rete e riprova.'
        : 'Errore nel caricamento della scheda. Riprova.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  ngOnDestroy(): void {
    if (this.draftTimer) clearTimeout(this.draftTimer);
    this.state.registerSaveHandler(null);
  }

  private buildExercises(restOverrides: Record<string, number>): void {
    const week = this.state.currentWeek;
    const protocolDefault = this.parseRecSeconds(this.day.rec);
    this.exercises = this.day.ex.map(ex => {
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
      return { ex, rows, open: true, insightVisible: false, insight: null, restSeconds };
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

  private restKey(exName: string): string {
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
      const children = Array.from(el.children) as HTMLElement[];
      let closest = 0;
      let minDist = Infinity;
      children.forEach((child, idx) => {
        const dist = Math.abs(child.offsetLeft - el.scrollLeft);
        if (dist < minDist) { minDist = dist; closest = idx; }
      });
      if (closest !== this.sliderIndex) {
        this.sliderIndex = closest;
        this.cdr.detectChanges();
      }
    });
  }

  scrollToIndex(idx: number): void {
    const el = this.sliderEl?.nativeElement;
    const child = el?.children[idx] as HTMLElement | undefined;
    child?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  onSetCheck(vm: ExerciseVM, rowIdx: number): void {
    vm.rows[rowIdx].done = !vm.rows[rowIdx].done;
    this.scheduleDraft();
    if (vm.rows[rowIdx].done) {
      this.state.startRestTimer(vm.restSeconds);
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
    this.restModalVm = null;
  }

  onRestOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('confirmoverlay')) {
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

  async saveWorkout(): Promise<void> {
    if (this.state.saveStatus() === 'saving') return; // evita doppio invio mentre e' gia' in corso
    this.state.saveStatus.set('saving');
    if (this.draftTimer) { clearTimeout(this.draftTimer); this.draftTimer = null; }

    const isoDate = todayLocalISO();
    const session: WorkoutSession = {
      dayId: this.day.id,
      dayLabel: this.day.label,
      date: isoDate,
      exercises: this.exercises.map(vm => ({
        name: vm.ex.name,
        sets: vm.rows.map(r => ({ load: r.load || null, reps: r.reps || null, done: r.done }))
      }))
    };

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 12000)
    );

    try {
      const ok = await Promise.race([this.sessions.save(session), timeout]);
      if (ok) {
        await this.appState.deleteFieldPath(`workoutDrafts.${this.day.id}`);
        this.state.saveStatus.set('saved');
      } else {
        this.state.saveStatus.set('err');
      }
    } catch (e: any) {
      console.error('Errore salvataggio allenamento:', e);
      this.state.saveStatus.set('err');
    } finally {
      setTimeout(() => this.state.saveStatus.set('idle'), 2000);
    }
  }
}
