import { Injectable } from '@angular/core';
import { doc, getDoc, setDoc, updateDoc, deleteField } from 'firebase/firestore';
import { FirebaseService } from '../core/services/firebase.service';
import { AuthService } from '../core/services/auth.service';

export interface WorkoutDraftRow {
  reps: string;
  load: string;
  done: boolean;
}

export interface AppState {
  workoutDrafts: Record<string, { rows: WorkoutDraftRow[] }[]>;
  restOverrides: Record<string, number>;
  dietMode: 'on' | 'off';
  measureDraft: Record<string, string | null> | null;
}

function emptyState(): AppState {
  return { workoutDrafts: {}, restOverrides: {}, dietMode: 'on', measureDraft: null };
}

/**
 * Un unico documento Firestore (users/{uid}/state/app) che raccoglie tutto lo
 * stato "effimero"/di sessione dell'utente: bozze di allenamento in corso,
 * override del tempo di recupero per esercizio, modalita' dieta ON/OFF e
 * bozza delle misure in corso. Un solo read copre tutto; gli aggiornamenti
 * usano dot-notation cosi' non serve riscrivere l'intero documento.
 */
@Injectable({ providedIn: 'root' })
export class AppStateService {
  private cache: AppState | null = null;

  constructor(private fb: FirebaseService, private auth: AuthService) {}

  private ref() {
    const uid = this.auth.currentUser()!.uid;
    return doc(this.fb.db, 'users', uid, 'state', 'app');
  }

  async load(): Promise<AppState> {
    if (this.cache) return this.cache;
    const snap = await getDoc(this.ref());
    this.cache = snap.exists() ? { ...emptyState(), ...(snap.data() as AppState) } : emptyState();
    return this.cache;
  }

  private async ensureDoc(): Promise<void> {
    const snap = await getDoc(this.ref());
    if (!snap.exists()) {
      await setDoc(this.ref(), emptyState());
    }
  }

  async patch(partial: Partial<AppState>): Promise<void> {
    await this.ensureDoc();
    await updateDoc(this.ref(), partial as any);
    this.cache = { ...(this.cache ?? emptyState()), ...partial };
  }

  /** Aggiorna un campo annidato tramite dot-notation (es. 'workoutDrafts.day0'). */
  async patchField(path: string, value: unknown): Promise<void> {
    await this.ensureDoc();
    await updateDoc(this.ref(), { [path]: value } as any);
    this.invalidateCache();
  }

  /** Rimuove un campo annidato tramite dot-notation. */
  async deleteFieldPath(path: string): Promise<void> {
    await this.ensureDoc();
    await updateDoc(this.ref(), { [path]: deleteField() } as any);
    this.invalidateCache();
  }

  invalidateCache(): void {
    this.cache = null;
  }
}
