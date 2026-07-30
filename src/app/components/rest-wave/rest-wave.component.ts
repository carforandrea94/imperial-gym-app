import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkoutStateService } from '../../services/workout-state.service';

const BAR_COUNT = 72;
const BAR_MIN_PX = 3;
const BAR_MAX_PX = 18;

/**
 * Sagoma dell'onda, in pixel di altezza per ogni tacchetta.
 *
 * E' la somma di tre sinusoidi con frequenze non multiple fra loro: le creste
 * risultano irregolari, come in un tracciato registrato, invece di ripetersi
 * identiche. Viene calcolata una volta sola all'avvio dell'app perche' l'onda
 * e' ferma: durante il recupero non cambia mai forma, cambia solo quante
 * tacchette restano accese. Niente animazione continua, quindi nessun costo
 * di batteria e nessun caso speciale per chi ha ridotto le animazioni.
 */
const WAVE_BARS: number[] = Array.from({ length: BAR_COUNT }, (_, i) => {
  const x = i / (BAR_COUNT - 1);
  const v = Math.sin(x * 22) * 0.55 + Math.sin(x * 7.3 + 1.1) * 0.30 + Math.sin(x * 41 + 2.7) * 0.15;
  return BAR_MIN_PX + Math.abs(v) * (BAR_MAX_PX - BAR_MIN_PX);
});

/**
 * Timer di recupero disegnato dentro la card dell'esercizio da cui e' partito.
 * Non mostra nulla per gli altri esercizi: e' `exKey` a decidere quale card lo
 * ospita, confrontandosi con quello salvato all'avvio del timer.
 */
@Component({
  selector: 'app-rest-wave',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="restwave" *ngIf="active" [class.finished]="svc.restTimer().finished">
      <div class="restwave-bars">
        <span *ngFor="let h of bars; let i = index"
          [style.height.px]="h"
          [class.on]="svc.restTimer().finished || i < litCount"></span>
      </div>
      <div class="restwave-row">
        <span class="restwave-label">
          {{ svc.restTimer().finished ? 'Recupero finito — vai!' : 'Recupero' }}
        </span>
        <span class="restwave-time">
          {{ svc.restTimer().finished ? '✓' : svc.formatTime(svc.restTimer().remaining) }}
        </span>
        <button class="restwave-x" (click)="stop()" aria-label="Ferma il recupero">✕</button>
      </div>
    </div>
  `,
  styles: [`:host { display: block; }`]
})
export class RestWaveComponent {
  @Input({ required: true }) exKey!: string;

  bars = WAVE_BARS;

  constructor(public svc: WorkoutStateService) {}

  get active(): boolean {
    const timer = this.svc.restTimer();
    return timer.show && timer.exKey === this.exKey;
  }

  /** Quante tacchette restano accese: la parte gia' consumata si spegne da sinistra. */
  get litCount(): number {
    return Math.ceil((this.svc.restTimer().fillPct / 100) * BAR_COUNT);
  }

  stop(): void {
    this.svc.stopRestTimer();
  }
}
