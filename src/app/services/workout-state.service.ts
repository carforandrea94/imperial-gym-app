import { Injectable, signal } from '@angular/core';
import { DietMode } from '../models/diet.model';

export interface RestTimerState {
  show: boolean;
  remaining: number;
  finished: boolean;
  fillPct: number;
}

const REST_DURATION = 90;

@Injectable({ providedIn: 'root' })
export class WorkoutStateService {

  readonly DEFAULT_PROGRAM_START = '2026-07-05';
  readonly currentWeek: number;

  dietMode = signal<DietMode>('on');

  restTimer = signal<RestTimerState>({
    show: false, remaining: REST_DURATION, finished: false, fillPct: 100
  });

  private ticker: ReturnType<typeof setInterval> | null = null;
  private closeTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.currentWeek = this.computeAutoWeek(this.DEFAULT_PROGRAM_START);
  }

  private computeAutoWeek(startISO: string): number {
    const start = new Date(startISO + 'T00:00:00');
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((now.getTime() - start.getTime()) / 86400000);
    const week = Math.floor(diffDays / 7) + 1;
    return Math.min(Math.max(week, 1), 8);
  }

  startRestTimer(durationSeconds?: number): void {
    this.stopRestTimer();
    const duration = durationSeconds && durationSeconds > 0 ? durationSeconds : REST_DURATION;
    let remaining = duration;

    this.restTimer.set({ show: true, remaining, finished: false, fillPct: 100 });

    this.ticker = setInterval(() => {
      remaining--;
      const fillPct = (remaining / duration) * 100;
      this.restTimer.set({ show: true, remaining, finished: remaining <= 0, fillPct: Math.max(fillPct, 0) });

      if (remaining <= 0) {
        if (this.ticker) { clearInterval(this.ticker); this.ticker = null; }
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        this.closeTimeout = setTimeout(() => this.stopRestTimer(), 4000);
      }
    }, 1000);
  }

  stopRestTimer(): void {
    if (this.ticker) { clearInterval(this.ticker); this.ticker = null; }
    if (this.closeTimeout) {
      clearTimeout(this.closeTimeout);
      this.closeTimeout = null;
    }
    this.restTimer.set({ show: false, remaining: REST_DURATION, finished: false, fillPct: 100 });
  }

  toggleDietMode(): void {
    this.dietMode.set(this.dietMode() === 'on' ? 'off' : 'on');
  }

  formatTime(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }
}
