import { Injectable } from '@angular/core';
import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  addDoc
} from 'firebase/firestore';
import { FirebaseService } from '../core/services/firebase.service';
import { Protocol, emptyProtocol } from '../models/protocol.model';
import { ZoneFixService } from '../core/utils/zone.util';
import { sanitizeForFirestore } from '../core/utils/sanitize.util';

const LEGACY_MEAL_KEYS = ['colazione', 'spuntino', 'pranzo', 'merenda', 'cena'];
const LEGACY_MEAL_LABELS: Record<string, string> = {
  colazione: 'Colazione', spuntino: 'Spuntino', pranzo: 'Pranzo', merenda: 'Merenda', cena: 'Cena'
};

function normalizeMeal(meal: any): any {
  if (Array.isArray(meal.combinations)) return meal;
  console.warn(`Pasto "${meal.name}" in formato legacy (senza combinations[]), normalizzato.`);
  const baseItems: any[] = meal.items ?? [];
  const combinations = [{ id: meal.id ?? 'base', label: 'Base', items: baseItems }];
  (meal.variants ?? []).forEach((v: any, i: number) => {
    combinations.push({ id: `legacy_${i}`, label: v.label ?? `Opzione ${i + 2}`, items: v.items ?? [] });
  });
  return { id: meal.id, name: meal.name, combinations };
}

/**
 * Protocolli creati prima della migrazione dieta ON/OFF -> lista libera di
 * piani hanno ancora diet: {on:{...}, off:{...}} invece di un array.
 * Piani creati nella finestra intermedia (lista di piani, ma pasti ancora
 * a chiavi fisse colazione/spuntino/...) non hanno il campo meals[].
 * Pasti creati prima delle combinazioni non hanno combinations[].
 * Normalizziamo tutti i casi in lettura, cosi' il resto del codice puo'
 * sempre assumere che protocol.diet sia un array di piani con
 * meals[].combinations[].
 */
function normalizeProtocol(p: Protocol): Protocol {
  if (!Array.isArray(p.diet)) {
    console.warn(`Protocollo ${p.id}: campo diet in formato legacy (non array), normalizzato ad array vuoto.`);
    p.diet = [];
    return p;
  }
  p.diet = p.diet.map((plan: any) => {
    let meals = plan.meals;
    if (!Array.isArray(meals)) {
      console.warn(`Protocollo ${p.id}: piano "${plan.name}" in formato legacy (senza meals[]), normalizzato.`);
      meals = LEGACY_MEAL_KEYS
        .filter(key => plan[key])
        .map(key => ({ id: key, name: LEGACY_MEAL_LABELS[key], ...plan[key] }));
    }
    return { id: plan.id, name: plan.name, meals: meals.map(normalizeMeal) };
  });
  return p;
}

@Injectable({ providedIn: 'root' })
export class ProtocolService {
  constructor(private fb: FirebaseService, private zoneFix: ZoneFixService) {}

  private col(clientId: string) {
    return collection(this.fb.db, 'users', clientId, 'protocols');
  }

  listForClient(clientId: string): Promise<Protocol[]> {
    return this.zoneFix.run((async () => {
      const snap = await getDocs(this.col(clientId));
      return snap.docs
        .map(d => normalizeProtocol({ id: d.id, ...d.data() } as Protocol))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    })());
  }

  get(clientId: string, id: string): Promise<Protocol | null> {
    return this.zoneFix.run((async () => {
      const snap = await getDoc(doc(this.col(clientId), id));
      return snap.exists() ? normalizeProtocol({ id: snap.id, ...snap.data() } as Protocol) : null;
    })());
  }

  getActiveForClient(clientId: string): Promise<Protocol | null> {
    return this.zoneFix.run((async () => {
      const q = query(this.col(clientId), where('status', '==', 'active'));
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const d = snap.docs[0];
      return normalizeProtocol({ id: d.id, ...d.data() } as Protocol);
    })());
  }

  create(clientId: string, coachId: string): Promise<string> {
    return this.zoneFix.run((async () => {
      const data = emptyProtocol(clientId, coachId);
      const ref = await addDoc(this.col(clientId), data);
      return ref.id;
    })());
  }

  update(clientId: string, id: string, patch: Partial<Protocol>): Promise<void> {
    const clean = sanitizeForFirestore({ ...patch, updatedAt: new Date().toISOString() });
    return this.zoneFix.run(updateDoc(doc(this.col(clientId), id), clean as any));
  }

  delete(clientId: string, id: string): Promise<void> {
    return this.zoneFix.run(deleteDoc(doc(this.col(clientId), id)));
  }

  /** Attiva questo protocollo (il client lo vedra' in Scheda/Dieta) e archivia l'eventuale precedente attivo. */
  activate(clientId: string, id: string): Promise<void> {
    return this.zoneFix.run((async () => {
      const all = await this.listForClient(clientId);
      await Promise.all(
        all
          .filter(p => p.status === 'active' && p.id !== id)
          .map(p => this.update(clientId, p.id, { status: 'archived' }))
      );
      await this.update(clientId, id, { status: 'active' });
    })());
  }
}
