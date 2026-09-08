import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { RunsService } from '../../services/runs.service';
import { RunningStateService } from '../../services/running-state.service';
import { ToastService } from '../../services/toast.service';
import {
  Run, RunType, RunEffort, RUN_TYPE_LABELS, RUN_EFFORT_LABELS
} from '../../models/run.model';
import { parseDistance, parseDuration, formatPace, paceSecPerKm, formatKm } from '../../core/utils/run-math.util';
import { todayLocalISO } from '../../core/utils/date.util';

@Component({
  selector: 'app-corsa-nuova',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './corsa-nuova.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class CorsaNuovaComponent implements OnInit, OnDestroy {

  readonly types = (Object.keys(RUN_TYPE_LABELS) as RunType[]).map(id => ({ id, label: RUN_TYPE_LABELS[id] }));
  readonly efforts = (Object.keys(RUN_EFFORT_LABELS) as RunEffort[]).map(id => ({ id, label: RUN_EFFORT_LABELS[id] }));
  readonly maxDate = todayLocalISO();

  date = todayLocalISO();
  distance = '';
  duration = '';
  type: RunType = 'lento';
  effort: RunEffort = 'giusta';
  note = '';

  /** Id dell'uscita in modifica. null = nuova uscita. */
  editId: string | null = null;
  saving = false;
  errorMsg = '';

  /**
   * Id con cui verra' scritta una nuova uscita, deciso una volta sola.
   * Se il primo salvataggio fallisce e l'utente riprova, la seconda scrittura
   * finisce sullo stesso documento invece di crearne un altro: senza, un
   * tentativo che in realta' era arrivato lascerebbe due uscite uguali.
   */
  private pendingId: string | null = null;

  private paramSub: Subscription | null = null;

  constructor(
    private runsSvc: RunsService,
    private state: RunningStateService,
    private router: Router,
    private route: ActivatedRoute,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // La route viene riusata (DefaultRouteReuseStrategy): con lo snapshot, un
    // secondo ingresso con parametri diversi non verrebbe letto.
    this.paramSub = this.route.queryParamMap.subscribe(params => {
      const id = params.get('id');
      this.editId = id;
      if (id) this.loadForEdit(id);
    });
    // In modifica servono le uscite gia' salvate: se si arriva qui da un link
    // diretto l'elenco puo' essere ancora vuoto.
    if (!this.state.runs().length) this.state.refresh().then(() => {
      if (this.editId) this.loadForEdit(this.editId, true);
    });
  }

  ngOnDestroy(): void {
    this.paramSub?.unsubscribe();
  }

  get title(): string {
    return this.editId ? 'Modifica uscita' : 'Nuova uscita';
  }

  /** Passo calcolato mentre si scrive: e' il numero che dice se i dati inseriti hanno senso. */
  get livePace(): string {
    const pace = formatPace(paceSecPerKm(parseDistance(this.distance), parseDuration(this.duration)));
    return pace ? `${pace} /km` : '—';
  }

  get canSave(): boolean {
    return parseDistance(this.distance) > 0 && parseDuration(this.duration) > 0 && !this.saving;
  }

  async save(): Promise<void> {
    const distanceKm = parseDistance(this.distance);
    const durationSec = parseDuration(this.duration);

    if (distanceKm <= 0) { this.errorMsg = 'Inserisci la distanza in chilometri (es. 8,5).'; return; }
    if (durationSec <= 0) { this.errorMsg = 'Inserisci il tempo (es. 47:12 oppure 47).'; return; }
    if (!this.date) { this.errorMsg = 'Inserisci la data dell\'uscita.'; return; }

    this.errorMsg = '';
    this.saving = true;

    const run: Run = {
      date: this.date,
      distanceKm,
      durationSec,
      type: this.type,
      effort: this.effort,
      note: this.note.trim() || undefined
    };

    // L'id contiene la data, ma resta quello deciso la prima volta anche se
    // poi la data cambia: e' solo una chiave. La data buona sta nel documento
    // ed e' quella che i totali settimanali leggono.
    if (!this.editId) this.pendingId ??= this.runsSvc.newId(this.date);
    const saved = await this.runsSvc.save(run, this.editId ?? this.pendingId!);
    this.saving = false;

    if (!saved) {
      this.errorMsg = 'Salvataggio non riuscito. Controlla la connessione e riprova.';
      // L'app e' zoneless: dopo un await nessuno ridisegna da solo, e senza
      // questo il bottone resterebbe su "Salvataggio…" per sempre — l'errore
      // ci sarebbe, ma solo in memoria. Il toast e' un secondo canale, mosso
      // da un signal, cosi' l'utente se ne accorge comunque.
      this.cdr.detectChanges();
      this.toast.error('Uscita non salvata. Riprova.');
      return;
    }

    await this.state.refresh();
    this.toast.success(this.editId ? 'Uscita aggiornata' : `Registrati ${formatKm(distanceKm)} km`);
    this.router.navigate(['/corsa']);
  }

  private loadForEdit(id: string, redraw = false): void {
    const found = this.state.runs().find(r => r.id === id);
    if (!found) return;
    const run = found.run;
    this.date = run.date;
    this.distance = formatKm(run.distanceKm);
    this.duration = this.durationInput(run.durationSec);
    this.type = run.type;
    this.effort = run.effort;
    this.note = run.note ?? '';
    // Quando i dati arrivano dalla lettura delle uscite siamo fuori da
    // qualsiasi evento: l'app e' zoneless e i campi del form sono proprieta'
    // normali, quindi senza questo il form resterebbe vuoto. Dal ramo
    // sincrono no: siamo gia' dentro un ciclo di rilevamento.
    if (redraw) this.cdr.detectChanges();
  }

  /** Il tempo torna nel campo nella stessa forma in cui si scrive: `m:ss` o `h:mm:ss`. */
  private durationInput(sec: number): string {
    const total = Math.round(sec);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const ss = s.toString().padStart(2, '0');
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${ss}` : `${m}:${ss}`;
  }
}
