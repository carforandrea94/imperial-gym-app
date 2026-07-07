import { Injectable } from '@angular/core';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { Analytics, getAnalytics, isSupported } from 'firebase/analytics';
import { environment } from '../../../environments/environment';

/**
 * Inizializza l'app Firebase (progetto imperial-gym-app) ed espone
 * le istanze di Firestore e Auth usate in tutta l'app.
 * Analytics viene attivato solo se supportato dal browser corrente
 * (evita errori su ambienti non-HTTPS / non compatibili).
 */
@Injectable({ providedIn: 'root' })
export class FirebaseService {
  readonly app: FirebaseApp;
  readonly db: Firestore;
  readonly auth: Auth;
  analytics: Analytics | null = null;

  constructor() {
    this.app = initializeApp(environment.firebase);
    this.db = getFirestore(this.app);
    this.auth = getAuth(this.app);

    isSupported()
      .then(ok => {
        if (ok) this.analytics = getAnalytics(this.app);
      })
      .catch(() => { /* analytics non disponibile in questo contesto */ });
  }
}
