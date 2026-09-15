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
import { parseMinutes, formatMinutes } from '../../core/utils/run-math.util';
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
  minutes = '';
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

  /** Come verra' letto il tempo digitato: `1:20` non e' un'ora e venti per tutti. */
  get liveMinutes(): string {
    const min = parseMinutes(this.minutes);
    return min > 0 ? formatMinutes(min) : '—';
  }

  get canSave(): boolean {
    return parseMinutes(this.minutes) > 0 && !this.saving;
  }

  async save(): Promise<void> {
    const durationMin = parseMinutes(this.minutes);

    if (durationMin <= 0) { this.errorMsg = 'Inserisci i minuti corsi (es. 40 oppure 1:20).'; return; }
    if (!this.date) { this.errorMsg = 'Inserisci la data dell\'uscita.'; return; }

    this.errorMsg = '';
    this.saving = true;

    const run: Run = {
      date: this.date,
      durationMin,
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
    this.toast.success(this.editId ? 'Uscita aggiornata' : `Registrati ${formatMinutes(durationMin)}`);
    this.router.navigate(['/corsa']);
  }

  private loadForEdit(id: string, redraw = false): void {
    const found = this.state.runs().find(r => r.id === id);
    if (!found) return;
    const run = found.run;
    this.date = run.date;
    this.minutes = String(run.durationMin);
    this.type = run.type;
    this.effort = run.effort;
    this.note = run.note ?? '';
    // Quando i dati arrivano dalla lettura delle uscite siamo fuori da
    // qualsiasi evento: l'app e' zoneless e i campi del form sono proprieta'
    // normali, quindi senza questo il form resterebbe vuoto. Dal ramo
    // sincrono no: siamo gia' dentro un ciclo di rilevamento.
    if (redraw) this.cdr.detectChanges();
  }

}
