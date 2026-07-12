import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockDocs = new Map<string, any>();

vi.mock('firebase/firestore', () => ({
  collection: (_db: any, ...segments: string[]) => ({ path: segments.join('/') }),
  doc: (_col: any, id: string) => ({ id }),
  getDoc: async (ref: { id: string }) => {
    const data = mockDocs.get(ref.id);
    return { exists: () => data !== undefined, data: () => data };
  },
  getDocs: async () => ({
    docs: Array.from(mockDocs.entries()).map(([id, data]) => ({ id, data: () => data }))
  }),
  setDoc: async (ref: { id: string }, data: any, opts?: { merge?: boolean }) => {
    const existing = mockDocs.get(ref.id) ?? {};
    mockDocs.set(ref.id, opts?.merge ? { ...existing, ...data } : data);
  },
  updateDoc: async (ref: { id: string }, data: any) => {
    const existing = mockDocs.get(ref.id) ?? {};
    mockDocs.set(ref.id, { ...existing, ...data });
  },
  deleteDoc: async (ref: { id: string }) => {
    mockDocs.delete(ref.id);
  }
}));

import { MeasurementDataService } from './measurement-data.service';

describe('MeasurementDataService.moveCategoryEntry', () => {
  let service: MeasurementDataService;

  beforeEach(() => {
    mockDocs.clear();
    const fbStub = { db: {} } as any;
    const authStub = { currentUser: () => ({ uid: 'u1' }) } as any;
    const appStateStub = {} as any;
    const zoneFixStub = { run: (p: Promise<any>) => p } as any;
    service = new MeasurementDataService(fbStub, authStub, appStateStub, zoneFixStub);
  });

  it('sposta i campi della categoria in una nuova data senza collisioni, pulendo l\'origine', async () => {
    mockDocs.set('2026-07-01', { date: '2026-07-01', peso: '80', cmVita: '90' });

    const result = await service.moveCategoryEntry('peso', '2026-07-01', '2026-07-05', { peso: '80' });

    expect(result).toBe('ok');
    expect(mockDocs.get('2026-07-05')).toMatchObject({ peso: '80' });
    expect(mockDocs.get('2026-07-01')).toMatchObject({ peso: null, cmVita: '90' });
  });

  it('blocca lo spostamento se la data di destinazione ha gia\' valori della stessa categoria', async () => {
    mockDocs.set('2026-07-01', { date: '2026-07-01', peso: '80' });
    mockDocs.set('2026-07-05', { date: '2026-07-05', peso: '82' });

    const result = await service.moveCategoryEntry('peso', '2026-07-01', '2026-07-05', { peso: '80' });

    expect(result).toBe('collision');
    expect(mockDocs.get('2026-07-01')).toMatchObject({ peso: '80' });
    expect(mockDocs.get('2026-07-05')).toMatchObject({ peso: '82' });
  });

  it('elimina la voce di origine se resta senza valori in nessuna categoria dopo lo spostamento', async () => {
    mockDocs.set('2026-07-01', { date: '2026-07-01', peso: '80' });

    await service.moveCategoryEntry('peso', '2026-07-01', '2026-07-05', { peso: '80' });

    expect(mockDocs.has('2026-07-01')).toBe(false);
  });

  it('con la stessa data, aggiorna solo i campi della categoria senza toccare le altre', async () => {
    mockDocs.set('2026-07-01', { date: '2026-07-01', peso: '80', cmVita: '90' });

    const result = await service.moveCategoryEntry('peso', '2026-07-01', '2026-07-01', { peso: '81' });

    expect(result).toBe('ok');
    expect(mockDocs.get('2026-07-01')).toMatchObject({ peso: '81', cmVita: '90' });
  });
});
