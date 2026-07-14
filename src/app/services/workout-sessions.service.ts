import { Injectable } from '@angular/core';
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { FirebaseService } from '../core/services/firebase.service';
import { AuthService } from '../core/services/auth.service';
import { WorkoutSession } from '../models/workout.model';
import { ZoneFixService } from '../core/utils/zone.util';
import { sanitizeForFirestore } from '../core/utils/sanitize.util';

/**
 * Storico allenamenti (users/{uid}/sessions/{id}), id = `${dayId}_${isoDate}`
 * cosi' la chiave e' deterministica come lo era la vecchia chiave localStorage
 * `workout:{dayId}:{isoDate}`.
 */
@Injectable({ providedIn: 'root' })
export class WorkoutSessionsService {
  constructor(private fb: FirebaseService, private auth: AuthService, private zoneFix: ZoneFixService) {}

  private col() {
    const uid = this.auth.currentUser()!.uid;
    return collection(this.fb.db, 'users', uid, 'sessions');
  }

  sessionId(dayId: string, isoDate: string): string {
    return `${dayId}_${isoDate}`;
  }

  save(session: WorkoutSession): Promise<boolean> {
    return this.zoneFix.run((async () => {
      try {
        const id = this.sessionId(session.dayId, session.date);
        await setDoc(doc(this.col(), id), sanitizeForFirestore(session));
        return true;
      } catch (e) {
        console.error('Errore salvataggio sessione allenamento:', e);
        return false;
      }
    })());
  }

  get(id: string): Promise<WorkoutSession | null> {
    return this.zoneFix.run((async () => {
      const snap = await getDoc(doc(this.col(), id));
      return snap.exists() ? (snap.data() as WorkoutSession) : null;
    })());
  }

  delete(id: string): Promise<boolean> {
    return this.zoneFix.run((async () => {
      try {
        await deleteDoc(doc(this.col(), id));
        return true;
      } catch (e) {
        console.error('Errore eliminazione sessione allenamento:', e);
        return false;
      }
    })());
  }

  /**
   * Sposta/aggiorna una sessione gia' salvata. Se la data non cambia, aggiorna
   * il documento esistente in place. Se la data cambia, l'id cambia (id =
   * `${dayId}_${isoDate}`): scrive il nuovo documento e cancella quello vecchio
   * in un'unica writeBatch atomica, dopo aver verificato che la data di
   * destinazione non abbia gia' una seduta salvata per lo stesso dayId.
   */
  moveSession(session: WorkoutSession, oldId: string, newDate: string): Promise<'ok' | 'collision' | 'error'> {
    return this.zoneFix.run((async () => {
      try {
        const newId = this.sessionId(session.dayId, newDate);
        const data = sanitizeForFirestore({ ...session, date: newDate });

        if (newId === oldId) {
          await setDoc(doc(this.col(), oldId), data);
          return 'ok';
        }

        const targetSnap = await getDoc(doc(this.col(), newId));
        if (targetSnap.exists()) return 'collision';

        const batch = writeBatch(this.fb.db);
        batch.set(doc(this.col(), newId), data);
        batch.delete(doc(this.col(), oldId));
        await batch.commit();
        return 'ok';
      } catch (e) {
        console.error('Errore spostamento seduta:', e);
        return 'error';
      }
    })());
  }

  /** Tutte le sessioni salvate (storico completo), piu' recenti prima. */
  listAll(): Promise<{ id: string; session: WorkoutSession }[]> {
    return this.zoneFix.run((async () => {
      const snap = await getDocs(this.col());
      return snap.docs
        .map(d => ({ id: d.id, session: d.data() as WorkoutSession }))
        .sort((a, b) => b.session.date.localeCompare(a.session.date));
    })());
  }

  /** Sessioni salvate per un giorno specifico (usato per gli insight di progressione). */
  listForDay(dayId: string): Promise<{ id: string; session: WorkoutSession }[]> {
    return this.zoneFix.run((async () => {
      const q = query(this.col(), where('dayId', '==', dayId));
      const snap = await getDocs(q);
      return snap.docs
        .map(d => ({ id: d.id, session: d.data() as WorkoutSession }))
        .sort((a, b) => a.session.date.localeCompare(b.session.date));
    })());
  }
}
