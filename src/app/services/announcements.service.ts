import { Injectable, NgZone } from '@angular/core';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  getDocs
} from 'firebase/firestore';
import { FirebaseService } from '../core/services/firebase.service';
import { AuthService } from '../core/services/auth.service';
import { Announcement } from '../core/models/user.model';
import { inZone } from '../core/utils/zone.util';

@Injectable({ providedIn: 'root' })
export class AnnouncementsService {
  constructor(private fb: FirebaseService, private auth: AuthService, private zone: NgZone) {}

  listForCoach(): Promise<Announcement[]> {
    return inZone(this.zone, (async () => {
      const coach = this.auth.currentUser();
      if (!coach) return [];
      const q = query(
        collection(this.fb.db, 'announcements'),
        where('coachId', '==', coach.uid),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement));
    })());
  }

  create(text: string): Promise<void> {
    return inZone(this.zone, (async () => {
      const coach = this.auth.currentUser();
      if (!coach) throw new Error('Non autenticato.');
      await addDoc(collection(this.fb.db, 'announcements'), {
        coachId: coach.uid,
        text: text.trim(),
        createdAt: new Date().toISOString()
      });
    })());
  }

  delete(id: string): Promise<void> {
    return inZone(this.zone, deleteDoc(doc(this.fb.db, 'announcements', id)));
  }
}
