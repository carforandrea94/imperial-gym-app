import { Injectable } from '@angular/core';
import { Day, MuscleInfo, WeekPlan, Exercise } from '../models/workout.model';
import { WorkoutProtocol } from '../models/protocol.model';

@Injectable({ providedIn: 'root' })
export class WorkoutDataService {

  WEEK_PLAN: WeekPlan[] = [
    { sets: 4, reps: 10 },
    { sets: 4, reps: 10 },
    { sets: 4, reps: 8 },
    { sets: 4, reps: 8 },
    { sets: 5, reps: 6 },
    { sets: 5, reps: 6 },
    { sets: 4, reps: 10 },
    { sets: 4, reps: 10 }
  ];

  readonly MUSCLES: Record<string, MuscleInfo> = {
    'Petto':     { color: '#FF9F0A', dim: 'rgba(255,159,10,0.16)' },
    'Spalle':    { color: '#64D2FF', dim: 'rgba(100,210,255,0.16)' },
    'Tricipiti': { color: '#BF5AF2', dim: 'rgba(191,90,242,0.16)' },
    'Dorso':     { color: '#0A84FF', dim: 'rgba(10,132,255,0.16)' },
    'Bicipiti':  { color: '#30D158', dim: 'rgba(48,209,88,0.16)' },
    'Gambe':     { color: '#5E5CE6', dim: 'rgba(94,92,230,0.16)' },
    'Core':      { color: '#FFD60A', dim: 'rgba(255,214,10,0.16)' }
  };

  /* Icone lineari monocrome (stile SF Symbols / Lucide, tratto currentColor)
     in linea con lo stile liquid glass — niente emoji colorate. */
  private readonly ICON_ATTRS =
    'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"';

  readonly MUSCLE_ICONS: Record<string, string> = {
    // Petto — cuore/torace
    'Petto':     `<svg ${this.ICON_ATTRS}><path d="M12 20s-7-4.35-7-9.5A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1 7 2.5C19 15.65 12 20 12 20Z"/></svg>`,
    // Spalle — arco deltoide con testa/spalle
    'Spalle':    `<svg ${this.ICON_ATTRS}><circle cx="12" cy="6" r="2.5"/><path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>`,
    // Tricipiti — braccio in estensione
    'Tricipiti': `<svg ${this.ICON_ATTRS}><path d="M5 5l6 6 3-3 5 5"/><path d="M14 8l4-1-1 4"/></svg>`,
    // Dorso — ali/schiena simmetrica
    'Dorso':     `<svg ${this.ICON_ATTRS}><path d="M12 4v16"/><path d="M12 8c-2.5-2.5-6-2-8 .5"/><path d="M12 8c2.5-2.5 6-2 8 .5"/><path d="M12 14c-2 2-5 2-7 .5"/><path d="M12 14c2 2 5 2 7 .5"/></svg>`,
    // Bicipiti — braccio flesso
    'Bicipiti':  `<svg ${this.ICON_ATTRS}><path d="M7 21v-5a4 4 0 0 1 4-4h1a3 3 0 0 0 3-3V4"/><path d="M15 4a4 4 0 0 1 4 4c0 3-2 4-4 4"/></svg>`,
    // Gambe — gamba/passo
    'Gambe':     `<svg ${this.ICON_ATTRS}><path d="M10 3l1 8-2 4 3 6"/><path d="M14 3l-1 6"/><path d="M9 15l4 1"/></svg>`,
    // Core — griglia addominale
    'Core':      `<svg ${this.ICON_ATTRS}><rect x="6" y="4" width="12" height="16" rx="3"/><path d="M6 10h12M6 15h12M12 4v16"/></svg>`
  };

  DEFAULT_PROGRAM_START = '2026-07-05';
  hasCustomProtocol = false;
  infoNote = '';
  protocolName = '';

  days: Day[] = [];

  /** Sostituisce i dati demo con il protocollo attivo del client caricato da Firestore. */
  applyProtocol(wp: WorkoutProtocol): void {
    this.days = wp.days;
    this.WEEK_PLAN = wp.weekPlan;
    this.DEFAULT_PROGRAM_START = wp.programStart;
    this.hasCustomProtocol = true;
  }

  getExSetsReps(ex: Exercise, week: number): { sets: number; reps: (number | string)[] } {
    if (ex.scheme === 'wave') {
      const wp = this.WEEK_PLAN[week - 1];
      return {
        sets: wp.sets,
        reps: Array(wp.sets).fill(wp.reps)
      };
    } else {
      return {
        sets: ex.sets,
        reps: ex.reps ?? Array(ex.sets).fill('')
      };
    }
  }

  sparklineSVG(values: number[]): string {
    const w = 120, h = 30, pad = 4;
    const min = Math.min(...values), max = Math.max(...values), range = (max - min) || 1;
    const coords = values.map((v, i) => ({
      x: pad + (w - 2 * pad) * (values.length === 1 ? 0.5 : i / (values.length - 1)),
      y: h - pad - (h - 2 * pad) * ((v - min) / range)
    }));
    const pts = coords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
    const dots = coords.map((c, i) =>
      `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${i === coords.length - 1 ? 3 : 2}" fill="var(--accent)"/>`
    ).join('');
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/>${dots}</svg>`;
  }
}
