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
  setDoc: async (ref: { id: string }, data: any) => {
    mockDocs.set(ref.id, data);
  },
  deleteDoc: async (ref: { id: string }) => {
    mockDocs.delete(ref.id);
  },
  query: (col: any) => col,
  where: () => ({}),
  writeBatch: (_db: any) => {
    const ops: (() => void)[] = [];
    return {
      set: (ref: { id: string }, data: any) => {
        ops.push(() => { mockDocs.set(ref.id, data); });
      },
      delete: (ref: { id: string }) => {
        ops.push(() => { mockDocs.delete(ref.id); });
      },
      commit: async () => { ops.forEach(op => op()); }
    };
  }
}));

import { WorkoutSessionsService } from './workout-sessions.service';
import { WorkoutSession } from '../models/workout.model';

describe('WorkoutSessionsService.moveSession', () => {
  let service: WorkoutSessionsService;

  const baseSession: WorkoutSession = {
    dayId: 'day1',
    dayLabel: 'Giorno ON',
    date: '2026-07-01',
    exercises: [{ name: 'Squat', sets: [{ load: '100', reps: '8', done: true }] }]
  };

  beforeEach(() => {
    mockDocs.clear();
    const fbStub = { db: {} } as any;
    const authStub = { currentUser: () => ({ uid: 'u1' }) } as any;
    const zoneFixStub = { run: (p: Promise<any>) => p } as any;
    service = new WorkoutSessionsService(fbStub, authStub, zoneFixStub);
  });

  it('con la stessa data, aggiorna il documento esistente senza cambiare id', async () => {
    mockDocs.set('day1_2026-07-01', { ...baseSession });

    const result = await service.moveSession(baseSession, 'day1_2026-07-01', '2026-07-01');

    expect(result).toBe('ok');
    expect(mockDocs.get('day1_2026-07-01')).toMatchObject({ date: '2026-07-01', dayId: 'day1' });
    expect(mockDocs.has('day1_2026-07-05')).toBe(false);
  });

  it('con una data diversa senza collisione, scrive il nuovo documento ed elimina quello vecchio', async () => {
    mockDocs.set('day1_2026-07-01', { ...baseSession });

    const result = await service.moveSession(baseSession, 'day1_2026-07-01', '2026-07-05');

    expect(result).toBe('ok');
    expect(mockDocs.get('day1_2026-07-05')).toMatchObject({ date: '2026-07-05', dayId: 'day1' });
    expect(mockDocs.has('day1_2026-07-01')).toBe(false);
  });

  it('blocca lo spostamento se esiste gia\' una seduta nella data di destinazione, senza scrivere ne\' cancellare nulla', async () => {
    mockDocs.set('day1_2026-07-01', { ...baseSession });
    mockDocs.set('day1_2026-07-05', { ...baseSession, date: '2026-07-05', exercises: [] });

    const result = await service.moveSession(baseSession, 'day1_2026-07-01', '2026-07-05');

    expect(result).toBe('collision');
    expect(mockDocs.get('day1_2026-07-01')).toMatchObject({ date: '2026-07-01' });
    expect(mockDocs.get('day1_2026-07-05')).toMatchObject({ exercises: [] });
  });
});
