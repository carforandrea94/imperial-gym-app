import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { MeasurementDataService } from '../../services/measurement-data.service';
import { computeBmi, bmiClass, formatBmi, BMI_CLASS_LABELS } from '../../core/utils/bmi.util';
import { formatHeightCm } from '../../core/utils/height.util';

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
    .formatile-val .u {
      font-family: 'IBM Plex Mono', monospace; font-size: var(--text-xs);
      font-weight: 500; color: var(--label-3);
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
  /** Differenza con la pesata precedente. null alla prima pesata, dove non
   *  c'e' niente con cui confrontarsi. */
  weightDelta: number | null = null;

  constructor(
    private auth: AuthService,
    private measures: MeasurementDataService
  ) {}

  ngOnInit(): void {
    this.measures.loadHistory()
      .then(history => {
        const pesi = history
          .map(e => this.measures.parseMeasureValue(e.peso))
          .filter((n): n is number => n !== null);
        if (!pesi.length) return;
        this.weightKg.set(pesi[0]);
        // loadHistory ordina dalla piu' recente: la precedente e' la seconda.
        this.weightDelta = pesi.length > 1
          ? Math.round((pesi[0] - pesi[1]) * 10) / 10
          : null;
      })
      .catch(e => console.error('Lettura delle misure per la scheda fallita:', e));
  }

  get heightCm(): number | null {
    return this.auth.currentUser()?.heightCm ?? null;
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
    return `${BMI_CLASS_LABELS[bmiClass(b)]} · su ${formatHeightCm(this.heightCm)} cm`;
  }
}
