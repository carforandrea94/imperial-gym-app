import { Injectable, signal } from '@angular/core';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  setPersistence,
  inMemoryPersistence,
  User
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  collection,
  where,
  getDocs,
  getFirestore
} from 'firebase/firestore';
import { FirebaseService } from './firebase.service';
import { UserProfile, UserRole } from '../models/user.model';
import { environment } from '../../../environments/environment';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // esclusi 0/O/1/I/L per leggibilita'

function generateCode(length = 6): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return out;
}

function generateTempPassword(): string {
  return generateCode(4) + generateCode(4).toLowerCase() + Math.floor(Math.random() * 90 + 10);
}

export interface NewClientResult {
  email: string;
  tempPassword: string;
  pairingCode: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  currentUser = signal<UserProfile | null>(null);
  authReady = signal(false);

  private readyResolve!: () => void;
  readonly ready: Promise<void> = new Promise(res => { this.readyResolve = res; });

  constructor(private fb: FirebaseService) {
    onAuthStateChanged(this.fb.auth, async (fbUser: User | null) => {
      if (!fbUser) {
        this.currentUser.set(null);
      } else {
        const profile = await this.loadProfile(fbUser.uid);
        this.currentUser.set(profile);
      }
      if (!this.authReady()) {
        this.authReady.set(true);
        this.readyResolve();
      }
    });
  }

  private async loadProfile(uid: string): Promise<UserProfile | null> {
    const snap = await getDoc(doc(this.fb.db, 'users', uid));
    return snap.exists() ? (snap.data() as UserProfile) : null;
  }

  /**
   * Login standard. Per un client al primo accesso (paired === false) e' obbligatorio
   * passare anche il codice di accoppiamento fornito dal coach.
   */
  async login(email: string, password: string, pairingCode?: string): Promise<UserProfile> {
    const cred = await signInWithEmailAndPassword(this.fb.auth, email.trim(), password);
    const profile = await this.loadProfile(cred.user.uid);

    if (!profile) {
      await signOut(this.fb.auth);
      throw new Error('Profilo utente non trovato. Contatta il tuo coach.');
    }

    if (profile.role === 'client' && !profile.paired) {
      const code = (pairingCode ?? '').trim().toUpperCase();
      if (!code) {
        await signOut(this.fb.auth);
        throw new Error('CODE_REQUIRED');
      }
      if (code !== profile.pairingCode) {
        await signOut(this.fb.auth);
        throw new Error('Codice di accoppiamento non valido.');
      }
      await updateDoc(doc(this.fb.db, 'users', profile.uid), { paired: true });
      profile.paired = true;
    }

    this.currentUser.set(profile);
    return profile;
  }

  async logout(): Promise<void> {
    await signOut(this.fb.auth);
    this.currentUser.set(null);
  }

  /** Registrazione di un nuovo coach (auto-generato il proprio codice, non necessario per l'accesso). */
  async registerCoach(email: string, password: string, displayName: string): Promise<UserProfile> {
    const cred = await createUserWithEmailAndPassword(this.fb.auth, email.trim(), password);
    const profile: UserProfile = {
      uid: cred.user.uid,
      email: email.trim(),
      displayName: displayName.trim(),
      role: 'coach',
      pairingCode: generateCode(),
      coachId: null,
      paired: true,
      createdAt: new Date().toISOString()
    };
    await setDoc(doc(this.fb.db, 'users', profile.uid), profile);
    this.currentUser.set(profile);
    return profile;
  }

  /**
   * Crea l'account di un nuovo cliente da parte del coach loggato.
   * Usa una istanza Firebase secondaria e temporanea per non perdere
   * la sessione del coach (createUserWithEmailAndPassword altrimenti
   * autenticherebbe il nuovo utente al posto del coach nell'app principale).
   */
  async createClientAccount(displayName: string, email: string): Promise<NewClientResult> {
    const coach = this.currentUser();
    if (!coach || coach.role !== 'coach') {
      throw new Error('Solo un coach puo\' creare un account cliente.');
    }

    const tempPassword = generateTempPassword();
    const pairingCode = generateCode();

    const secondaryApp = initializeApp(environment.firebase, `secondary-${Date.now()}`);
    try {
      const secondaryAuth = getAuth(secondaryApp);
      await setPersistence(secondaryAuth, inMemoryPersistence);
      const secondaryDb = getFirestore(secondaryApp);
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email.trim(), tempPassword);

      const profile: UserProfile = {
        uid: cred.user.uid,
        email: email.trim(),
        displayName: displayName.trim(),
        role: 'client',
        pairingCode,
        coachId: coach.uid,
        paired: false,
        createdAt: new Date().toISOString()
      };
      // Scritto usando il Firestore dell'app SECONDARIA: la' l'utente autenticato
      // e' il client appena creato, e la regola richiede request.auth.uid == uid.
      // Usare il Firestore dell'app primaria scriverebbe come il coach, non
      // come il client, e la regola rifiuterebbe la creazione.
      await setDoc(doc(secondaryDb, 'users', profile.uid), profile);
      await signOut(secondaryAuth);

      return { email: profile.email, tempPassword, pairingCode };
    } finally {
      await deleteApp(secondaryApp);
    }
  }

  /** Lista dei clienti associati al coach loggato. */
  async listClients(): Promise<UserProfile[]> {
    const coach = this.currentUser();
    if (!coach || coach.role !== 'coach') return [];
    const q = query(
      collection(this.fb.db, 'users'),
      where('role', '==', 'client'),
      where('coachId', '==', coach.uid)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as UserProfile);
  }

  get isCoach(): boolean {
    return this.currentUser()?.role === 'coach';
  }

  get isClient(): boolean {
    return this.currentUser()?.role === 'client';
  }
}
