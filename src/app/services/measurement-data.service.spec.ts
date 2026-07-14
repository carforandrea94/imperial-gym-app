import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockDocs = new Map<string, any>();

vi.mock('firebase/firestore', () => ({
  // Stubbed so this mock stays harmless if it leaks into another spec file (isolate: false shares modules across files) that constructs the real FirebaseService.
  initializeFirestore: () => ({}) as any,
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
  },
  writeBatch: (_db: any) => {
    const ops: (() => void)[] = [];
    return {
      set: (ref: { id: string }, data: any, opts?: { merge?: boolean }) => {
        ops.push(() => {
          const existing = mockDocs.get(ref.id) ?? {};
          mockDocs.set(ref.id, opts?.merge ? { ...existing, ...data } : data);
        });
      },
      update: (ref: { id: string }, data: any) => {
        ops.push(() => {
          const existing = mockDocs.get(ref.id) ?? {};
          mockDocs.set(ref.id, { ...existing, ...data });
        });
      },
      delete: (ref: { id: string }) => {
        ops.push(() => { mockDocs.delete(ref.id); });
      },
      commit: async () => {
        ops.forEach(op => op());
      }
    };
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

describe('MeasurementDataService.parseMeasureValue', () => {
  let service: MeasurementDataService;

  beforeEach(() => {
    const fbStub = { db: {} } as any;
    const authStub = { currentUser: () => ({ uid: 'u1' }) } as any;
    const appStateStub = {} as any;
    const zoneFixStub = { run: (p: Promise<any>) => p } as any;
    service = new MeasurementDataService(fbStub, authStub, appStateStub, zoneFixStub);
  });

  it('interpreta la virgola italiana come separatore decimale', () => {
    expect(service.parseMeasureValue('109,5')).toBe(109.5);
    expect(service.parseMeasureValue('110,9')).toBe(110.9);
  });

  it('funziona anche con valori gia\' col punto come separatore', () => {
    expect(service.parseMeasureValue('109.5')).toBe(109.5);
  });

  it('restituisce null per valori nulli, vuoti o non numerici', () => {
    expect(service.parseMeasureValue(null)).toBeNull();
    expect(service.parseMeasureValue(undefined)).toBeNull();
    expect(service.parseMeasureValue('')).toBeNull();
    expect(service.parseMeasureValue('abc')).toBeNull();
  });

  it('la differenza tra due valori con virgola mantiene la precisione decimale', () => {
    const diff = service.parseMeasureValue('109,5')! - service.parseMeasureValue('110,9')!;
    expect(Math.round(diff * 10) / 10).toBe(-1.4);
  });
});

describe('MeasurementDataService.formatMeasureNumber', () => {
  let service: MeasurementDataService;

  beforeEach(() => {
    const fbStub = { db: {} } as any;
    const authStub = { currentUser: () => ({ uid: 'u1' }) } as any;
    const appStateStub = {} as any;
    const zoneFixStub = { run: (p: Promise<any>) => p } as any;
    service = new MeasurementDataService(fbStub, authStub, appStateStub, zoneFixStub);
  });

  it('mostra i decimali con la virgola italiana', () => {
    expect(service.formatMeasureNumber(-1.4)).toBe('-1,4');
    expect(service.formatMeasureNumber(2.3)).toBe('2,3');
  });

  it('non aggiunge decimali superflui per i numeri interi', () => {
    expect(service.formatMeasureNumber(3)).toBe('3');
    expect(service.formatMeasureNumber(-2)).toBe('-2');
  });
});
