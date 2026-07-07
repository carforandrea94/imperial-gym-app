import { Injectable } from '@angular/core';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  addDoc
} from 'firebase/firestore';
import { FirebaseService } from '../core/services/firebase.service';
import { Protocol, emptyProtocol } from '../models/protocol.model';

@Injectable({ providedIn: 'root' })
export class ProtocolService {
  constructor(private fb: FirebaseService) {}

  private col(clientId: string) {
    return collection(this.fb.db, 'users', clientId, 'protocols');
  }

  async listForClient(clientId: string): Promise<Protocol[]> {
    const snap = await getDocs(this.col(clientId));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() } as Protocol))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(clientId: string, id: string): Promise<Protocol | null> {
    const snap = await getDoc(doc(this.col(clientId), id));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as Protocol) : null;
  }

  async getActiveForClient(clientId: string): Promise<Protocol | null> {
    const q = query(this.col(clientId), where('status', '==', 'active'));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() } as Protocol;
  }

  async create(clientId: string, coachId: string): Promise<string> {
    const data = emptyProtocol(clientId, coachId);
    const ref = await addDoc(this.col(clientId), data);
    return ref.id;
  }

  async update(clientId: string, id: string, patch: Partial<Protocol>): Promise<void> {
    await updateDoc(doc(this.col(clientId), id), { ...patch, updatedAt: new Date().toISOString() } as any);
  }

  async delete(clientId: string, id: string): Promise<void> {
    await deleteDoc(doc(this.col(clientId), id));
  }

  /** Attiva questo protocollo (il client lo vedra' in Scheda/Dieta) e archivia l'eventuale precedente attivo. */
  async activate(clientId: string, id: string): Promise<void> {
    const all = await this.listForClient(clientId);
    await Promise.all(
      all
        .filter(p => p.status === 'active' && p.id !== id)
        .map(p => this.update(clientId, p.id, { status: 'archived' }))
    );
    await this.update(clientId, id, { status: 'active' });
  }
}
