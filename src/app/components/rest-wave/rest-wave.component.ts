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
        <div class="restwave-track">
          <span *ngFor="let h of bars" [style.height.px]="h"></span>
        </div>
        <div class="restwave-track lit" [style.clip-path]="fillClip">
          <span *ngFor="let h of bars" [style.height.px]="h"></span>
        </div>
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

  /**
   * Taglio dello strato acceso: la parte gia' consumata viene ritagliata da
   * destra. Il timer batte una volta al secondo, ma la transizione CSS di 1s
   * lineare su `clip-path` copre esattamente l'intervallo fra due battiti, per
   * cui il bordo scorre di continuo invece di saltare da una tacchetta all'altra
   * — senza far ridisegnare nulla a JS.
   */
  get fillClip(): string {
    return `inset(0 ${(100 - this.svc.restTimer().fillPct).toFixed(2)}% 0 0)`;
  }

  stop(): void {
    this.svc.stopRestTimer();
  }
}
