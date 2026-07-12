import { Injectable } from '@angular/core';
import { doc, getDoc, updateDoc, deleteField, runTransaction } from 'firebase/firestore';
import { FirebaseService } from '../core/services/firebase.service';
import { AuthService } from '../core/services/auth.service';
import { ZoneFixService } from '../core/utils/zone.util';
import { sanitizeForFirestore } from '../core/utils/sanitize.util';

export interface WorkoutDraftRow {
  reps: string;
  load: string;
  done: boolean;
}

export interface AppState {
  workoutDrafts: Record<string, { rows: WorkoutDraftRow[] }[]>;
  restOverrides: Record<string, number>;
  measureDraft: Record<string, string | null> | null;
  shoppingChecked: Record<string, boolean>;
  workoutViewMode: 'list' | 'slider';
}

function emptyState(): AppState {
  return { workoutDrafts: {}, restOverrides: {}, measureDraft: null, shoppingChecked: {}, workoutViewMode: 'list' };
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

  constructor(private fb: FirebaseService, private auth: AuthService, private zoneFix: ZoneFixService) {}

  private ref() {
    const uid = this.auth.currentUser()!.uid;
    return doc(this.fb.db, 'users', uid, 'state', 'app');
  }

  load(): Promise<AppState> {
    if (this.cache) return Promise.resolve(this.cache);
    return this.zoneFix.run((async () => {
      const snap = await getDoc(this.ref());
      this.cache = snap.exists() ? { ...emptyState(), ...(snap.data() as AppState) } : emptyState();
      return this.cache;
    })());
  }

  private async ensureDoc(): Promise<void> {
    // Transazione invece di getDoc+setDoc separati: se due chiamate concorrenti
    // (es. cambio vista + autosalvataggio bozza) trovano entrambe il doc
    // mancante, solo una delle due lo crea davvero; l'altra la vede gia'
    // esistente e non sovrascrive nulla.
    await runTransaction(this.fb.db, async (tx) => {
      const snap = await tx.get(this.ref());
      if (!snap.exists()) {
        tx.set(this.ref(), emptyState());
      }
    });
  }

  patch(partial: Partial<AppState>): Promise<void> {
    const clean = sanitizeForFirestore(partial);
    return this.zoneFix.run((async () => {
      await this.ensureDoc();
      await updateDoc(this.ref(), clean as any);
      this.cache = { ...(this.cache ?? emptyState()), ...clean };
    })());
  }

  /** Aggiorna un campo annidato tramite dot-notation (es. 'workoutDrafts.day0'). */
  patchField(path: string, value: unknown): Promise<void> {
    const cleanValue = sanitizeForFirestore(value);
    return this.zoneFix.run((async () => {
      await this.ensureDoc();
      await updateDoc(this.ref(), { [path]: cleanValue } as any);
      this.invalidateCache();
    })());
  }

  /** Rimuove un campo annidato tramite dot-notation. */
  deleteFieldPath(path: string): Promise<void> {
    return this.zoneFix.run((async () => {
      await this.ensureDoc();
      await updateDoc(this.ref(), { [path]: deleteField() } as any);
      this.invalidateCache();
    })());
  }

  invalidateCache(): void {
    this.cache = null;
  }
}
