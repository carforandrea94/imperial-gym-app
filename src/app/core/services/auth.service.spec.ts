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
  EmailAuthProvider: { credential: (email: string, password: string) => ({ email, password }) },
  reauthenticateWithCredential: async (_u: any, cred: { password: string }) => {
    if (cred.password !== 'giusta') throw Object.assign(new Error('no'), { code: 'auth/wrong-password' });
    return { user: stato.utenteCorrente };
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

  describe('chiusura dell\'account', () => {
    const entraCome = async (profilo: any) => {
      mockDocs.set('uid-via@e.com', profilo);
      await service.login('via@e.com', 'pw1234');
    };

    it('porta via i documenti e poi l\'utente Auth', async () => {
      await entraCome({ uid: 'uid-via@e.com', role: 'client', coachId: 'coach-1', email: 'via@e.com' });
      mockDocs.set('seduta-1', { dayId: 'day1' });
      mockDocs.set('misura-1', { peso: 80 });

      await service.deleteAccount('giusta');

      expect(mockDocs.size).toBe(0);
      expect(stato.cancellati).toEqual(['uid-via@e.com']);
      expect(service.currentUser()).toBeNull();
    });

    it('con la password sbagliata non tocca niente', async () => {
      await entraCome({ uid: 'uid-via@e.com', role: 'client', coachId: 'coach-1', email: 'via@e.com' });
      await expect(service.deleteAccount('sbagliata')).rejects.toMatchObject({ code: 'auth/wrong-password' });
      expect(mockDocs.get('uid-via@e.com')).toBeTruthy();
      expect(stato.cancellati).toEqual([]);
    });

    it('un coach con clienti collegati non puo\' chiudere', async () => {
      await entraCome({ uid: 'uid-via@e.com', role: 'coach', pairingCode: 'AB12CD', email: 'via@e.com' });
      // listClients() legge dalla stessa mappa: questo documento e' il cliente.
      mockDocs.set('cliente-1', { role: 'client', coachId: 'uid-via@e.com' });

      await expect(service.deleteAccount('giusta')).rejects.toThrow(/senza coach/);
      expect(mockDocs.get('uid-via@e.com')).toBeTruthy();
      expect(stato.cancellati).toEqual([]);
    });

    it('un coach senza clienti si porta via anche il proprio codice', async () => {
      await entraCome({ uid: 'uid-via@e.com', role: 'coach', pairingCode: 'AB12CD', email: 'via@e.com' });
      mockDocs.set('AB12CD', { coachId: 'uid-via@e.com' });

      await service.deleteAccount('giusta');

      expect(mockDocs.get('AB12CD')).toBeUndefined();
      expect(stato.cancellati).toEqual(['uid-via@e.com']);
    });

    it('senza sessione non c\'e\' niente da chiudere', async () => {
      await expect(service.deleteAccount('giusta')).rejects.toThrow(/Sessione scaduta/);
    });
  });

  describe('il coach toglie un cliente', () => {
    const entraComeCoach = async () => {
      mockDocs.set('uid-coach@e.com', { uid: 'uid-coach@e.com', role: 'coach', email: 'coach@e.com', pairingCode: 'AB12CD' });
      await service.login('coach@e.com', 'pw1234');
    };

    it('porta via il cliente e quello che ha sotto', async () => {
      await entraComeCoach();
      mockDocs.set('cliente-1', { uid: 'cliente-1', role: 'client', coachId: 'uid-coach@e.com' });

      await service.deleteClient('cliente-1');

      expect(mockDocs.get('cliente-1')).toBeUndefined();
      // Il coach resta: toglie il cliente, non se stesso.
      expect(stato.cancellati).toEqual([]);
    });

    it('non tocca il cliente di un altro coach', async () => {
      await entraComeCoach();
      mockDocs.set('cliente-altrui', { uid: 'cliente-altrui', role: 'client', coachId: 'un-altro-coach' });

      await expect(service.deleteClient('cliente-altrui')).rejects.toThrow(/non e\' tuo/);
      expect(mockDocs.get('cliente-altrui')).toBeTruthy();
    });

    it('un cliente non puo\' togliere nessuno', async () => {
      mockDocs.set('uid-io@e.com', { uid: 'uid-io@e.com', role: 'client', coachId: 'c1' });
      mockDocs.set('cliente-2', { uid: 'cliente-2', role: 'client', coachId: 'c1' });
      await service.login('io@e.com', 'pw1234');

      await expect(service.deleteClient('cliente-2')).rejects.toThrow(/Solo un coach/);
      expect(mockDocs.get('cliente-2')).toBeTruthy();
    });

    it('un cliente che non esiste piu\' lo dice', async () => {
      await entraComeCoach();
      await expect(service.deleteClient('mai-esistito')).rejects.toThrow(/non esiste piu\'/);
    });
  });
});