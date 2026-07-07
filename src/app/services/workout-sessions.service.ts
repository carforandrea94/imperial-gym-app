import { Injectable, NgZone } from '@angular/core';
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { FirebaseService } from '../core/services/firebase.service';
import { AuthService } from '../core/services/auth.service';
import { WorkoutSession } from '../models/workout.model';
import { inZone } from '../core/utils/zone.util';

/**
 * Storico allenamenti (users/{uid}/sessions/{id}), id = `${dayId}_${isoDate}`
 * cosi' la chiave e' deterministica come lo era la vecchia chiave localStorage
 * `workout:{dayId}:{isoDate}`.
 */
@Injectable({ providedIn: 'root' })
export class WorkoutSessionsService {
  constructor(private fb: FirebaseService, private auth: AuthService, private zone: NgZone) {}

  private col() {
    const uid = this.auth.currentUser()!.uid;
    return collection(this.fb.db, 'users', uid, 'sessions');
  }

  sessionId(dayId: string, isoDate: string): string {
    return `${dayId}_${isoDate}`;
  }

  save(session: WorkoutSession): Promise<boolean> {
    return inZone(this.zone, (async () => {
      try {
        const id = this.sessionId(session.dayId, session.date);
        await setDoc(doc(this.col(), id), session);
        return true;
      } catch {
        return false;
      }
    })());
  }

  get(id: string): Promise<WorkoutSession | null> {
    return inZone(this.zone, (async () => {
      const snap = await getDoc(doc(this.col(), id));
      return snap.exists() ? (snap.data() as WorkoutSession) : null;
    })());
  }

  delete(id: string): Promise<void> {
    return inZone(this.zone, deleteDoc(doc(this.col(), id)));
  }

  /** Tutte le sessioni salvate (storico completo), piu' recenti prima. */
  listAll(): Promise<{ id: string; session: WorkoutSession }[]> {
    return inZone(this.zone, (async () => {
      const snap = await getDocs(this.col());
      return snap.docs
        .map(d => ({ id: d.id, session: d.data() as WorkoutSession }))
        .sort((a, b) => b.session.date.localeCompare(a.session.date));
    })());
  }

  /** Sessioni salvate per un giorno specifico (usato per gli insight di progressione). */
  listForDay(dayId: string): Promise<{ id: string; session: WorkoutSession }[]> {
    return inZone(this.zone, (async () => {
      const q = query(this.col(), where('dayId', '==', dayId));
      const snap = await getDocs(q);
      return snap.docs
        .map(d => ({ id: d.id, session: d.data() as WorkoutSession }))
        .sort((a, b) => a.session.date.localeCompare(b.session.date));
    })());
  }
}
