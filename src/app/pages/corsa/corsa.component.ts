import { Component, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { RunningStateService } from '../../services/running-state.service';
import { RunsService } from '../../services/runs.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';
import { RUN_TYPE_LABELS, RUN_EFFORT_LABELS, hasRunGoal, Run } from '../../models/run.model';
import { formatKm, formatPace, formatDuration, goalPct, paceSecPerKm } from '../../core/utils/run-math.util';
import { mondayISO, todayLocalISO } from '../../core/utils/date.util';

/** Una riga dell'elenco: l'uscita piu' quello che serve a disegnarla, gia' pronto. */
interface RunRow {
  id: string;
  run: Run;
  dayLabel: string;
  km: string;
  duration: string;
  pace: string;
  typeLabel: string;
  effortLabel: string;
}

const WEEKDAYS = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

@Component({
  selector: 'app-corsa',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './corsa.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class CorsaComponent implements OnInit {

  readonly hasGoal = computed(() => hasRunGoal(this.state.goal()));

  /** Uscite di questa settimana, gia' formattate. */
  readonly weekRows = computed<RunRow[]>(() => this.state.thisWeekRuns().map(r => this.toRow(r.id, r.run)));

  /** Tutto il resto dello storico, dalla piu' recente. */
  readonly pastRows = computed<RunRow[]>(() => {
    const start = this.state.weekStart();
    return this.state.runs()
      .filter(r => mondayISO(r.run.date) !== start)
      .map(r => this.toRow(r.id, r.run));
  });

  constructor(
    public state: RunningStateService,
    private runsSvc: RunsService,
    private router: Router,
    private confirm: ConfirmDialogService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    // L'obiettivo arriva dal protocollo, gia' caricato da clientGuard prima che
    // questa route si attivi: qui restano solo le uscite. Vivono nel servizio e
    // non nella pagina, cosi' se la pagina viene ricreata (ritorno sulla
    // sezione, rinnovo del token) i totali restano a schermo durante la
    // rilettura invece di sparire e ricomparire.
    this.state.refresh();
  }

  // --- Obiettivo settimanale -------------------------------------------------

  get kmPct(): number { return goalPct(this.state.thisWeek().km, this.state.goal()?.weeklyKm ?? 0); }
  get runsPct(): number { return goalPct(this.state.thisWeek().runs, this.state.goal()?.weeklyRuns ?? 0); }

  get kmDone(): string { return formatKm(this.state.thisWeek().km); }
  get kmTarget(): string { return formatKm(this.state.goal()?.weeklyKm ?? 0); }

  get weekPace(): string {
    const pace = formatPace(this.state.thisWeek().paceSecPerKm);
    return pace ? `${pace} /km` : '—';
  }

  get weekTime(): string {
    const sec = this.state.thisWeek().durationSec;
    return sec > 0 ? formatDuration(sec) : '—';
  }

  /** Intervallo della settimana in corso, es. "8 – 14 set". */
  get weekLabel(): string {
    const start = new Date(this.state.weekStart() + 'T00:00:00');
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const sameMonth = start.getMonth() === end.getMonth();
    const left = sameMonth ? `${start.getDate()}` : `${start.getDate()} ${MONTHS[start.getMonth()]}`;
    return `${left} – ${end.getDate()} ${MONTHS[end.getMonth()]}`;
  }

  // --- Azioni ----------------------------------------------------------------

  addRun(): void {
    this.router.navigate(['/corsa/nuova']);
  }

  editRun(id: string): void {
    this.router.navigate(['/corsa/nuova'], { queryParams: { id } });
  }

  async removeRun(row: RunRow, event: Event): Promise<void> {
    event.stopPropagation();
    const ok = await this.confirm.confirm(`Eliminare l'uscita di ${row.dayLabel} (${row.km} km)?`);
    if (!ok) return;

    if (await this.runsSvc.delete(row.id)) {
      await this.state.refresh();
      this.toast.success('Uscita eliminata');
    } else {
      this.toast.error('Eliminazione non riuscita. Controlla la connessione.');
    }
  }

  // --- Formattazione ---------------------------------------------------------

  private toRow(id: string, run: Run): RunRow {
    return {
      id,
      run,
      dayLabel: this.dayLabel(run.date),
      km: formatKm(run.distanceKm),
      duration: formatDuration(run.durationSec),
      pace: formatPace(paceSecPerKm(run.distanceKm, run.durationSec)),
      typeLabel: RUN_TYPE_LABELS[run.type] ?? '',
      effortLabel: RUN_EFFORT_LABELS[run.effort] ?? ''
    };
  }

  /** "oggi" / "ieri" quando serve, altrimenti "lun 8 set". */
  private dayLabel(dateISO: string): string {
    const today = todayLocalISO();
    if (dateISO === today) return 'Oggi';
    const d = new Date(dateISO + 'T00:00:00');
    const yesterday = new Date(today + 'T00:00:00');
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.getTime() === yesterday.getTime()) return 'Ieri';
    return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  }
}
