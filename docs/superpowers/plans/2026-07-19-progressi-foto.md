# Card "Progressi" (foto cliente) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere una nuova capacità "Progressi": il cliente carica 3 foto (Fronte, Retro, Laterale) in un record datato, vede lo storico dei propri progressi, e confronta due record selezionati foto-per-foto (stesso tipo con stesso tipo). Il coach può vedere la stessa lista e fare lo stesso confronto in sola lettura.

**Architecture:** Nuova collezione Firestore `users/{uid}/progressi/{date}` (data come ID documento, un record al giorno) con gli URL di 3 foto caricate su Firebase Storage (prima integrazione Storage in questo progetto — il bucket è già configurato ma il modulo non è mai stato importato). Un `ProgressiDataService` unico, parametrizzato per `uid` esplicito (stesso pattern già usato da `ProtocolService.listForClient(clientId)`), serve sia il cliente che il coach. Componenti di lista e confronto sono condivisi tra le due rotte (cliente/coach): rilevano il contesto leggendo il parametro di rotta `clientId` (se presente, modalità coach/sola-lettura; altrimenti cliente, uid proprio).

**Tech Stack:** Angular 21 standalone components, Firebase Firestore + Storage (via `firebase` npm package già presente, nessuna nuova dipendenza), Vitest.

## Global Constraints

- Un solo record progressi al giorno: `date` (`YYYY-MM-DD`) è l'ID del documento Firestore, un nuovo salvataggio nello stesso giorno sovrascrive il precedente (stesso pattern di `measurements`).
- Tutte e 3 le foto (Fronte, Retro, Laterale) sono obbligatorie per salvare: il bottone "Salva" resta disabilitato finché non sono tutte presenti.
- Ogni foto viene ridimensionata lato client (canvas, lato lungo massimo 1080px, JPEG qualità 0.85) prima dell'upload.
- Lista progressi: tap ovunque sulla riga (non solo sulla checkbox) attiva/disattiva la selezione. Selezionando una terza riga quando già 2 sono selezionate, la meno recente delle 2 si deseleziona automaticamente (mai più di 2 selezionate contemporaneamente).
- Il coach vede la lista e il confronto in sola lettura: nessun bottone "+ Nuovo progresso", nessuna eliminazione, nessun upload.
- `.set-check`/`.meal-check` (checkbox esistenti in altre parti dell'app) restano invariate: la checkbox di selezione della lista progressi usa una classe dedicata `.progressi-check`.
- `.variant-tabs` ed `.exslider-dashes`/`.exslider-dash` (già esistenti e usate altrove nell'app) vengono riusate senza modifiche per i tab Fronte/Retro/Laterale del confronto.
- **Ogni nuova rotta aggiunta in `app.routes.ts` deve avere il corrispondente blocco in `src/app/app.ts` — sia in `updateNav()` (titolo/sottotitolo navbar, altrimenti resta quello della pagina precedente) sia in `onBack()` (bersaglio del tasto indietro, altrimenti torna a `/scheda` di default).** Questo pattern è già così per tutte le rotte esistenti — non è opzionale.
- L'ordine delle rotte in `app.routes.ts` conta: `/misure/progressi` (esattamente un segmento dopo `misure/`) deve essere registrata **prima** di `misure/:categoria` nell'array, altrimenti Angular la instraderebbe erroneamente a `MisuraCategoriaComponent`.

---

## File Structure

- `src/app/core/services/firebase.service.ts` — estesa con l'istanza `Storage`.
- `src/app/models/progressi.model.ts` — nuovo, `ProgressiRecord`, `ProgressiPhotoType`, etichette e ordine dei tipi.
- `src/app/services/progressi-data.service.ts` — nuovo, CRUD Firestore + Storage.
- `src/app/core/utils/image-resize.util.ts` — nuovo, ridimensionamento immagine.
- `src/app/core/utils/progressi-selection.util.ts` — nuovo, logica di selezione a coppie.
- `firestore.rules`, `storage.rules` (nuovo), `firebase.json`, `.github/workflows/firebase-deploy.yml` — regole di sicurezza e deploy.
- `src/app/pages/progressi-list/*` — nuovo, lista (condivisa cliente/coach).
- `src/app/pages/progressi-upload/*` — nuovo, upload (solo cliente).
- `src/app/pages/progressi-confronto/*` — nuovo, confronto (condiviso cliente/coach).
- `src/app/pages/misure/misure.component.ts/.html` — nuova voce "Progressi".
- `src/app/pages/coach-client-detail/coach-client-detail.component.ts/.html` — ristrutturata (due righe di navigazione invece della lista protocolli inline).
- `src/app/pages/coach-client-protocolli/*` — nuovo, riceve la lista protocolli oggi inline in coach-client-detail.
- `src/app/app.routes.ts`, `src/app/app.ts` — nuove rotte e relativi blocchi navbar/back.

---

### Task 1: Firebase Storage + modello dati + `ProgressiDataService`

**Files:**
- Modify: `src/app/core/services/firebase.service.ts`
- Create: `src/app/models/progressi.model.ts`
- Create: `src/app/services/progressi-data.service.ts`

**Interfaces:**
- Produces: `FirebaseService.storage: FirebaseStorage`; `ProgressiRecord`, `ProgressiPhotoType`, `PROGRESSI_PHOTO_TYPES`, `PROGRESSI_PHOTO_LABELS`; `ProgressiDataService.loadHistory(uid)`, `.save(uid, date, files)`, `.delete(uid, date)` — usati da tutte le task successive.

- [ ] **Step 1: Estendi `FirebaseService` con Firebase Storage**

In `src/app/core/services/firebase.service.ts`, trova:

```ts
import { Injectable } from '@angular/core';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { initializeFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { Analytics, getAnalytics, isSupported } from 'firebase/analytics';
import { environment } from '../../../environments/environment';
```

Sostituisci con:

```ts
import { Injectable } from '@angular/core';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { initializeFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { Analytics, getAnalytics, isSupported } from 'firebase/analytics';
import { environment } from '../../../environments/environment';
```

Poi trova:

```ts
export class FirebaseService {
  readonly app: FirebaseApp;
  readonly db: Firestore;
  readonly auth: Auth;
  analytics: Analytics | null = null;

  constructor() {
    this.app = initializeApp(environment.firebase);
```

Sostituisci con:

```ts
export class FirebaseService {
  readonly app: FirebaseApp;
  readonly db: Firestore;
  readonly auth: Auth;
  readonly storage: FirebaseStorage;
  analytics: Analytics | null = null;

  constructor() {
    this.app = initializeApp(environment.firebase);
```

Poi trova:

```ts
    this.auth = getAuth(this.app);

    isSupported()
```

Sostituisci con:

```ts
    this.auth = getAuth(this.app);
    this.storage = getStorage(this.app);

    isSupported()
```

- [ ] **Step 2: Crea il modello dati**

Crea `src/app/models/progressi.model.ts`:

```ts
export interface ProgressiRecord {
  date: string; // ISO yyyy-mm-dd, anche ID documento
  fronteUrl: string;
  retroUrl: string;
  lateraleUrl: string;
}

export type ProgressiPhotoType = 'fronte' | 'retro' | 'laterale';

export const PROGRESSI_PHOTO_LABELS: Record<ProgressiPhotoType, string> = {
  fronte: 'Fronte',
  retro: 'Retro',
  laterale: 'Laterale'
};

// L'ordine qui e' l'ordine in cui vengono mostrati i riquadri di upload e i
// tab di confronto. Task successive (ProgressiUploadComponent) si aspettano
// che questo array abbia esattamente questi 3 elementi in questo ordine.
export const PROGRESSI_PHOTO_TYPES: ProgressiPhotoType[] = ['fronte', 'retro', 'laterale'];
```

- [ ] **Step 3: Crea `ProgressiDataService`**

Crea `src/app/services/progressi-data.service.ts`:

```ts
import { Injectable } from '@angular/core';
import { doc, getDocs, setDoc, deleteDoc, collection } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { FirebaseService } from '../core/services/firebase.service';
import { ZoneFixService } from '../core/utils/zone.util';
import { ProgressiRecord } from '../models/progressi.model';

@Injectable({ providedIn: 'root' })
export class ProgressiDataService {
  constructor(private fb: FirebaseService, private zoneFix: ZoneFixService) {}

  private col(uid: string) {
    return collection(this.fb.db, 'users', uid, 'progressi');
  }

  loadHistory(uid: string): Promise<ProgressiRecord[]> {
    return this.zoneFix.run((async () => {
      const snap = await getDocs(this.col(uid));
      return snap.docs
        .map(d => d.data() as ProgressiRecord)
        .sort((a, b) => b.date.localeCompare(a.date));
    })());
  }

  save(uid: string, date: string, files: { fronte: Blob; retro: Blob; laterale: Blob }): Promise<void> {
    return this.zoneFix.run((async () => {
      const [fronteUrl, retroUrl, lateraleUrl] = await Promise.all([
        this.uploadOne(uid, date, 'fronte', files.fronte),
        this.uploadOne(uid, date, 'retro', files.retro),
        this.uploadOne(uid, date, 'laterale', files.laterale)
      ]);
      const record: ProgressiRecord = { date, fronteUrl, retroUrl, lateraleUrl };
      await setDoc(doc(this.col(uid), date), record);
    })());
  }

  delete(uid: string, date: string): Promise<void> {
    return this.zoneFix.run((async () => {
      await Promise.all(['fronte', 'retro', 'laterale'].map(type =>
        deleteObject(ref(this.fb.storage, `users/${uid}/progressi/${date}/${type}.jpg`)).catch(() => {})
      ));
      await deleteDoc(doc(this.col(uid), date));
    })());
  }

  private async uploadOne(uid: string, date: string, type: string, blob: Blob): Promise<string> {
    const fileRef = ref(this.fb.storage, `users/${uid}/progressi/${date}/${type}.jpg`);
    await uploadBytes(fileRef, blob);
    return getDownloadURL(fileRef);
  }
}
```

Nota: `delete()` ignora silenziosamente eventuali errori nella cancellazione dei singoli file Storage (`.catch(() => {})`) — se un file non esiste già (es. cancellazione ripetuta), non deve bloccare la cancellazione del documento Firestore.

- [ ] **Step 4: Verifica che il progetto compili e i test passino**

Run: `npx ng build`
Expected: nessun errore.

Run: `npx ng test --watch=false`
Expected: tutti i test passano (nessuna regressione — nessun test esistente tocca questi file nuovi/modificati; `ProtocolService`/`MeasurementDataService`, che seguono lo stesso pattern, non hanno spec dedicati, quindi non ne serve uno neanche qui).

- [ ] **Step 5: Commit**

```bash
git add src/app/core/services/firebase.service.ts src/app/models/progressi.model.ts src/app/services/progressi-data.service.ts
git commit -m "Aggiunge Firebase Storage, modello dati e ProgressiDataService"
```

---

### Task 2: Funzioni pure — ridimensionamento immagine + logica di selezione

**Files:**
- Create: `src/app/core/utils/image-resize.util.ts`
- Create: `src/app/core/utils/image-resize.util.spec.ts`
- Create: `src/app/core/utils/progressi-selection.util.ts`
- Create: `src/app/core/utils/progressi-selection.util.spec.ts`

**Interfaces:**
- Produces: `resizeImageFile(file: File, maxDim?: number, quality?: number): Promise<Blob>`, `computeScaledDimensions(width: number, height: number, maxDim: number): {width: number; height: number}` — usate da Task 4 (upload). `toggleSelection(selected: string[], date: string): string[]` — usata da Task 4 (lista).

- [ ] **Step 1: Scrivi il test per `computeScaledDimensions` (fallisce)**

Crea `src/app/core/utils/image-resize.util.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeScaledDimensions } from './image-resize.util';

describe('computeScaledDimensions', () => {
  it('non ridimensiona se gia\' entro il limite', () => {
    expect(computeScaledDimensions(800, 600, 1080)).toEqual({ width: 800, height: 600 });
  });

  it('ridimensiona un\'immagine landscape piu\' larga del limite', () => {
    expect(computeScaledDimensions(2000, 1500, 1080)).toEqual({ width: 1080, height: 810 });
  });

  it('ridimensiona un\'immagine portrait piu\' alta del limite', () => {
    expect(computeScaledDimensions(1500, 2000, 1080)).toEqual({ width: 810, height: 1080 });
  });

  it('non ridimensiona se esattamente al limite', () => {
    expect(computeScaledDimensions(1080, 1080, 1080)).toEqual({ width: 1080, height: 1080 });
  });

  it('non ingrandisce immagini piu\' piccole del limite', () => {
    expect(computeScaledDimensions(200, 150, 1080)).toEqual({ width: 200, height: 150 });
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npx ng test --watch=false --include='**/image-resize.util.spec.ts'`
Expected: FAIL — `Cannot find module './image-resize.util'` (il file non esiste ancora).

- [ ] **Step 3: Implementa `image-resize.util.ts`**

Crea `src/app/core/utils/image-resize.util.ts`:

```ts
/** Calcola le dimensioni scalate mantenendo l'aspect ratio, senza mai ingrandire. */
export function computeScaledDimensions(width: number, height: number, maxDim: number): { width: number; height: number } {
  if (width <= maxDim && height <= maxDim) return { width, height };
  const scale = maxDim / Math.max(width, height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Ridimensiona un file immagine via canvas prima dell'upload, per non
 * caricare foto da diversi MB direttamente dalla fotocamera. Richiede un
 * vero browser (Image/canvas) — non e' unit-testato, verificato
 * manualmente nella task di integrazione (upload).
 */
export function resizeImageFile(file: File, maxDim = 1080, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const { width, height } = computeScaledDimensions(img.naturalWidth, img.naturalHeight, maxDim);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas context non disponibile'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => {
        URL.revokeObjectURL(url);
        if (blob) resolve(blob); else reject(new Error('Impossibile generare il blob immagine'));
      }, 'image/jpeg', quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Impossibile caricare l'immagine"));
    };
    img.src = url;
  });
}
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npx ng test --watch=false --include='**/image-resize.util.spec.ts'`
Expected: PASS — 5/5 test.

- [ ] **Step 5: Scrivi il test per `toggleSelection` (fallisce)**

Crea `src/app/core/utils/progressi-selection.util.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { toggleSelection } from './progressi-selection.util';

describe('toggleSelection', () => {
  it('aggiunge una data se la selezione e\' vuota', () => {
    expect(toggleSelection([], '2026-07-10')).toEqual(['2026-07-10']);
  });

  it('aggiunge una seconda data', () => {
    expect(toggleSelection(['2026-07-10'], '2026-07-15')).toEqual(['2026-07-10', '2026-07-15']);
  });

  it('deseleziona una data gia\' selezionata', () => {
    expect(toggleSelection(['2026-07-10', '2026-07-15'], '2026-07-10')).toEqual(['2026-07-15']);
  });

  it('con 2 gia\' selezionate, scarta la meno recente e aggiunge la nuova', () => {
    expect(toggleSelection(['2026-07-10', '2026-07-15'], '2026-07-20')).toEqual(['2026-07-15', '2026-07-20']);
  });

  it('scarta la meno recente indipendentemente dall\'ordine nell\'array', () => {
    expect(toggleSelection(['2026-07-15', '2026-07-10'], '2026-07-20')).toEqual(['2026-07-15', '2026-07-20']);
  });
});
```

- [ ] **Step 6: Esegui il test e verifica che fallisca**

Run: `npx ng test --watch=false --include='**/progressi-selection.util.spec.ts'`
Expected: FAIL — `Cannot find module './progressi-selection.util'`.

- [ ] **Step 7: Implementa `progressi-selection.util.ts`**

Crea `src/app/core/utils/progressi-selection.util.ts`:

```ts
/**
 * Alterna la selezione di una data nella lista progressi, mantenendo al
 * massimo 2 elementi selezionati. Se una data e' gia' selezionata, la
 * rimuove. Se sono gia' selezionate 2 date e se ne sceglie una terza, la
 * meno recente delle 2 (data piu' piccola, le date YYYY-MM-DD si ordinano
 * correttamente come stringhe) viene scartata per far posto alla nuova.
 */
export function toggleSelection(selected: string[], date: string): string[] {
  if (selected.includes(date)) {
    return selected.filter(d => d !== date);
  }
  if (selected.length < 2) {
    return [...selected, date];
  }
  const [, newest] = [...selected].sort();
  return [newest, date];
}
```

- [ ] **Step 8: Esegui il test e verifica che passi**

Run: `npx ng test --watch=false --include='**/progressi-selection.util.spec.ts'`
Expected: PASS — 5/5 test.

- [ ] **Step 9: Verifica build e suite completa**

Run: `npx ng build`
Expected: nessun errore.

Run: `npx ng test --watch=false`
Expected: tutti i test passano (10 test in più rispetto alla baseline pre-Task-1: 5 + 5).

- [ ] **Step 10: Commit**

```bash
git add src/app/core/utils/image-resize.util.ts src/app/core/utils/image-resize.util.spec.ts src/app/core/utils/progressi-selection.util.ts src/app/core/utils/progressi-selection.util.spec.ts
git commit -m "Aggiunge funzioni pure: ridimensionamento immagine e logica di selezione progressi"
```

---

### Task 3: Regole di sicurezza Firestore + Storage e CI

**Files:**
- Modify: `firestore.rules`
- Create: `storage.rules`
- Modify: `firebase.json`
- Modify: `.github/workflows/firebase-deploy.yml`

**Interfaces:**
- Nessuna interfaccia di codice — questa task è infrastrutturale (regole di sicurezza + pipeline di deploy), non tocca file TypeScript/Angular.

- [ ] **Step 1: Aggiungi la regola Firestore per `progressi`**

In `firestore.rules`, trova il blocco `match /protocols/{id} { ... }` (dentro `match /users/{uid} { ... }`):

```
      match /protocols/{id} {
        allow read: if isSignedIn() && (
          request.auth.uid == uid ||
          get(/databases/$(database)/documents/users/$(uid)).data.coachId == request.auth.uid
        );
        allow write: if isSignedIn() &&
          get(/databases/$(database)/documents/users/$(uid)).data.coachId == request.auth.uid;
      }
    }
```

Sostituisci con (aggiunge il nuovo blocco `progressi` subito dopo `protocols`, prima della chiusura di `match /users/{uid}`):

```
      match /protocols/{id} {
        allow read: if isSignedIn() && (
          request.auth.uid == uid ||
          get(/databases/$(database)/documents/users/$(uid)).data.coachId == request.auth.uid
        );
        allow write: if isSignedIn() &&
          get(/databases/$(database)/documents/users/$(uid)).data.coachId == request.auth.uid;
      }

      // Foto progressi caricate dal cliente. A differenza di "protocols"
      // (dove scrive il coach), qui scrive solo il proprietario; il coach
      // puo' solo leggere (prima condivisione di un dato "personale" del
      // cliente in questa direzione — misurazioni/sessioni restano private).
      match /progressi/{id} {
        allow read: if isSignedIn() && (
          request.auth.uid == uid ||
          get(/databases/$(database)/documents/users/$(uid)).data.coachId == request.auth.uid
        );
        allow write: if isSignedIn() && request.auth.uid == uid;
      }
    }
```

- [ ] **Step 2: Crea le regole Storage**

Crea `storage.rules`:

```
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    // Foto progressi: stessa logica di firestore.rules per la collezione
    // "progressi" (lettura proprietario+coach, scrittura solo proprietario),
    // qui espressa leggendo il campo coachId del profilo cliente via
    // firestore.get() dalle regole Storage.
    match /users/{uid}/progressi/{allPaths=**} {
      allow read: if request.auth != null && (
        request.auth.uid == uid ||
        firestore.get(/databases/(default)/documents/users/$(uid)).data.coachId == request.auth.uid
      );
      allow write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

- [ ] **Step 3: Registra le regole Storage in `firebase.json`**

In `firebase.json`, trova:

```json
  "firestore": {
    "database": "(default)",
    "location": "eur3",
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "database": {
    "rules": "database.rules.json"
  }
}
```

Sostituisci con:

```json
  "firestore": {
    "database": "(default)",
    "location": "eur3",
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "storage": {
    "rules": "storage.rules"
  },
  "database": {
    "rules": "database.rules.json"
  }
}
```

- [ ] **Step 4: Estendi il deploy CI per includere le regole Storage**

In `.github/workflows/firebase-deploy.yml`, trova:

```yaml
      - name: Deploy Firestore rules
        run: |
          echo '${{ secrets.FIREBASE_SERVICE_ACCOUNT_IMPERIAL_GYM_APP }}' > /tmp/gcp-key.json
          export GOOGLE_APPLICATION_CREDENTIALS=/tmp/gcp-key.json
          npx firebase-tools deploy --only firestore:rules,firestore:indexes --project imperial-gym-app --non-interactive
          rm -f /tmp/gcp-key.json
```

Sostituisci con:

```yaml
      - name: Deploy Firestore and Storage rules
        run: |
          echo '${{ secrets.FIREBASE_SERVICE_ACCOUNT_IMPERIAL_GYM_APP }}' > /tmp/gcp-key.json
          export GOOGLE_APPLICATION_CREDENTIALS=/tmp/gcp-key.json
          npx firebase-tools deploy --only firestore:rules,firestore:indexes,storage:rules --project imperial-gym-app --non-interactive
          rm -f /tmp/gcp-key.json
```

- [ ] **Step 5: Verifica che il progetto compili e i test passino**

Run: `npx ng build`
Expected: nessun errore (questi file non fanno parte del bundle Angular, ma verifichiamo comunque che nulla si sia rotto).

Run: `npx ng test --watch=false`
Expected: tutti i test passano, nessuna regressione.

Nota: le regole effettive vengono verificate solo dopo il deploy automatico su `main` (il workflow CI esistente le distribuisce ad ogni push) — non c'e' modo di testarle localmente in questo ambiente. Va verificato manualmente dopo il merge che un cliente non possa leggere i progressi di un altro cliente e che un coach non possa scrivere/eliminare i progressi di un cliente (vedi test plan della spec).

- [ ] **Step 6: Commit**

```bash
git add firestore.rules storage.rules firebase.json .github/workflows/firebase-deploy.yml
git commit -m "Aggiunge regole di sicurezza Firestore+Storage per progressi e deploy CI"
```

---

### Task 4: `ProgressiListComponent` + voce "Progressi" in Misure

**Files:**
- Create: `src/app/pages/progressi-list/progressi-list.component.ts`
- Create: `src/app/pages/progressi-list/progressi-list.component.html`
- Modify: `src/app/pages/misure/misure.component.ts`
- Modify: `src/app/pages/misure/misure.component.html`
- Modify: `src/app/app.routes.ts`
- Modify: `src/app/app.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `ProgressiDataService.loadHistory(uid)`/`.delete(uid, date)` (Task 1), `toggleSelection` (Task 2).
- Produces: rotte `/misure/progressi` e `/coach/clienti/:clientId/progressi` funzionanti; nessun'altra task dipende da simboli esportati da questo componente (il componente stesso viene solo referenziato per path da altre rotte in Task 7).

- [ ] **Step 1: Crea `ProgressiListComponent`**

Crea `src/app/pages/progressi-list/progressi-list.component.ts`:

```ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ProgressiDataService } from '../../services/progressi-data.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { AuthService } from '../../core/services/auth.service';
import { ProgressiRecord } from '../../models/progressi.model';
import { toggleSelection } from '../../core/utils/progressi-selection.util';

interface ProgressiRow {
  record: ProgressiRecord;
  displayDate: string;
}

@Component({
  selector: 'app-progressi-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './progressi-list.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class ProgressiListComponent implements OnInit {
  rows: ProgressiRow[] = [];
  selected: string[] = [];
  loading = true;
  errorMsg = '';
  readonly = false;
  private uid = '';
  private clientId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private data: ProgressiDataService,
    private confirm: ConfirmDialogService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.clientId = this.route.snapshot.paramMap.get('clientId');
    this.readonly = !!this.clientId;
    this.uid = this.clientId ?? this.auth.currentUser()!.uid;
    this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.errorMsg = '';

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 12000)
    );

    try {
      const history = await Promise.race([this.data.loadHistory(this.uid), timeout]);
      this.rows = history.map(record => {
        const d = new Date(record.date + 'T00:00:00');
        const displayDate = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        return { record, displayDate };
      });
    } catch (e: any) {
      console.error('Errore caricamento progressi:', e);
      this.errorMsg = e?.message === 'TIMEOUT'
        ? 'La connessione sta impiegando troppo tempo. Controlla la rete e riprova.'
        : 'Errore nel caricamento. Riprova.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  toggleRow(date: string): void {
    this.selected = toggleSelection(this.selected, date);
  }

  isSelected(date: string): boolean {
    return this.selected.includes(date);
  }

  compare(): void {
    const [d1, d2] = [...this.selected].sort();
    if (this.readonly) {
      this.router.navigate(['/coach/clienti', this.clientId, 'progressi', 'confronto', d1, d2]);
    } else {
      this.router.navigate(['/misure/progressi/confronto', d1, d2]);
    }
  }

  newProgressi(): void {
    this.router.navigate(['/misure/progressi/nuovo']);
  }

  async deleteEntry(date: string, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    const ok = await this.confirm.confirm('Eliminare questo record progressi?');
    if (ok) {
      await this.data.delete(this.uid, date);
      this.selected = this.selected.filter(d => d !== date);
      await this.load();
    }
  }
}
```

- [ ] **Step 2: Crea il template**

Crea `src/app/pages/progressi-list/progressi-list.component.html`:

```html
<p class="sectiontitle">Progressi</p>

<div *ngIf="loading" class="history-empty">Caricamento…</div>

<div *ngIf="!loading && errorMsg" class="history-empty">
  {{ errorMsg }}<br>
  <button class="savebtn" style="margin-top:12px" (click)="load()">Riprova</button>
</div>

<div *ngIf="!loading && !errorMsg && !readonly" class="savebar" style="margin-top:0;margin-bottom:16px">
  <button class="savebtn" (click)="newProgressi()">+ Nuovo progresso</button>
</div>

<div *ngIf="!loading && !errorMsg && selected.length === 2" class="savebar" style="margin-top:0;margin-bottom:16px">
  <button class="savebtn" (click)="compare()">Confronta</button>
</div>

<div *ngIf="!loading && !errorMsg && rows.length === 0" class="history-empty">
  Nessun progresso salvato.<ng-container *ngIf="!readonly"><br>Carica le prime 3 foto per iniziare.</ng-container>
</div>

<div *ngIf="!loading && !errorMsg && rows.length > 0" class="grouplist">
  <div class="daycard press-fx" *ngFor="let r of rows" (click)="toggleRow(r.record.date)">
    <div class="badge" style="font-size:12px">{{ r.record.date.slice(8,10) }}/{{ r.record.date.slice(5,7) }}</div>
    <div class="info">
      <div class="lbl">{{ r.displayDate }}</div>
    </div>
    <button class="delete-btn" *ngIf="!readonly" (click)="deleteEntry(r.record.date, $event)" title="Elimina">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
      </svg>
    </button>
    <div class="progressi-check" [class.selected]="isSelected(r.record.date)"></div>
  </div>
</div>
```

- [ ] **Step 3: Aggiungi lo stile `.progressi-check`**

In `src/styles.css`, subito dopo la riga `.set-check.done{background:var(--accent);border-color:var(--accent);color:#000;}`, aggiungi:

```css
.progressi-check{width:26px;height:26px;border-radius:50%;border:2px solid var(--label-3);background:transparent;flex-shrink:0;transition:background .18s ease,border-color .18s ease;}
.progressi-check.selected{background:var(--accent);border-color:var(--accent);}
```

- [ ] **Step 4: Aggiungi la voce "Progressi" in Misure**

In `src/app/pages/misure/misure.component.ts`, trova:

```ts
  constructor(private router: Router) {}

  goTo(id: MeasureCategory): void {
    this.router.navigate(['/misure', id]);
  }
}
```

Sostituisci con:

```ts
  constructor(private router: Router) {}

  goTo(id: MeasureCategory): void {
    this.router.navigate(['/misure', id]);
  }

  goToProgressi(): void {
    this.router.navigate(['/misure/progressi']);
  }
}
```

In `src/app/pages/misure/misure.component.html`, trova:

```html
<p class="sectiontitle">Misure</p>
<div class="grouplist">
  <div class="daycard press-fx" *ngFor="let c of categories" (click)="goTo(c.id)">
    <div class="badge">{{ c.badge }}</div>
    <div class="info">
      <div class="lbl">{{ c.label }}</div>
    </div>
    <span class="chev">›</span>
  </div>
</div>
```

Sostituisci con:

```html
<p class="sectiontitle">Misure</p>
<div class="grouplist">
  <div class="daycard press-fx" *ngFor="let c of categories" (click)="goTo(c.id)">
    <div class="badge">{{ c.badge }}</div>
    <div class="info">
      <div class="lbl">{{ c.label }}</div>
    </div>
    <span class="chev">›</span>
  </div>
  <div class="daycard press-fx" (click)="goToProgressi()">
    <div class="badge">IMG</div>
    <div class="info">
      <div class="lbl">Progressi</div>
    </div>
    <span class="chev">›</span>
  </div>
</div>
```

- [ ] **Step 5: Registra le rotte**

In `src/app/app.routes.ts`, trova:

```ts
  {
    path: 'misure/analytics',
    canActivate: [authGuard, clientGuard],
    loadComponent: () => import('./pages/misure-analytics/misure-analytics.component').then(m => m.MisureAnalyticsComponent)
  },
  {
    path: 'misure/:categoria',
```

Sostituisci con (le nuove rotte `misure/progressi*` devono stare **prima** di `misure/:categoria`, altrimenti Angular instraderebbe `/misure/progressi` a `MisuraCategoriaComponent`):

```ts
  {
    path: 'misure/analytics',
    canActivate: [authGuard, clientGuard],
    loadComponent: () => import('./pages/misure-analytics/misure-analytics.component').then(m => m.MisureAnalyticsComponent)
  },
  {
    path: 'misure/progressi',
    canActivate: [authGuard, clientGuard],
    loadComponent: () => import('./pages/progressi-list/progressi-list.component').then(m => m.ProgressiListComponent)
  },
  {
    path: 'misure/:categoria',
```

Poi trova (in fondo al file, dopo la rotta `coach/clienti/:clientId/builder/:protocolId`):

```ts
  {
    path: 'coach/clienti/:clientId/builder/:protocolId',
    canActivate: [authGuard, coachGuard],
    loadComponent: () => import('./pages/coach-protocol-builder/coach-protocol-builder.component').then(m => m.CoachProtocolBuilderComponent)
  },

  {
    path: 'scheda',
```

Sostituisci con:

```ts
  {
    path: 'coach/clienti/:clientId/builder/:protocolId',
    canActivate: [authGuard, coachGuard],
    loadComponent: () => import('./pages/coach-protocol-builder/coach-protocol-builder.component').then(m => m.CoachProtocolBuilderComponent)
  },
  {
    path: 'coach/clienti/:clientId/progressi',
    canActivate: [authGuard, coachGuard],
    loadComponent: () => import('./pages/progressi-list/progressi-list.component').then(m => m.ProgressiListComponent)
  },

  {
    path: 'scheda',
```

- [ ] **Step 6: Aggiungi i blocchi navbar (`updateNav`) per le 2 nuove rotte**

In `src/app/app.ts`, trova:

```ts
    if (u === '/misure/analytics') {
      this.navTitle = 'Andamento';
      this.navSubtitle = 'Analisi misure';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      return;
    }

    const categoriaMatch = u.match(/^\/misure\/(peso|centimetri|pliche)$/);
```

Sostituisci con:

```ts
    if (u === '/misure/analytics') {
      this.navTitle = 'Andamento';
      this.navSubtitle = 'Analisi misure';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      return;
    }

    if (u === '/misure/progressi') {
      this.navTitle = 'Progressi';
      this.navSubtitle = 'Foto salvate';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      return;
    }

    if (/^\/coach\/clienti\/[^/]+\/progressi$/.test(u)) {
      this.navTitle = 'Progressi';
      this.navSubtitle = '';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      return;
    }

    const categoriaMatch = u.match(/^\/misure\/(peso|centimetri|pliche)$/);
```

- [ ] **Step 7: Aggiungi i blocchi `onBack()` per le 2 nuove rotte**

In `src/app/app.ts`, trova:

```ts
    } else if (u === '/misure/storico' || u === '/misure/analytics') {
      this.router.navigate(['/misure']);
    } else if (/^\/misure\/(peso|centimetri|pliche)$/.test(u)) {
```

Sostituisci con:

```ts
    } else if (u === '/misure/storico' || u === '/misure/analytics' || u === '/misure/progressi') {
      this.router.navigate(['/misure']);
    } else if (/^\/misure\/(peso|centimetri|pliche)$/.test(u)) {
```

Poi trova:

```ts
    } else if (/^\/coach\/clienti\/[^/]+$/.test(u)) {
      this.router.navigate(['/coach/clienti']);
```

Sostituisci con:

```ts
    } else if (/^\/coach\/clienti\/[^/]+\/progressi$/.test(u)) {
      const clientId = u.split('/')[3];
      this.router.navigate(['/coach/clienti', clientId]);
    } else if (/^\/coach\/clienti\/[^/]+$/.test(u)) {
      this.router.navigate(['/coach/clienti']);
```

- [ ] **Step 8: Verifica che il progetto compili e i test passino**

Run: `npx ng build`
Expected: nessun errore.

Run: `npx ng test --watch=false`
Expected: tutti i test passano, nessuna regressione.

- [ ] **Step 9: Verifica visiva manuale**

Avvia l'app (`npx ng serve`):
- La pagina Misure mostra la nuova card "Progressi" (badge "IMG").
- `/misure/progressi` mostra "Nessun progresso salvato" (nessun record ancora) + bottone "+ Nuovo progresso" (il bottone navighera' verso una pagina che non esiste ancora fino a Task 5 — atteso).
- Il tasto indietro dalla pagina Progressi torna a Misure.

- [ ] **Step 10: Commit**

```bash
git add src/app/pages/progressi-list src/app/pages/misure/misure.component.ts src/app/pages/misure/misure.component.html src/app/app.routes.ts src/app/app.ts src/styles.css
git commit -m "Aggiunge ProgressiListComponent e voce Progressi in Misure"
```

---

### Task 5: `ProgressiUploadComponent`

**Files:**
- Create: `src/app/pages/progressi-upload/progressi-upload.component.ts`
- Create: `src/app/pages/progressi-upload/progressi-upload.component.html`
- Modify: `src/app/app.routes.ts`
- Modify: `src/app/app.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `ProgressiDataService.save(uid, date, files)` (Task 1), `resizeImageFile` (Task 2), `PROGRESSI_PHOTO_TYPES`/`PROGRESSI_PHOTO_LABELS`/`ProgressiPhotoType` (Task 1).

- [ ] **Step 1: Crea `ProgressiUploadComponent`**

Crea `src/app/pages/progressi-upload/progressi-upload.component.ts`:

```ts
import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ProgressiDataService } from '../../services/progressi-data.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../services/toast.service';
import { resizeImageFile } from '../../core/utils/image-resize.util';
import { todayLocalISO } from '../../core/utils/date.util';
import { ProgressiPhotoType, PROGRESSI_PHOTO_TYPES, PROGRESSI_PHOTO_LABELS } from '../../models/progressi.model';

interface PhotoSlot {
  type: ProgressiPhotoType;
  label: string;
  file: File | null;
  previewUrl: string | null;
}

@Component({
  selector: 'app-progressi-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './progressi-upload.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class ProgressiUploadComponent {
  slots: PhotoSlot[] = PROGRESSI_PHOTO_TYPES.map(type => ({
    type,
    label: PROGRESSI_PHOTO_LABELS[type],
    file: null,
    previewUrl: null
  }));
  saving = false;

  constructor(
    private router: Router,
    private data: ProgressiDataService,
    private auth: AuthService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  get canSave(): boolean {
    return this.slots.every(s => !!s.file);
  }

  onFileSelected(slot: PhotoSlot, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    slot.file = file;
    if (slot.previewUrl) URL.revokeObjectURL(slot.previewUrl);
    slot.previewUrl = URL.createObjectURL(file);
  }

  async save(): Promise<void> {
    if (!this.canSave || this.saving) return;
    this.saving = true;
    this.cdr.detectChanges();
    try {
      const date = todayLocalISO();
      const uid = this.auth.currentUser()!.uid;
      // L'ordine di slots segue PROGRESSI_PHOTO_TYPES ['fronte','retro','laterale']
      const [fronte, retro, laterale] = await Promise.all(
        this.slots.map(s => resizeImageFile(s.file!))
      );
      await this.data.save(uid, date, { fronte, retro, laterale });
      this.toast.success('Progresso salvato');
      this.router.navigate(['/misure/progressi']);
    } catch (e) {
      console.error('Errore salvataggio progressi:', e);
      this.toast.error('Errore nel salvataggio. Riprova.');
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }
}
```

- [ ] **Step 2: Crea il template**

Crea `src/app/pages/progressi-upload/progressi-upload.component.html`:

```html
<p class="sectiontitle">Nuovo progresso</p>

<div class="progressi-photogrid">
  <label class="progressi-phototile" *ngFor="let slot of slots" [class.filled]="!!slot.previewUrl">
    <input type="file" accept="image/*" (change)="onFileSelected(slot, $event)" hidden>
    <img *ngIf="slot.previewUrl" [src]="slot.previewUrl" alt="">
    <span *ngIf="!slot.previewUrl">{{ slot.label }}</span>
  </label>
</div>

<div class="savebar">
  <button class="savebtn" [disabled]="!canSave || saving" (click)="save()">
    {{ saving ? 'Salvataggio…' : 'Salva' }}
  </button>
</div>
```

- [ ] **Step 3: Aggiungi lo stile dei riquadri foto**

In `src/styles.css`, subito dopo le due righe `.progressi-check{...}`/`.progressi-check.selected{...}` aggiunte in Task 4, aggiungi:

```css
.progressi-photogrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px;}
.progressi-phototile{position:relative;aspect-ratio:3/4;border-radius:14px;border:1.5px dashed var(--content-glass-border);background:var(--content-glass-bg);display:flex;align-items:center;justify-content:center;font-family:'IBM Plex Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--label-3);cursor:pointer;overflow:hidden;}
.progressi-phototile.filled{border-style:solid;border-color:var(--accent);}
.progressi-phototile img{width:100%;height:100%;object-fit:cover;}
```

- [ ] **Step 4: Registra la rotta**

In `src/app/app.routes.ts`, trova:

```ts
  {
    path: 'misure/progressi',
    canActivate: [authGuard, clientGuard],
    loadComponent: () => import('./pages/progressi-list/progressi-list.component').then(m => m.ProgressiListComponent)
  },
  {
    path: 'misure/:categoria',
```

Sostituisci con:

```ts
  {
    path: 'misure/progressi',
    canActivate: [authGuard, clientGuard],
    loadComponent: () => import('./pages/progressi-list/progressi-list.component').then(m => m.ProgressiListComponent)
  },
  {
    path: 'misure/progressi/nuovo',
    canActivate: [authGuard, clientGuard],
    loadComponent: () => import('./pages/progressi-upload/progressi-upload.component').then(m => m.ProgressiUploadComponent)
  },
  {
    path: 'misure/:categoria',
```

- [ ] **Step 5: Aggiungi il blocco navbar**

In `src/app/app.ts`, trova:

```ts
    if (u === '/misure/progressi') {
      this.navTitle = 'Progressi';
      this.navSubtitle = 'Foto salvate';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      return;
    }

    if (/^\/coach\/clienti\/[^/]+\/progressi$/.test(u)) {
```

Sostituisci con:

```ts
    if (u === '/misure/progressi') {
      this.navTitle = 'Progressi';
      this.navSubtitle = 'Foto salvate';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      return;
    }

    if (u === '/misure/progressi/nuovo') {
      this.navTitle = 'Nuovo progresso';
      this.navSubtitle = '';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      return;
    }

    if (/^\/coach\/clienti\/[^/]+\/progressi$/.test(u)) {
```

- [ ] **Step 6: Aggiungi il blocco `onBack()`**

In `src/app/app.ts`, trova:

```ts
    } else if (u === '/misure/storico' || u === '/misure/analytics' || u === '/misure/progressi') {
      this.router.navigate(['/misure']);
    } else if (/^\/misure\/(peso|centimetri|pliche)$/.test(u)) {
```

Sostituisci con:

```ts
    } else if (u === '/misure/storico' || u === '/misure/analytics' || u === '/misure/progressi') {
      this.router.navigate(['/misure']);
    } else if (u === '/misure/progressi/nuovo') {
      this.router.navigate(['/misure/progressi']);
    } else if (/^\/misure\/(peso|centimetri|pliche)$/.test(u)) {
```

- [ ] **Step 7: Verifica che il progetto compili e i test passino**

Run: `npx ng build`
Expected: nessun errore.

Run: `npx ng test --watch=false`
Expected: tutti i test passano, nessuna regressione.

- [ ] **Step 8: Verifica visiva manuale**

Avvia l'app (`npx ng serve`), naviga in `/misure/progressi/nuovo`:
- I 3 riquadri (Fronte, Retro, Laterale) sono vuoti, "Salva" e' disabilitato.
- Selezionando una foto per riquadro appare l'anteprima e il bordo diventa pieno/accent.
- Con tutte e 3 selezionate, "Salva" si abilita; al tap salva e torna a `/misure/progressi`, dove ora compare il nuovo record con la data di oggi.
- Ricaricando la pagina (refresh), il record risulta ancora presente (salvato su Firestore/Storage).

- [ ] **Step 9: Commit**

```bash
git add src/app/pages/progressi-upload src/app/app.routes.ts src/app/app.ts src/styles.css
git commit -m "Aggiunge ProgressiUploadComponent"
```

---

### Task 6: `ProgressiConfrontoComponent`

**Files:**
- Create: `src/app/pages/progressi-confronto/progressi-confronto.component.ts`
- Create: `src/app/pages/progressi-confronto/progressi-confronto.component.html`
- Modify: `src/app/app.routes.ts`
- Modify: `src/app/app.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `ProgressiDataService.loadHistory(uid)` (Task 1), `PROGRESSI_PHOTO_TYPES`/`PROGRESSI_PHOTO_LABELS`/`ProgressiPhotoType`/`ProgressiRecord` (Task 1).

- [ ] **Step 1: Crea `ProgressiConfrontoComponent`**

Crea `src/app/pages/progressi-confronto/progressi-confronto.component.ts`:

```ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ProgressiDataService } from '../../services/progressi-data.service';
import { AuthService } from '../../core/services/auth.service';
import { ProgressiRecord, ProgressiPhotoType, PROGRESSI_PHOTO_TYPES, PROGRESSI_PHOTO_LABELS } from '../../models/progressi.model';

@Component({
  selector: 'app-progressi-confronto',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './progressi-confronto.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class ProgressiConfrontoComponent implements OnInit {
  readonly types = PROGRESSI_PHOTO_TYPES;
  readonly labels = PROGRESSI_PHOTO_LABELS;
  activeType: ProgressiPhotoType = 'fronte';

  record1: ProgressiRecord | null = null;
  record2: ProgressiRecord | null = null;
  displayDate1 = '';
  displayDate2 = '';

  loading = true;
  errorMsg = '';

  constructor(
    private route: ActivatedRoute,
    private data: ProgressiDataService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.errorMsg = '';

    const clientId = this.route.snapshot.paramMap.get('clientId');
    const uid = clientId ?? this.auth.currentUser()!.uid;
    const date1 = this.route.snapshot.paramMap.get('data1') ?? '';
    const date2 = this.route.snapshot.paramMap.get('data2') ?? '';

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 12000)
    );

    try {
      const history = await Promise.race([this.data.loadHistory(uid), timeout]);
      this.record1 = history.find(r => r.date === date1) ?? null;
      this.record2 = history.find(r => r.date === date2) ?? null;
      this.displayDate1 = this.formatDate(date1);
      this.displayDate2 = this.formatDate(date2);
      if (!this.record1 || !this.record2) {
        this.errorMsg = 'Uno o entrambi i progressi selezionati non sono più disponibili.';
      }
    } catch (e: any) {
      console.error('Errore caricamento confronto progressi:', e);
      this.errorMsg = e?.message === 'TIMEOUT'
        ? 'La connessione sta impiegando troppo tempo. Controlla la rete e riprova.'
        : 'Errore nel caricamento. Riprova.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  private formatDate(date: string): string {
    if (!date) return '';
    const d = new Date(date + 'T00:00:00');
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  selectType(type: ProgressiPhotoType): void {
    this.activeType = type;
  }

  photoUrl(record: ProgressiRecord | null, type: ProgressiPhotoType): string | null {
    if (!record) return null;
    if (type === 'fronte') return record.fronteUrl;
    if (type === 'retro') return record.retroUrl;
    return record.lateraleUrl;
  }
}
```

- [ ] **Step 2: Crea il template**

Crea `src/app/pages/progressi-confronto/progressi-confronto.component.html`:

```html
<p class="sectiontitle">Confronto</p>

<div *ngIf="loading" class="history-empty">Caricamento…</div>

<div *ngIf="!loading && errorMsg" class="history-empty">{{ errorMsg }}</div>

<ng-container *ngIf="!loading && !errorMsg">
  <div class="variant-tabs">
    <button *ngFor="let type of types" [class.active]="activeType === type" (click)="selectType(type)">
      {{ labels[type] }}
    </button>
  </div>

  <div class="exslider-dashes">
    <span *ngFor="let type of types" class="exslider-dash" [class.active]="activeType === type" (click)="selectType(type)"></span>
  </div>

  <div class="progressi-compare-pair">
    <div class="progressi-compare-col">
      <img class="progressi-compare-photo" [src]="photoUrl(record1, activeType)" alt="">
      <div class="progressi-compare-date">{{ displayDate1 }}</div>
    </div>
    <div class="progressi-compare-col">
      <img class="progressi-compare-photo" [src]="photoUrl(record2, activeType)" alt="">
      <div class="progressi-compare-date">{{ displayDate2 }}</div>
    </div>
  </div>
</ng-container>
```

- [ ] **Step 3: Aggiungi lo stile del confronto**

In `src/styles.css`, subito dopo le righe `.progressi-phototile img{...}` aggiunte in Task 5, aggiungi:

```css
.progressi-compare-pair{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.progressi-compare-col{display:flex;flex-direction:column;gap:8px;align-items:center;}
.progressi-compare-photo{width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:16px;background:var(--content-glass-bg);border:1px solid var(--content-glass-border);}
.progressi-compare-date{font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--label-2);}
```

- [ ] **Step 4: Registra le rotte**

In `src/app/app.routes.ts`, trova:

```ts
  {
    path: 'misure/progressi/nuovo',
    canActivate: [authGuard, clientGuard],
    loadComponent: () => import('./pages/progressi-upload/progressi-upload.component').then(m => m.ProgressiUploadComponent)
  },
  {
    path: 'misure/:categoria',
```

Sostituisci con:

```ts
  {
    path: 'misure/progressi/nuovo',
    canActivate: [authGuard, clientGuard],
    loadComponent: () => import('./pages/progressi-upload/progressi-upload.component').then(m => m.ProgressiUploadComponent)
  },
  {
    path: 'misure/progressi/confronto/:data1/:data2',
    canActivate: [authGuard, clientGuard],
    loadComponent: () => import('./pages/progressi-confronto/progressi-confronto.component').then(m => m.ProgressiConfrontoComponent)
  },
  {
    path: 'misure/:categoria',
```

Poi trova:

```ts
  {
    path: 'coach/clienti/:clientId/progressi',
    canActivate: [authGuard, coachGuard],
    loadComponent: () => import('./pages/progressi-list/progressi-list.component').then(m => m.ProgressiListComponent)
  },

  {
    path: 'scheda',
```

Sostituisci con:

```ts
  {
    path: 'coach/clienti/:clientId/progressi',
    canActivate: [authGuard, coachGuard],
    loadComponent: () => import('./pages/progressi-list/progressi-list.component').then(m => m.ProgressiListComponent)
  },
  {
    path: 'coach/clienti/:clientId/progressi/confronto/:data1/:data2',
    canActivate: [authGuard, coachGuard],
    loadComponent: () => import('./pages/progressi-confronto/progressi-confronto.component').then(m => m.ProgressiConfrontoComponent)
  },

  {
    path: 'scheda',
```

- [ ] **Step 5: Aggiungi i blocchi navbar**

In `src/app/app.ts`, trova:

```ts
    if (u === '/misure/progressi/nuovo') {
      this.navTitle = 'Nuovo progresso';
      this.navSubtitle = '';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      return;
    }

    if (/^\/coach\/clienti\/[^/]+\/progressi$/.test(u)) {
      this.navTitle = 'Progressi';
      this.navSubtitle = '';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      return;
    }

    const categoriaMatch = u.match(/^\/misure\/(peso|centimetri|pliche)$/);
```

Sostituisci con:

```ts
    if (u === '/misure/progressi/nuovo') {
      this.navTitle = 'Nuovo progresso';
      this.navSubtitle = '';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      return;
    }

    if (/^\/misure\/progressi\/confronto\/[^/]+\/[^/]+$/.test(u)) {
      this.navTitle = 'Confronto';
      this.navSubtitle = '';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      return;
    }

    if (/^\/coach\/clienti\/[^/]+\/progressi$/.test(u)) {
      this.navTitle = 'Progressi';
      this.navSubtitle = '';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      return;
    }

    if (/^\/coach\/clienti\/[^/]+\/progressi\/confronto\/[^/]+\/[^/]+$/.test(u)) {
      this.navTitle = 'Confronto';
      this.navSubtitle = '';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      return;
    }

    const categoriaMatch = u.match(/^\/misure\/(peso|centimetri|pliche)$/);
```

- [ ] **Step 6: Aggiungi i blocchi `onBack()`**

In `src/app/app.ts`, trova:

```ts
    } else if (u === '/misure/progressi/nuovo') {
      this.router.navigate(['/misure/progressi']);
    } else if (/^\/misure\/(peso|centimetri|pliche)$/.test(u)) {
```

Sostituisci con:

```ts
    } else if (u === '/misure/progressi/nuovo') {
      this.router.navigate(['/misure/progressi']);
    } else if (/^\/misure\/progressi\/confronto\/[^/]+\/[^/]+$/.test(u)) {
      this.router.navigate(['/misure/progressi']);
    } else if (/^\/misure\/(peso|centimetri|pliche)$/.test(u)) {
```

Poi trova:

```ts
    } else if (/^\/coach\/clienti\/[^/]+\/progressi$/.test(u)) {
      const clientId = u.split('/')[3];
      this.router.navigate(['/coach/clienti', clientId]);
    } else if (/^\/coach\/clienti\/[^/]+$/.test(u)) {
```

Sostituisci con:

```ts
    } else if (/^\/coach\/clienti\/[^/]+\/progressi\/confronto\/[^/]+\/[^/]+$/.test(u)) {
      const clientId = u.split('/')[3];
      this.router.navigate(['/coach/clienti', clientId, 'progressi']);
    } else if (/^\/coach\/clienti\/[^/]+\/progressi$/.test(u)) {
      const clientId = u.split('/')[3];
      this.router.navigate(['/coach/clienti', clientId]);
    } else if (/^\/coach\/clienti\/[^/]+$/.test(u)) {
```

- [ ] **Step 7: Verifica che il progetto compili e i test passino**

Run: `npx ng build`
Expected: nessun errore.

Run: `npx ng test --watch=false`
Expected: tutti i test passano, nessuna regressione.

- [ ] **Step 8: Verifica visiva manuale**

Con almeno 2 record progressi salvati (da Task 5):
- Dalla lista `/misure/progressi`, seleziona 2 righe (checkbox si riempiono), appare "Confronta".
- Il confronto mostra i tab Fronte/Retro/Laterale (stile `.variant-tabs`) e i trattini sotto; cambiando tab cambiano le 2 foto mostrate, sempre dello stesso tipo per entrambe le date.
- Le date sotto le foto corrispondono alle 2 righe selezionate.
- Il tasto indietro torna alla lista progressi.

- [ ] **Step 9: Commit**

```bash
git add src/app/pages/progressi-confronto src/app/app.routes.ts src/app/app.ts src/styles.css
git commit -m "Aggiunge ProgressiConfrontoComponent"
```

---

### Task 7: Ristruttura `coach-client-detail` + `CoachClientProtocolliComponent`

**Files:**
- Create: `src/app/pages/coach-client-protocolli/coach-client-protocolli.component.ts`
- Create: `src/app/pages/coach-client-protocolli/coach-client-protocolli.component.html`
- Modify: `src/app/pages/coach-client-detail/coach-client-detail.component.ts`
- Modify: `src/app/pages/coach-client-detail/coach-client-detail.component.html`
- Modify: `src/app/app.routes.ts`
- Modify: `src/app/app.ts`

**Interfaces:**
- Nessuna nuova interfaccia esportata consumata da altre task (questa è l'ultima task del piano). `CoachClientProtocolliComponent` riusa `ProtocolService` (già esistente, invariato) esattamente come faceva `CoachClientDetailComponent` prima di questa task.

- [ ] **Step 1: Crea `CoachClientProtocolliComponent`**

Crea `src/app/pages/coach-client-protocolli/coach-client-protocolli.component.ts` (contenuto identico alla logica protocolli oggi in `CoachClientDetailComponent`, solo senza il caricamento del profilo cliente):

```ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ProtocolService } from '../../services/protocol.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { Protocol } from '../../models/protocol.model';

@Component({
  selector: 'app-coach-client-protocolli',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './coach-client-protocolli.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class CoachClientProtocolliComponent implements OnInit {
  clientId = '';
  protocols: Protocol[] = [];
  loading = true;
  errorMsg = '';
  busyId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private protocolSvc: ProtocolService,
    private confirm: ConfirmDialogService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.clientId = this.route.snapshot.paramMap.get('clientId') ?? '';
    this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.errorMsg = '';

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 12000)
    );

    try {
      this.protocols = await Promise.race([this.protocolSvc.listForClient(this.clientId), timeout]);
    } catch (e: any) {
      console.error('Errore caricamento protocolli:', e);
      this.errorMsg = e?.message === 'TIMEOUT'
        ? 'La connessione sta impiegando troppo tempo. Controlla la rete e riprova.'
        : 'Errore nel caricamento. Riprova.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  newProtocol(): void {
    this.router.navigate(['/coach/clienti', this.clientId, 'nuovo']);
  }

  editProtocol(p: Protocol): void {
    this.router.navigate(['/coach/clienti', this.clientId, 'builder', p.id]);
  }

  async activate(p: Protocol, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    if (p.status === 'active') return;
    this.busyId = p.id;
    this.cdr.detectChanges();
    await this.protocolSvc.activate(this.clientId, p.id);
    await this.load();
    this.busyId = null;
    this.cdr.detectChanges();
  }

  async remove(p: Protocol, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    const ok = await this.confirm.confirm(`Eliminare il protocollo "${p.name}"?`);
    if (ok) {
      await this.protocolSvc.delete(this.clientId, p.id);
      await this.load();
    }
  }

  statusLabel(p: Protocol): string {
    if (p.status === 'active') return 'Attivo';
    if (p.status === 'draft') return 'Bozza';
    return 'Archiviato';
  }
}
```

- [ ] **Step 2: Crea il template**

Crea `src/app/pages/coach-client-protocolli/coach-client-protocolli.component.html` (contenuto identico al blocco "Protocolli" oggi in `coach-client-detail.component.html`, senza la card "Cliente" sopra):

```html
<div *ngIf="loading" class="history-empty">Caricamento…</div>

<div *ngIf="!loading && errorMsg" class="history-empty">
  {{ errorMsg }}
  <div style="margin-top:12px">
    <button class="confirmbtn cancel" (click)="load()">Riprova</button>
  </div>
</div>

<ng-container *ngIf="!loading && !errorMsg">
  <div class="savebar" style="margin-top:0;margin-bottom:16px">
    <button class="savebtn" (click)="newProtocol()">+ Nuovo protocollo</button>
  </div>

  <p class="sectiontitle">Protocolli</p>

  <div *ngIf="protocols.length === 0" class="history-empty">
    Nessun protocollo ancora.<br>Creane uno nuovo per iniziare a seguire questo cliente.
  </div>

  <div *ngIf="protocols.length > 0" class="grouplist">
    <div class="daycard press-fx protocol-row" *ngFor="let p of protocols" (click)="editProtocol(p)">
      <div class="info">
        <div class="lbl">{{ p.name }}</div>
        <div class="meta">
          <span class="protocol-status" [class]="'ps-' + p.status">{{ statusLabel(p) }}</span>
          &nbsp;·&nbsp;{{ p.source === 'pdf' ? 'da PDF' : 'manuale' }}
        </div>
      </div>
      <button class="confirmbtn cancel protocol-activatebtn" *ngIf="p.status !== 'active'"
        [disabled]="busyId === p.id" (click)="activate(p, $event)">
        {{ busyId === p.id ? '…' : 'Attiva' }}
      </button>
      <button class="delete-btn" (click)="remove(p, $event)" title="Elimina">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
        </svg>
      </button>
    </div>
  </div>
</ng-container>
```

- [ ] **Step 3: Ristruttura `coach-client-detail.component.ts`**

Sostituisci **l'intero contenuto** di `src/app/pages/coach-client-detail/coach-client-detail.component.ts` con:

```ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { doc, getDoc } from 'firebase/firestore';
import { FirebaseService } from '../../core/services/firebase.service';
import { ZoneFixService } from '../../core/utils/zone.util';
import { UserProfile } from '../../core/models/user.model';

@Component({
  selector: 'app-coach-client-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './coach-client-detail.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class CoachClientDetailComponent implements OnInit, OnDestroy {
  clientId = '';
  client: UserProfile | null = null;
  loading = true;
  errorMsg = '';
  private paramSub: Subscription | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FirebaseService,
    private zoneFix: ZoneFixService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.paramSub = this.route.paramMap.subscribe(params => {
      this.clientId = params.get('clientId') ?? '';
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.paramSub?.unsubscribe();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.errorMsg = '';

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 12000)
    );

    try {
      this.client = await Promise.race([
        this.zoneFix.run((async () => {
          const snap = await getDoc(doc(this.fb.db, 'users', this.clientId));
          return snap.exists() ? (snap.data() as UserProfile) : null;
        })()),
        timeout
      ]);
    } catch (e: any) {
      console.error('Errore caricamento dettaglio cliente:', e);
      this.errorMsg = e?.message === 'TIMEOUT'
        ? 'La connessione sta impiegando troppo tempo. Controlla la rete e riprova.'
        : 'Errore nel caricamento. Riprova.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  goToProtocolli(): void {
    this.router.navigate(['/coach/clienti', this.clientId, 'protocolli']);
  }

  goToProgressi(): void {
    this.router.navigate(['/coach/clienti', this.clientId, 'progressi']);
  }
}
```

- [ ] **Step 4: Ristruttura `coach-client-detail.component.html`**

Sostituisci **l'intero contenuto** di `src/app/pages/coach-client-detail/coach-client-detail.component.html` con:

```html
<div *ngIf="loading" class="history-empty">Caricamento…</div>

<div *ngIf="!loading && errorMsg" class="history-empty">
  {{ errorMsg }}
  <div style="margin-top:12px">
    <button class="confirmbtn cancel" (click)="load()">Riprova</button>
  </div>
</div>

<ng-container *ngIf="!loading && !errorMsg">
  <p class="sectiontitle">Cliente</p>
  <div class="infocard" style="margin-bottom:16px">
    <div class="lbl" style="font-size:16px;font-weight:700">{{ client?.displayName }}</div>
    <div class="meta" style="margin-top:2px">{{ client?.email }}</div>
  </div>

  <div class="grouplist">
    <div class="daycard press-fx" (click)="goToProtocolli()">
      <div class="info">
        <div class="lbl">Protocolli</div>
      </div>
      <span class="chev">›</span>
    </div>
    <div class="daycard press-fx" (click)="goToProgressi()">
      <div class="info">
        <div class="lbl">Progressi</div>
      </div>
      <span class="chev">›</span>
    </div>
  </div>
</ng-container>
```

- [ ] **Step 5: Registra la rotta `protocolli`**

In `src/app/app.routes.ts`, trova:

```ts
  {
    path: 'coach/clienti/:clientId/nuovo',
    canActivate: [authGuard, coachGuard],
    loadComponent: () => import('./pages/coach-protocol-new/coach-protocol-new.component').then(m => m.CoachProtocolNewComponent)
  },
```

Sostituisci con:

```ts
  {
    path: 'coach/clienti/:clientId/protocolli',
    canActivate: [authGuard, coachGuard],
    loadComponent: () => import('./pages/coach-client-protocolli/coach-client-protocolli.component').then(m => m.CoachClientProtocolliComponent)
  },
  {
    path: 'coach/clienti/:clientId/nuovo',
    canActivate: [authGuard, coachGuard],
    loadComponent: () => import('./pages/coach-protocol-new/coach-protocol-new.component').then(m => m.CoachProtocolNewComponent)
  },
```

- [ ] **Step 6: Aggiorna il blocco navbar esistente e aggiungi quello nuovo**

In `src/app/app.ts`, trova:

```ts
    if (/^\/coach\/clienti\/[^/]+$/.test(u)) {
      this.navTitle = 'Cliente';
      this.navSubtitle = 'Protocolli';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      return;
    }

    if (/^\/coach\/clienti\/[^/]+\/nuovo$/.test(u)) {
```

Sostituisci con:

```ts
    if (/^\/coach\/clienti\/[^/]+$/.test(u)) {
      this.navTitle = 'Cliente';
      this.navSubtitle = '';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      return;
    }

    if (/^\/coach\/clienti\/[^/]+\/protocolli$/.test(u)) {
      this.navTitle = 'Protocolli';
      this.navSubtitle = '';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      return;
    }

    if (/^\/coach\/clienti\/[^/]+\/nuovo$/.test(u)) {
```

- [ ] **Step 7: Aggiungi il blocco `onBack()`**

In `src/app/app.ts`, trova:

```ts
    } else if (/^\/coach\/clienti\/[^/]+\/nuovo$/.test(u)) {
      const clientId = u.split('/')[3];
      this.router.navigate(['/coach/clienti', clientId]);
    } else if (/^\/coach\/clienti\/[^/]+\/progressi\/confronto\/[^/]+\/[^/]+$/.test(u)) {
```

Sostituisci con:

```ts
    } else if (/^\/coach\/clienti\/[^/]+\/nuovo$/.test(u)) {
      const clientId = u.split('/')[3];
      this.router.navigate(['/coach/clienti', clientId]);
    } else if (/^\/coach\/clienti\/[^/]+\/protocolli$/.test(u)) {
      const clientId = u.split('/')[3];
      this.router.navigate(['/coach/clienti', clientId]);
    } else if (/^\/coach\/clienti\/[^/]+\/progressi\/confronto\/[^/]+\/[^/]+$/.test(u)) {
```

Nota: anche `/^\/coach\/clienti\/[^/]+\/builder\/[^/]+$/` (gia' esistente, torna a `/coach/clienti/:clientId`) resta invariato — un protocollo aperto dal builder torna comunque alla pagina cliente (non specificamente alla lista protocolli), scelta gia' cosi' prima di questa task e non modificata.

- [ ] **Step 8: Verifica che il progetto compili e i test passino**

Run: `npx ng build`
Expected: nessun errore.

Run: `npx ng test --watch=false`
Expected: tutti i test passano, nessuna regressione.

- [ ] **Step 9: Verifica visiva manuale**

Da un account coach:
- `/coach/clienti/:clientId` mostra le info cliente + 2 righe "Protocolli"/"Progressi" (senza più la lista protocolli inline).
- Tap su "Protocolli" apre `/coach/clienti/:clientId/protocolli` con la lista protocolli invariata (creazione, attivazione, eliminazione funzionanti come prima).
- Tap su "Progressi" apre `/coach/clienti/:clientId/progressi`: lista progressi del cliente in sola lettura (nessun "+ Nuovo progresso", nessuna icona elimina), selezione a coppie + Confronta funzionanti.
- Il tasto indietro da entrambe le nuove pagine torna a `/coach/clienti/:clientId`.

- [ ] **Step 10: Commit**

```bash
git add src/app/pages/coach-client-protocolli src/app/pages/coach-client-detail src/app/app.routes.ts src/app/app.ts
git commit -m "Ristruttura coach-client-detail in righe Protocolli/Progressi"
```

---

## Self-Review Notes

- **Spec coverage:** card Progressi in Misure (Task 4) ✅, upload 3 foto obbligatorie + resize (Task 2 + 5) ✅, un record al giorno (Task 1, date come ID doc) ✅, lista con selezione a coppie + auto-deseleziona la meno recente (Task 2 + 4) ✅, confronto per tipo con tab (Task 6, riusa `.variant-tabs`/`.exslider-dashes` esistenti) ✅, coach sola lettura (Task 4/6, flag `readonly` da presenza `clientId`) ✅, ristruttura coach-client-detail in 2 righe (Task 7) ✅, regole di sicurezza Firestore+Storage + CI (Task 3) ✅, `.set-check`/`.meal-check` non toccate (nuova classe dedicata `.progressi-check`) ✅.
- **Placeholder scan:** nessun TBD/TODO; ogni step mostra il codice esatto prima/dopo o il contenuto completo del nuovo file.
- **Type consistency:** `ProgressiRecord`/`ProgressiPhotoType`/`PROGRESSI_PHOTO_TYPES`/`PROGRESSI_PHOTO_LABELS` (Task 1) usati identicamente in Task 4/5/6. `ProgressiDataService.loadHistory(uid)`/`.save(uid,date,files)`/`.delete(uid,date)` (Task 1) usati con la stessa firma in Task 4/5/6. `toggleSelection`/`resizeImageFile`/`computeScaledDimensions` (Task 2) usati identicamente in Task 4/5.
- **Rotte e navbar:** ogni rotta aggiunta (Task 4, 5, 6, 7) ha il corrispondente blocco `updateNav`/`onBack` nello stesso task che la introduce — verificato incrociando gli step di ogni task con l'elenco rotte della sezione "Rotte" dello spec.
- **Scope:** 7 task, ciascuno con una superficie di test/verifica indipendente (dati/infrastruttura, funzioni pure con TDD, regole di sicurezza, poi 4 task UI in ordine di dipendenza — lista, upload, confronto, ristruttura coach). Dimensione maggiore delle feature precedenti in questo branch, giustificata dalla portata della feature (prima integrazione Storage + refactor di una pagina esistente esplicitamente richiesto).
