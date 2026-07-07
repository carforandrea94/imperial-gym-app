import { Injectable } from '@angular/core';
import { AuthService } from '../core/services/auth.service';
import { ProtocolService } from './protocol.service';
import { WorkoutDataService } from './workout-data.service';
import { DietDataService } from './diet-data.service';
import { WorkoutStateService } from './workout-state.service';

@Injectable({ providedIn: 'root' })
export class ProtocolBootstrapService {
  private loaded = false;

  constructor(
    private auth: AuthService,
    private protocolSvc: ProtocolService,
    private workoutData: WorkoutDataService,
    private dietData: DietDataService,
    private workoutState: WorkoutStateService
  ) {}

  /** Idempotente: la prima volta carica il protocollo attivo del client e lo applica, poi non rifa' nulla. */
  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    const user = this.auth.currentUser();
    if (!user || user.role !== 'client') { this.loaded = true; return; }

    try {
      const active = await this.protocolSvc.getActiveForClient(user.uid);
      if (active) {
        this.workoutData.applyProtocol(active.workout);
        this.dietData.applyDiet(active.diet);
        this.workoutState.recomputeWeek(active.workout.programStart, active.workout.weekPlan.length);
      }
    } catch (e) {
      console.error('Errore caricamento protocollo attivo:', e);
      // In caso di errore restano i dati demo di fallback: l'app resta comunque utilizzabile.
    } finally {
      this.loaded = true;
    }
  }

  /** Forza un nuovo caricamento (es. dopo che il coach ha attivato un nuovo protocollo). */
  reset(): void {
    this.loaded = false;
  }
}
