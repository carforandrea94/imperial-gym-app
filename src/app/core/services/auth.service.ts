import { Injectable, signal, NgZone, ApplicationRef } from '@angular/core';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
  User
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  collection,
  where,
  getDocs
} from 'firebase/firestore';
import { FirebaseService } from './firebase.service';
import { UserProfile, Sex } from '../models/user.model';
import { ZoneFixService } from '../utils/zone.util';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // esclusi 0/O/1/I/L per leggibilita'

/**
 * L'accesso e' riuscito ma il profilo non c'e'.
 *
 * Succede quando la registrazione ha creato l'utente su Auth e poi non e'
 * riuscita a scrivere il documento del profilo. Chi ci finisce dentro non
 * entra ("profilo non trovato") e non puo' nemmeno reiscriversi ("email gia'
 * registrata"): senza un codice riconoscibile qui, l'unica uscita sarebbe
 * cancellare l'utente dalla console di Firebase.
 *
 * Chi lo riceve NON e' scollegato: la sessione serve a scrivere il profilo che
 * manca, ed e' l'unica cosa che quella sessione puo' fare, perche' currentUser
 * resta nullo e le guardie rimandano all'accesso.
 */
export const PROFILE_MISSING = 'app/profile-missing';

/**
 * Le raccolte personali di un utente, quelle che si cancellano insieme al suo
 * account. Non ci sono i protocolli: li scrive il coach e vanno tolti a parte,
 * con il permesso che le regole danno al proprietario solo per la
 * cancellazione.
 */
const SOTTORACCOLTE = ['sessions', 'runs', 'measurements', 'state'] as const;

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

  /** Genera un codice coach garantito univoco, riprovando in caso di rara collisione. */
  private async generateUniqueCoachCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = generateCode();
      const snap = await getDoc(doc(this.fb.db, 'coachCodes', code));
      if (!snap.exists()) return code;
    }
    throw new Error('Impossibile generare un codice coach univoco, riprova.');
  }

  login(email: string, password: string): Promise<UserProfile> {
    return this.zoneFix.run((async () => {
      const cred = await signInWithEmailAndPassword(this.fb.auth, email.trim(), password);
      const profile = await this.loadProfile(cred.user.uid);

      if (!profile) {
        // Niente signOut: la sessione appena aperta e' quello che permette di
        // scrivere il profilo mancante (le regole consentono la creazione solo
        // all'utente stesso). Chiuderla renderebbe il guasto irreparabile.
        throw Object.assign(new Error('Profilo utente non trovato.'), { code: PROFILE_MISSING });
      }

      this.currentUser.set(profile);
      return profile;
    })());
  }

  /**
   * Manda l'email per reimpostare la password.
   *
   * Non dice se quell'indirizzo esiste, e Firebase nemmeno: su un indirizzo
   * sconosciuto non fallisce. Confermarlo vorrebbe dire far sapere a chiunque
   * quali indirizzi sono registrati, provandone uno per volta.
   */
  sendPasswordReset(email: string): Promise<void> {
    return this.zoneFix.run(sendPasswordResetEmail(this.fb.auth, email.trim()));
  }

  /**
   * Toglie l'utente appena creato su Auth quando la registrazione si e' rotta
   * a meta'. Se anche questo fallisce - ed e' probabile, visto che la causa
   * piu' comune e' la rete - non si dice nulla di nuovo: l'errore da mostrare
   * resta quello della registrazione, e chi resta bloccato lo recupera
   * all'accesso con completeClientProfile/completeCoachProfile.
   */
  private async rollbackAuthUser(user: User): Promise<void> {
    try {
      await deleteUser(user);
    } catch {
      /* resta l'utente orfano: lo raccoglie il recupero all'accesso */
    }
  }

  /** C'e' una sessione aperta senza profilo, cioe' un'iscrizione da finire. */
  hasPendingProfile(): boolean {
    return !!this.fb.auth.currentUser && !this.currentUser();
  }

  /** L'email della sessione da completare, da mostrare a chi la sta finendo. */
  pendingEmail(): string | null {
    return this.fb.auth.currentUser?.email ?? null;
  }

  /**
   * Scrive il profilo cliente che manca, sulla sessione gia' aperta.
   * E' la registrazione, meno la parte che era gia' riuscita.
   */
  completeClientProfile(displayName: string, coachCode: string): Promise<UserProfile> {
    return this.zoneFix.run((async () => {
      const user = this.fb.auth.currentUser;
      if (!user) throw new Error('Sessione scaduta. Accedi di nuovo.');

      const code = coachCode.trim().toUpperCase();
      if (!code) throw new Error('Inserisci il codice del tuo coach.');
      const codeSnap = await getDoc(doc(this.fb.db, 'coachCodes', code));
      if (!codeSnap.exists()) {
        throw new Error('Codice coach non valido. Controlla di averlo scritto correttamente.');
      }

      const profile: UserProfile = {
        uid: user.uid,
        email: user.email ?? '',
        displayName: displayName.trim(),
        role: 'client',
        pairingCode: generateCode(),
        coachId: (codeSnap.data() as { coachId: string }).coachId,
        paired: true,
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(this.fb.db, 'users', profile.uid), profile);
      this.currentUser.set(profile);
      return profile;
    })());
  }

  /** Come sopra, per chi si stava iscrivendo come coach. */
  completeCoachProfile(displayName: string): Promise<UserProfile> {
    return this.zoneFix.run((async () => {
      const user = this.fb.auth.currentUser;
      if (!user) throw new Error('Sessione scaduta. Accedi di nuovo.');

      const pairingCode = await this.generateUniqueCoachCode();
      const profile: UserProfile = {
        uid: user.uid,
        email: user.email ?? '',
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
   * Chiude l'account e cancella quello che si porta dietro.
   *
   * Chiede la password e rifa' l'accesso prima di toccare qualsiasi cosa: per
   * due motivi. Firebase rifiuta la cancellazione di un utente la cui sessione
   * e' vecchia (auth/requires-recent-login), e soprattutto e' un'azione che non
   * si annulla - scriverla e' la conferma, un tasto solo no.
   *
   * L'ordine non e' indifferente: prima i documenti, per ultimo l'utente.
   * Le regole permettono di cancellare i propri dati solo a chi e' collegato,
   * quindi chiudendo prima l'account resterebbero li' per sempre, senza piu'
   * nessuno che possa toglierli.
   *
   * Resta un caso che da qui non si copre: se la cancellazione dell'utente
   * fallisce dopo che i dati sono spariti, resta una sessione senza profilo.
   * E' lo stesso stato dell'iscrizione interrotta, e si riprova da capo.
   * Chiuderlo davvero vorrebbe dire farlo fare al server, non al telefono.
   */
  deleteAccount(password: string): Promise<void> {
    return this.zoneFix.run((async () => {
      const user = this.fb.auth.currentUser;
      const profile = this.currentUser();
      if (!user || !profile) throw new Error('Sessione scaduta. Accedi di nuovo.');
      if (!user.email) throw new Error('Questo account non ha un\'email: scrivi al tuo coach.');

      await reauthenticateWithCredential(
        user, EmailAuthProvider.credential(user.email, password)
      );

      // Un coach che se ne va lascerebbe i suoi clienti agganciati a un
      // coachId che non esiste piu': niente protocolli, niente avvisi, e
      // nessun modo di accorgersene dall'app.
      if (profile.role === 'coach') {
        const clienti = await this.listClients();
        if (clienti.length > 0) {
          throw new Error(
            `Hai ancora ${clienti.length} ${clienti.length === 1 ? 'cliente' : 'clienti'} collegati. ` +
            'Finche\' ci sono, chiudere l\'account li lascerebbe senza coach.'
          );
        }
      }

      for (const nome of SOTTORACCOLTE) {
        const snap = await getDocs(collection(this.fb.db, 'users', user.uid, nome));
        await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
      }
      const protocolli = await getDocs(collection(this.fb.db, 'users', user.uid, 'protocols'));
      await Promise.all(protocolli.docs.map(d => deleteDoc(d.ref)));

      await deleteDoc(doc(this.fb.db, 'users', user.uid));
      if (profile.role === 'coach' && profile.pairingCode) {
        // Senza questo il codice resterebbe valido: chi lo usasse si
        // iscriverebbe a un coach che non c'e' piu'.
        await deleteDoc(doc(this.fb.db, 'coachCodes', profile.pairingCode));
      }

      await deleteUser(user);
      this.currentUser.set(null);
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
      let profileWritten = false;
      try {
        const pairingCode = await this.generateUniqueCoachCode();
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
        profileWritten = true;
        await setDoc(doc(this.fb.db, 'coachCodes', pairingCode), { coachId: profile.uid });
        this.currentUser.set(profile);
        return profile;
      } catch (e) {
        // Solo se il profilo NON e' stato scritto: se a mancare e' la voce
        // pubblica del codice, l'account e' sano e ensureCoachCode la rifa'
        // da sola al primo accesso. Cancellare li' vorrebbe dire buttare via
        // un account funzionante.
        if (!profileWritten) await this.rollbackAuthUser(cred.user);
        throw e;
      }
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
      try {
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
      } catch (e) {
        // L'utente su Auth c'e' gia' e il profilo no: lasciarlo li' chiude
        // fuori per sempre chi ci ha provato. Toglierlo rimette le cose come
        // prima del tentativo, e "riprova" torna a voler dire qualcosa.
        await this.rollbackAuthUser(cred.user);
        throw e;
      }
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
  /**
   * Salva i dati del corpo sul profilo: altezza, sesso, data di nascita, o
   * un sottoinsieme qualsiasi. `null` toglie il valore.
   *
   * Sono gli unici campi del profilo che l'utente cambia da solo, e stanno qui
   * e non fra le misurazioni perche' si dichiarano una volta e restano: in
   * `MeasurementEntry` l'app li richiederebbe a ogni controllo, accanto a peso
   * e pliche, che invece cambiano ogni volta.
   *
   * Scrive in merge invece che rimpiazzare il documento: il profilo porta
   * campi che quella schermata non conosce (pairingCode, coachId, paired) e
   * una scrittura piena li azzererebbe.
   *
   * Aggiorna anche il signal, altrimenti il valore resterebbe quello vecchio
   * fino al prossimo accesso: `currentUser` non rilegge da solo.
   */
  patchBody(patch: { heightCm?: number | null; sex?: Sex | null; birthDate?: string | null }): Promise<void> {
    return this.zoneFix.run((async () => {
      const user = this.currentUser();
      if (!user) throw new Error('Nessun utente collegato.');
      await setDoc(doc(this.fb.db, 'users', user.uid), patch, { merge: true });
      this.currentUser.set({ ...user, ...patch });
    })());
  }

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
