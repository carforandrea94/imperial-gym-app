/**
 * Finta implementazione di firebase/firestore per i test, con UNA sola mappa di
 * documenti condivisa da tutti i file che la usano.
 *
 * Il builder Angular esegue i test con `isolate: false`: i moduli sono
 * condivisi fra i file, quindi un servizio caricato da un file che NON mocka
 * firestore resta legato alle funzioni vere anche quando poi lo importa un file
 * che la mock ce l'ha. Da qui i fallimenti a intermittenza, dipendenti
 * dall'ordine dei file (l'errore vero era «Expected first argument to
 * collection() to be a CollectionReference…»: firestore vero, db finto). Le
 * spec risolvono ricaricando il servizio con `vi.resetModules()` dentro il
 * beforeEach; questo modulo va quindi scritto in modo da sopravvivere alla
 * propria rivalutazione — vedi la mappa su globalThis qui sotto.
 */

// La mappa vive su globalThis e non nel modulo: i test chiamano
// `vi.resetModules()` (unico modo per far vedere la mock a un servizio gia'
// caricato da un altro file, vedi le spec), e una `const` di modulo verrebbe
// ricreata a ogni rivalutazione — la spec scriverebbe in una mappa e il
// servizio leggerebbe in un'altra.
const globalScope = globalThis as unknown as { __mockDocs?: Map<string, any> };
export const mockDocs: Map<string, any> = (globalScope.__mockDocs ??= new Map<string, any>());

const merge = (id: string, data: any, mergeMode?: boolean) => {
  const existing = mockDocs.get(id) ?? {};
  mockDocs.set(id, mergeMode ? { ...existing, ...data } : data);
};

export const firestoreMock = {
  // Neutro: se questa mock finisce sotto a un file che costruisce il vero
  // FirebaseService, non deve fare danni.
  initializeFirestore: () => ({}) as any,
  collection: (_db: any, ...segments: string[]) => ({ path: segments.join('/') }),
  doc: (_col: any, id: string) => ({ id }),
  query: (col: any) => col,
  where: () => ({}),

  getDoc: async (ref: { id: string }) => {
    const data = mockDocs.get(ref.id);
    return { exists: () => data !== undefined, data: () => data };
  },
  getDocs: async () => ({
    docs: Array.from(mockDocs.entries()).map(([id, data]) => ({ id, data: () => data }))
  }),
  setDoc: async (ref: { id: string }, data: any, opts?: { merge?: boolean }) => {
    merge(ref.id, data, opts?.merge);
  },
  updateDoc: async (ref: { id: string }, data: any) => {
    merge(ref.id, data, true);
  },
  deleteDoc: async (ref: { id: string }) => {
    mockDocs.delete(ref.id);
  },

  writeBatch: (_db: any) => {
    const ops: (() => void)[] = [];
    return {
      set: (ref: { id: string }, data: any, opts?: { merge?: boolean }) => {
        ops.push(() => merge(ref.id, data, opts?.merge));
      },
      update: (ref: { id: string }, data: any) => {
        ops.push(() => merge(ref.id, data, true));
      },
      delete: (ref: { id: string }) => {
        ops.push(() => { mockDocs.delete(ref.id); });
      },
      commit: async () => { ops.forEach(op => op()); }
    };
  }
};
