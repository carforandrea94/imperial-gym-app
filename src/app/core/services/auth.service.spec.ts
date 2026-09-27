import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock condivisa: vedi src/test-support/firestore-mock.ts per il perche' non
// puo' vivere qui dentro (isolate: false condivide i moduli fra i file).
vi.mock('firebase/firestore', async () => (await import('../../../test-support/firestore-mock')).firestoreMock);

/**
 * La finta Auth. Vive su globalThis per lo stesso motivo della mock di
 * Firestore: le spec chiamano vi.resetModules(), e una const di modulo
 * verrebbe ricreata a ogni rivalutazione.
 */
type StatoAuth = {
  utenteCorrente: { uid: string; email: string | null } | null;
  cancellati: string[];
  usciteEffettuate: number;
  creaFallisce: boolean;
};
const scope = globalThis as unknown as { __authState?: StatoAuth };
const stato: StatoAuth = (scope.__authState ??= {
  utenteCorrente: null, cancellati: [], usciteEffettuate: 0, creaFallisce: false
});

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: () => () => {},
  getAuth: () => ({}),
  signInWithEmailAndPassword: async (_a: any, email: string) => {
    stato.utenteCorrente = { uid: 'uid-' + email, email };
    return { user: stato.utenteCorrente };
  },
  createUserWithEmailAndPassword: async (_a: any, email: string) => {
    if (stato.creaFallisce) throw Object.assign(new Error('gia usata'), { code: 'auth/email-already-in-use' });
    stato.utenteCorrente = { uid: 'uid-' + email, email };
    return { user: stato.utenteCorrente };
  },
  deleteUser: async (u: { uid: string }) => {
    stato.cancellati.push(u.uid);
    stato.utenteCorrente = null;
  },
  signOut: async () => { stato.usciteEffettuate++; stato.utenteCorrente = null; },
  sendPasswordResetEmail: async () => {}
}));

import { mockDocs, firestoreMock } from '../../../test-support/firestore-mock';

// La setDoc originale, presa UNA volta sola: riprenderla dentro il beforeEach
// significherebbe catturare la spia del giro precedente, e la chiamata
// tornerebbe su se stessa all'infinito.
const setDocPristino = firestoreMock.setDoc;

describe('AuthService — iscrizioni che si rompono a meta\'', () => {
  let AuthService: any;
  let PROFILE_MISSING: string;
  let service: any;
  let scritturaFallisce: (id: string) => boolean;

  beforeEach(async () => {
    mockDocs.clear();
    stato.utenteCorrente = null;
    stato.cancellati = [];
    stato.usciteEffettuate = 0;
    stato.creaFallisce = false;
    scritturaFallisce = () => false;

    vi.resetModules();
    const mod = await import('./auth.service');
    AuthService = mod.AuthService;
    PROFILE_MISSING = mod.PROFILE_MISSING;

    const firestore: any = await import('firebase/firestore');
    vi.spyOn(firestore, 'setDoc').mockImplementation(async (ref: any, ...resto: any[]) => {
      if (scritturaFallisce(ref.id)) throw new Error('rete assente');
      return (setDocPristino as any)(ref, ...resto);
    });

    // L'auth finta e' un oggetto vivo: il servizio ci legge currentUser.
    const fbStub = { db: {}, get auth() { return { get currentUser() { return stato.utenteCorrente; } }; } } as any;
    const zoneStub = { run: (fn: any) => fn() } as any;
    const zoneFixStub = { run: (p: Promise<any>) => p } as any;
    const appRefStub = { tick: () => {} } as any;
    service = new AuthService(fbStub, zoneStub, zoneFixStub, appRefStub);
  });

  const preparaCodiceCoach = () => mockDocs.set('KP6WS2', { coachId: 'coach-1' });

  it('cancella l\'utente Auth se il profilo del cliente non si scrive', async () => {
    preparaCodiceCoach();
    scritturaFallisce = (id) => id.startsWith('uid-');

    await expect(service.registerClient('Anna', 'anna@e.com', 'pw1234', 'KP6WS2')).rejects.toThrow('rete assente');
    expect(stato.cancellati).toEqual(['uid-anna@e.com']);
  });

  it('non cancella niente quando la registrazione del cliente riesce', async () => {
    preparaCodiceCoach();
    const profilo = await service.registerClient('Anna', 'anna@e.com', 'pw1234', 'KP6WS2');
    expect(profilo.role).toBe('client');
    expect(profilo.coachId).toBe('coach-1');
    expect(stato.cancellati).toEqual([]);
  });

  it('cancella l\'utente Auth se il profilo del coach non si scrive', async () => {
    scritturaFallisce = (id) => id.startsWith('uid-');
    await expect(service.registerCoach('c@e.com', 'pw1234', 'Carlo')).rejects.toThrow('rete assente');
    expect(stato.cancellati).toEqual(['uid-c@e.com']);
  });

  it('NON cancella il coach se a mancare e\' solo la voce pubblica del codice', async () => {
    // Il profilo c'e' e l'account funziona: ensureCoachCode rifa' la voce al
    // primo accesso. Cancellare qui butterebbe via un account sano.
    scritturaFallisce = (id) => !id.startsWith('uid-');
    await expect(service.registerCoach('c@e.com', 'pw1234', 'Carlo')).rejects.toThrow('rete assente');
    expect(stato.cancellati).toEqual([]);
    expect(mockDocs.get('uid-c@e.com').role).toBe('coach');
  });

  it('l\'accesso senza profilo segnala il caso e NON chiude la sessione', async () => {
    try {
      await service.login('orfano@e.com', 'pw1234');
      throw new Error('doveva fallire');
    } catch (e: any) {
      expect(e.code).toBe(PROFILE_MISSING);
    }
    // Senza la sessione aperta il profilo mancante non si potrebbe piu' scrivere.
    expect(stato.usciteEffettuate).toBe(0);
    expect(service.hasPendingProfile()).toBe(true);
    expect(service.pendingEmail()).toBe('orfano@e.com');
  });

  it('completeClientProfile finisce l\'iscrizione sulla sessione aperta', async () => {
    preparaCodiceCoach();
    await service.login('orfano@e.com', 'pw1234').catch(() => {});
    const profilo = await service.completeClientProfile('Anna', 'kp6ws2');
    expect(profilo.role).toBe('client');
    expect(profilo.email).toBe('orfano@e.com');
    expect(profilo.coachId).toBe('coach-1');
    expect(service.currentUser().uid).toBe('uid-orfano@e.com');
    expect(service.hasPendingProfile()).toBe(false);
  });

  it('completeClientProfile rifiuta un codice coach inesistente', async () => {
    await service.login('orfano@e.com', 'pw1234').catch(() => {});
    await expect(service.completeClientProfile('Anna', 'ZZZZZZ')).rejects.toThrow(/Codice coach/);
  });

  it('completeCoachProfile scrive profilo e voce pubblica del codice', async () => {
    await service.login('orfano@e.com', 'pw1234').catch(() => {});
    const profilo = await service.completeCoachProfile('Carlo');
    expect(profilo.role).toBe('coach');
    expect(profilo.coachId).toBeNull();
    expect(mockDocs.get(profilo.pairingCode)).toEqual({ coachId: 'uid-orfano@e.com' });
  });

  it('senza sessione aperta non c\'e\' niente da completare', async () => {
    expect(service.hasPendingProfile()).toBe(false);
    expect(service.pendingEmail()).toBeNull();
    await expect(service.completeClientProfile('Anna', 'KP6WS2')).rejects.toThrow(/Sessione scaduta/);
  });
});
