import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { MeasurementDataService } from '../../services/measurement-data.service';
import { computeBmi, bmiClass, formatBmi, BMI_CLASS_LABELS } from '../../core/utils/bmi.util';
import { formatHeightCm } from '../../core/utils/height.util';
import { Sex } from '../../core/models/user.model';
import { MeasurementEntry } from '../../models/measurement.model';
import {
  bodyFatJp7, meanSide, formatBodyFat, BodyFatResult, JP7_SITE_LABELS
} from '../../core/utils/bodyfat.util';
import { ageOn, todayLocalISO } from '../../core/utils/date.util';
import { rotationTonnage, RotationTonnage, formatKg } from '../../core/utils/tonnage.util';
import { WorkoutSessionsService } from '../../services/workout-sessions.service';
import { WorkoutDataService } from '../../services/workout-data.service';
import { WeeklyProgressService } from '../../services/weekly-progress.service';
import { RunningStateService } from '../../services/running-state.service';

/**
 * Le prime due tessere della scheda riepilogativa: quanto pesi e quanto vale
 * il tuo BMI.
 *
 * Ogni tessera sa mancare. Il peso arriva dallo storico misure, che per un
 * cliente appena iscritto e' vuoto; il BMI ha bisogno anche dell'altezza, che
 * fino a ieri l'app non chiedeva a nessuno — quindi oggi manca a TUTTI i
 * profili esistenti. Una tessera spenta dice cosa le serve e porta dove si
 * rimedia, invece di mostrare un trattino e basta.
 */
@Component({
  selector: 'app-forma-card',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './forma-card.component.html',
  styles: [`
    :host { display: block; }
    .formagrid {
      display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 11px;
      margin-bottom: 12px;
    }
    .formatile {
      display: flex; flex-direction: column; padding: 15px;
      border-radius: var(--r-lg); background: var(--surface-card);
      border: 1px solid var(--border-line); box-shadow: var(--shadow-card);
    }
    .formatile-cap {
      font-family: 'IBM Plex Mono', monospace; font-size: var(--text-2xs);
      font-weight: 600; letter-spacing: .14em; text-transform: uppercase;
      color: var(--label-3);
    }
    .formatile-val { display: flex; align-items: baseline; gap: 4px; margin-top: 9px; }
    .formatile-val .n {
      font-family: 'IBM Plex Mono', monospace; font-size: var(--text-3xl);
      font-weight: 700; letter-spacing: -.02em; line-height: 1; color: var(--label);
    }
    .formatile-val .n.empty { color: var(--label-3); font-weight: 600; }
    /* Una parola non sta alla misura di un numero: "Donna" a --text-3xl
       sfonderebbe la colonna. */
    .formatile-val .n.word { font-size: var(--text-xl); letter-spacing: 0; }
    .formatile-val .u {
      font-family: 'IBM Plex Mono', monospace; font-size: var(--text-xs);
      font-weight: 500; color: var(--label-3);
    }
    /* La massa grassa sta larga quanto la griglia: e' il numero che la scheda
       esiste per dire, e le manca un vicino con cui stare in colonna. */
    .grassocard {
      display: flex; flex-direction: column; padding: 15px; margin-bottom: 12px;
      border-radius: var(--r-lg); background: var(--surface-card);
      border: 1px solid var(--border-line); box-shadow: var(--shadow-card);
    }
    .grassocard-head {
      display: flex; align-items: baseline; justify-content: space-between; gap: 12px;
    }
    .grassocard-head .formatile-val { margin-top: 0; }
    .grassocard-foot {
      font-size: var(--text-2xs); line-height: 1.5; color: var(--label-3);
      margin: 10px 0 0; padding-top: 10px; border-top: 1px solid var(--border-line);
    }
    .tonnrows {
      display: flex; flex-direction: column; gap: 9px;
      padding-top: 12px; margin-top: 13px; border-top: 1px solid var(--border-line);
    }
    .tonnrow { display: flex; align-items: center; gap: 10px; }
    .tonnrow-lbl { font-size: 11.5px; color: var(--label-2); width: 66px; flex-shrink: 0; }
    .tonnrow-bar {
      flex-grow: 1; height: 5px; border-radius: var(--r-pill);
      background: var(--surface-raise); overflow: hidden; display: block;
    }
    .tonnrow-bar > span { display: block; height: 100%; border-radius: var(--r-pill); background: var(--accent); }
    .tonnrow-kg {
      font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; font-weight: 600;
      color: var(--label); width: 76px; text-align: right; flex-shrink: 0;
    }
    .tonnrow-kg.empty { color: var(--label-3); }
    .tonnrow-date {
      font-family: 'IBM Plex Mono', monospace; font-size: var(--text-2xs);
      color: var(--label-3); width: 36px; text-align: right; flex-shrink: 0;
    }
    .formatile-note {
      font-family: 'IBM Plex Mono', monospace; font-size: var(--text-2xs);
      font-weight: 600; color: var(--label-3); margin-top: 6px; line-height: 1.35;
    }
    /* Il richiamo di una tessera spenta e' un link vero, alto abbastanza da
       essere toccato: e' l'unica via d'uscita che la tessera offre. */
    .formatile-link {
      display: inline-flex; align-items: center; min-height: 44px; margin-top: 2px;
      color: var(--accent); font-size: var(--text-xs); font-weight: 600;
      text-decoration: none;
    }
    .formatile-link:hover { text-decoration: underline; }
  `]
})
export class FormaCardComponent implements OnInit {
  /** Ultimo peso registrato. Signal perche' arriva da Firestore e l'app e'
   *  zoneless: un campo semplice non farebbe ridisegnare la tessera. */
  readonly weightKg = signal<number | null>(null);
  /** L'ultima rilevazione con almeno una plica: e' da li' che esce la stima
   *  della massa grassa, e non e' detto sia la stessa della pesata. */
  readonly lastPliche = signal<MeasurementEntry | null>(null);
  /** Differenza con la pesata precedente. null alla prima pesata, dove non
   *  c'e' niente con cui confrontarsi. */
  weightDelta: number | null = null;

  /** Quante sedute sono state salvate in tutto. */
  readonly sessionCount = signal<number | null>(null);
  /** Il giro corrente del programma. null finche' le sedute non sono lette. */
  readonly rotation = signal<RotationTonnage | null>(null);

  constructor(
    private auth: AuthService,
    private measures: MeasurementDataService,
    private sessions: WorkoutSessionsService,
    private workoutData: WorkoutDataService,
    public weekly: WeeklyProgressService,
    public running: RunningStateService
  ) {}

  ngOnInit(): void {
    this.measures.loadHistory()
      .then(history => {
        const pesi = history
          .map(e => this.measures.parseMeasureValue(e.peso))
          .filter((n): n is number => n !== null);
        // Le pliche si leggono comunque: una rilevazione puo' avere le pliche
        // e non il peso, e la stima del grasso non ha bisogno del peso.
        this.lastPliche.set(history.find(e => this.plicheCount(e) > 0) ?? null);
        if (!pesi.length) return;
        this.weightKg.set(pesi[0]);
        // loadHistory ordina dalla piu' recente: la precedente e' la seconda.
        this.weightDelta = pesi.length > 1
          ? Math.round((pesi[0] - pesi[1]) * 10) / 10
          : null;
      })
      .catch(e => console.error('Lettura delle misure per la scheda fallita:', e));

    // Una lettura sola delle sedute serve a tutte e tre le tessere del lavoro.
    this.sessions.listAll()
      .then(rows => {
        this.sessionCount.set(rows.length);
        this.rotation.set(rotationTonnage(rows, this.workoutData.days));
      })
      .catch(e => console.error('Lettura delle sedute per la scheda fallita:', e));

    // Questi due hanno gia' la loro difesa dalle chiamate ravvicinate: se la
    // pagina corsa o la scheda li hanno gia' chiesti, qui non si rilegge.
    this.weekly.refresh().catch(() => {});
    this.running.refresh().catch(() => {});
  }

  // ---- Il lavoro ----

  get daysPlanned(): number {
    return this.workoutData.days.length;
  }

  get daysDone(): number {
    return this.weekly.doneDayIds().size;
  }

  /** I giorni della settimana ancora da fare, per nome. */
  get daysLeftLabel(): string {
    const fatti = this.weekly.doneDayIds();
    const restano = this.workoutData.days.filter(d => !fatti.has(d.id));
    if (!restano.length) return 'settimana chiusa';
    if (restano.length === 1) return `manca ${restano[0].label}`;
    return `ne mancano ${restano.length}`;
  }

  get runMinutes(): number {
    return this.running.thisWeek().minutes;
  }

  get runGoalMinutes(): number {
    return this.running.goal()?.weeklyMinutes ?? 0;
  }

  get runNote(): string {
    const goal = this.runGoalMinutes;
    if (!goal) return `${this.running.thisWeek().runs} uscite questa settimana`;
    const restano = goal - this.runMinutes;
    return restano > 0 ? `obiettivo ${goal} · ne mancano ${restano}` : `obiettivo ${goal} · raggiunto`;
  }

  // ---- Il tonnellaggio ----

  get tonnageTotal(): string {
    const r = this.rotation();
    return r ? formatKg(r.totalKg) : '';
  }

  /** La riga piu' pesante del giro: e' lei a dare la scala alle barre. */
  get tonnageMax(): number {
    const r = this.rotation();
    return r ? Math.max(1, ...r.days.map(d => d.kg ?? 0)) : 1;
  }

  tonnagePct(kg: number | null): number {
    return kg === null ? 0 : (kg / this.tonnageMax) * 100;
  }

  tonnageKg(kg: number | null): string {
    return kg === null ? '—' : formatKg(kg) + ' kg';
  }

  tonnageDate(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  get heightCm(): number | null {
    return this.auth.currentUser()?.heightCm ?? null;
  }

  private plicheCount(e: MeasurementEntry): number {
    const p = this.measures.parseMeasureValue.bind(this.measures);
    return [e.plicaPetto, e.plicaAddome, e.plicaTricipiteSx, e.plicaTricipiteDx,
            e.plicaSottoscapolareSx, e.plicaSottoscapolareDx,
            e.plicaSovrailiacaSx, e.plicaSovrailiacaDx,
            e.plicaAscellareSx, e.plicaAscellareDx,
            e.plicaGambaSx, e.plicaGambaDx]
      .filter(v => p(v) !== null).length;
  }

  /**
   * La stima della massa grassa. I siti bilaterali entrano come media dei due
   * lati, o col solo lato misurato: prendere una plica e' gia' scomodo, chi ne
   * fa una sola non deve perdere l'intera stima.
   */
  get bodyFat(): BodyFatResult {
    const e = this.lastPliche();
    const p = (v: string | null | undefined) => this.measures.parseMeasureValue(v ?? null);
    const sites = e ? {
      petto: p(e.plicaPetto),
      addome: p(e.plicaAddome),
      ascellare: meanSide(p(e.plicaAscellareSx), p(e.plicaAscellareDx)),
      tricipite: meanSide(p(e.plicaTricipiteSx), p(e.plicaTricipiteDx)),
      sottoscapolare: meanSide(p(e.plicaSottoscapolareSx), p(e.plicaSottoscapolareDx)),
      sovrailiaca: meanSide(p(e.plicaSovrailiacaSx), p(e.plicaSovrailiacaDx)),
      gamba: meanSide(p(e.plicaGambaSx), p(e.plicaGambaDx))
    } : {};
    return bodyFatJp7(sites, ageOn(this.birthDate, todayLocalISO()), this.sex);
  }

  get bodyFatLabel(): string {
    const pct = this.bodyFat.pct;
    return pct === null ? '' : formatBodyFat(pct);
  }

  /** Cosa manca alla stima, detto in una riga sola e nell'ordine in cui
   *  conviene rimediare: prima i due dati dichiarati, poi le pliche. */
  get bodyFatMissing(): string {
    const r = this.bodyFat;
    if (r.outOfRange) return 'le pliche registrate sono fuori scala';
    if (r.needsSex && r.needsAge) return 'servono sesso e data di nascita';
    if (r.needsSex) return 'serve il sesso';
    if (r.needsAge) return 'serve la data di nascita';
    if (r.missing.length === 7) return 'servono le sette pliche';
    if (r.missing.length) {
      return 'mancano le pliche: ' + r.missing.map(s => JP7_SITE_LABELS[s]).join(', ');
    }
    return '';
  }

  get bodyFatNeedsProfile(): boolean {
    return this.bodyFat.needsSex || this.bodyFat.needsAge;
  }

  get birthDate(): string | null {
    return this.auth.currentUser()?.birthDate ?? null;
  }

  get plicheDate(): string {
    const iso = this.lastPliche()?.date;
    if (!iso) return '';
    return new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
  }

  get heightLabel(): string {
    return formatHeightCm(this.heightCm);
  }

  get sex(): Sex | null {
    return this.auth.currentUser()?.sex ?? null;
  }

  get sexLabel(): string {
    return this.sex === 'm' ? 'Uomo' : this.sex === 'f' ? 'Donna' : '';
  }

  get weightLabel(): string {
    const kg = this.weightKg();
    return kg === null ? '' : this.measures.formatMeasureNumber(kg);
  }

  get weightDeltaLabel(): string {
    if (this.weightDelta === null) return '';
    if (this.weightDelta === 0) return 'come la volta scorsa';
    const segno = this.weightDelta > 0 ? '+' : '−';
    return `${segno}${this.measures.formatMeasureNumber(Math.abs(this.weightDelta))} kg dall'ultima pesata`;
  }

  get bmi(): number | null {
    return computeBmi(this.weightKg(), this.heightCm);
  }

  get bmiLabel(): string {
    const b = this.bmi;
    return b === null ? '' : formatBmi(b);
  }

  get bmiNote(): string {
    const b = this.bmi;
    if (b === null) return '';
    return BMI_CLASS_LABELS[bmiClass(b)];
  }
}
