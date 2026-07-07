import { Injectable, signal, NgZone, ApplicationRef } from '@angular/core';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  query,
  collection,
  where,
  getDocs
} from 'firebase/firestore';
import { FirebaseService } from './firebase.service';
import { UserProfile } from '../models/user.model';
import { ZoneFixService } from '../utils/zone.util';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // esclusi 0/O/1/I/L per leggibilita'

function generateCode(length = 6): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return out;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  currentUser = signal<UserProfile | null>(null);
  authReady = signal(false);

  private readyResolve!: () => void;
  readonly ready: Promise<void> = new Promise(res => { this.readyResolve = res; });

  constructor(
    private fb: FirebaseService,
    private zone: NgZone,
    private zoneFix: ZoneFixService,
    private appRef: ApplicationRef
  ) {
    onAuthStateChanged(this.fb.auth, async (fbUser: User | null) => {
      // L'SDK Firebase puo' invocare questo callback fuori dalla zone di
      // Angular: senza zone.run() i signal si aggiornerebbero ma la vista
      // (navbar/tabbar/guard) non si ridisegnerebbe di conseguenza.
      await this.zone.run(async () => {
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
      setTimeout(() => this.appRef.tick(), 0);
    });
  }

  private async loadProfile(uid: string): Promise<UserProfile | null> {
    const snap = await getDoc(doc(this.fb.db, 'users', uid));
    return snap.exists() ? (snap.data() as UserProfile) : null;
  }

  login(email: string, password: string): Promise<UserProfile> {
    return this.zoneFix.run((async () => {
      const cred = await signInWithEmailAndPassword(this.fb.auth, email.trim(), password);
      const profile = await this.loadProfile(cred.user.uid);

      if (!profile) {
        await signOut(this.fb.auth);
        throw new Error('Profilo utente non trovato.');
      }

      this.currentUser.set(profile);
      return profile;
    })());
  }

  logout(): Promise<void> {
    return this.zoneFix.run((async () => {
      await signOut(this.fb.auth);
      this.currentUser.set(null);
    })());
  }

  /**
   * Registrazione di un nuovo coach. Genera anche il suo codice univoco
   * (coachCodes/{code} -> coachId), che il coach comunichera' ai propri
   * client perche' possano accoppiarsi in fase di registrazione.
   */
  registerCoach(email: string, password: string, displayName: string): Promise<UserProfile> {
    return this.zoneFix.run((async () => {
      const cred = await createUserWithEmailAndPassword(this.fb.auth, email.trim(), password);
      const pairingCode = generateCode();
      const profile: UserProfile = {
        uid: cred.user.uid,
        email: email.trim(),
        displayName: displayName.trim(),
        role: 'coach',
        pairingCode,
        coachId: null,
        paired: true,
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(this.fb.db, 'users', profile.uid), profile);
      await setDoc(doc(this.fb.db, 'coachCodes', pairingCode), { coachId: profile.uid });
      this.currentUser.set(profile);
      return profile;
    })());
  }

  /**
   * Registrazione di un nuovo client: si accoppia da solo inserendo il
   * codice univoco del proprio coach (verificato tramite coachCodes,
   * leggibile pubblicamente anche prima di avere un account).
   */
  registerClient(displayName: string, email: string, password: string, coachCode: string): Promise<UserProfile> {
    return this.zoneFix.run((async () => {
      const code = coachCode.trim().toUpperCase();
      if (!code) throw new Error('Inserisci il codice del tuo coach.');

      const codeSnap = await getDoc(doc(this.fb.db, 'coachCodes', code));
      if (!codeSnap.exists()) {
        throw new Error('Codice coach non valido. Controlla di averlo scritto correttamente.');
      }
      const coachId = (codeSnap.data() as { coachId: string }).coachId;

      const cred = await createUserWithEmailAndPassword(this.fb.auth, email.trim(), password);
      const profile: UserProfile = {
        uid: cred.user.uid,
        email: email.trim(),
        displayName: displayName.trim(),
        role: 'client',
        pairingCode: generateCode(),
        coachId,
        paired: true,
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(this.fb.db, 'users', profile.uid), profile);
      this.currentUser.set(profile);
      return profile;
    })());
  }

  /** Lista dei clienti associati al coach loggato. */
  listClients(): Promise<UserProfile[]> {
    return this.zoneFix.run((async () => {
      const coach = this.currentUser();
      if (!coach || coach.role !== 'coach') return [];
      const q = query(
        collection(this.fb.db, 'users'),
        where('role', '==', 'client'),
        where('coachId', '==', coach.uid)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as UserProfile);
    })());
  }

  /**
   * Ripara gli account coach creati prima dell'introduzione della mappa
   * pubblica coachCodes: se manca la voce di lookup per il proprio codice,
   * la ricrea. Idempotente, sicuro da richiamare ad ogni apertura pagina.
   */
  ensureCoachCode(): Promise<void> {
    return this.zoneFix.run((async () => {
      const coach = this.currentUser();
      if (!coach || coach.role !== 'coach' || !coach.pairingCode) return;
      const codeSnap = await getDoc(doc(this.fb.db, 'coachCodes', coach.pairingCode));
      if (!codeSnap.exists()) {
        await setDoc(doc(this.fb.db, 'coachCodes', coach.pairingCode), { coachId: coach.uid });
      }
    })());
  }

  get isCoach(): boolean {
    return this.currentUser()?.role === 'coach';
  }

  get isClient(): boolean {
    return this.currentUser()?.role === 'client';
  }
}
