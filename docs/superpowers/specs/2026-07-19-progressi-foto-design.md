# Card "Progressi" (foto cliente) in Misure

## Problema

Nella sezione "Misure" esistono oggi solo misure numeriche (Peso, Centimetri,
Pliche). Non c'è modo di caricare e confrontare foto dei progressi fisici del
cliente nel tempo. Serve una nuova capacità: caricare 3 foto (Fronte, Retro,
Laterale) in un unico record datato, vederne lo storico, e confrontare due
record selezionati foto-per-foto (stesso tipo con stesso tipo).

## Requisiti approvati

- Nuova voce **"Progressi"** nella pagina Misure, accanto a Peso/Centimetri/
  Pliche (stesso stile `.daycard`/`.grouplist`), non è una `MeasureCategory`
  (niente campi numerici) quindi ha rotta e componenti dedicati.
- **Upload**: pagina con 3 riquadri (Fronte, Retro, Laterale) — tap apre il
  picker nativo (foto o galleria, nessuna forzatura della fotocamera). Tutte
  e 3 le foto sono obbligatorie: "Salva" resta disabilitato finché non sono
  presenti tutte e 3. Un solo record al giorno (la data è l'ID del
  documento, come già avviene per `measurements`): un nuovo salvataggio
  nello stesso giorno sovrascrive il precedente.
- **Lista progressi**: stile identico a `misure-storico` (righe con data),
  ma con una checkbox di selezione su ogni riga invece del tap-to-apri (non
  esiste una pagina di dettaglio per il singolo record). Selezionando
  esattamente 2 righe compare un bottone fisso "Confronta"; se si tenta di
  selezionarne una terza, la meno recente delle 2 già selezionate si
  deseleziona automaticamente. Tap ovunque sulla riga (non solo sulla
  checkbox) attiva/disattiva la selezione — su questa lista il tap sulla
  riga non ha altro scopo, a differenza di altre liste dell'app dove apre un
  dettaglio.
- **Confronto**: tab Fronte / Retro / Laterale in alto (stile pulsanti
  pieni) con trattini sotto le foto per indicare la posizione (stesso
  linguaggio visivo di `.exslider-dashes`/`.exslider-dash` già in uso). Le
  due foto del tipo selezionato affiancate a piena larghezza, con la data
  sotto ciascuna. Layout confermato via mockup (opzione "C — tab per tipo").
- **Visibilità coach**: il coach può vedere la lista progressi del cliente e
  fare il confronto (stessa pagina di confronto, già di sola lettura per
  natura), ma **non** può caricare né eliminare nulla.
- **Ristruttura `coach-client-detail`**: oggi mostra le info cliente e, in
  linea, la lista protocolli + "+ Nuovo protocollo". Diventa una pagina con
  le info cliente e due righe navigabili stile `.daycard` — **"Protocolli"**
  (porta alla lista protocolli, spostata in una pagina dedicata nuova, con
  tutto quello che c'è oggi: creazione, attivazione, eliminazione) e
  **"Progressi"** (porta alla stessa lista progressi di sopra, in modalità
  sola lettura).
- **Ottimizzazione immagini**: ogni foto viene ridimensionata lato client
  (canvas, lato lungo massimo ~1080px, JPEG qualità ~0.85) prima
  dell'upload, per non caricare file da diversi MB direttamente dalla
  fotocamera.

## Architettura dati

Nuova collezione Firestore `users/{uid}/progressi/{date}` (stesso pattern di
`measurements`: `date` in formato `YYYY-MM-DD` è anche l'ID del documento).

```ts
export interface ProgressiRecord {
  date: string;
  fronteUrl: string;
  retroUrl: string;
  lateraleUrl: string;
}
```

Le foto vengono caricate su **Firebase Storage** (il bucket
`imperial-gym-app.firebasestorage.app` è già configurato nel progetto Firebase
ma non è mai stato usato finora nel codice — nessuna nuova dipendenza, solo
il modulo `firebase/storage` non ancora importato) sotto
`users/{uid}/progressi/{date}/{fronte|retro|laterale}.jpg`. Il documento
Firestore salva solo gli URL di download risultanti.

`FirebaseService` (`src/app/core/services/firebase.service.ts`) viene esteso
con un'istanza `Storage` (via `getStorage(this.app)`), accanto a `db`/`auth`
già esistenti.

## Regole di sicurezza

**Firestore** (`firestore.rules`): nuovo blocco `match /progressi/{id}` sotto
`users/{uid}`, che mescola i pattern già esistenti — lettura al proprietario
E al coach (come già avviene per `protocols`, tramite lettura del campo
`coachId` del profilo cliente), scrittura solo al proprietario (a differenza
di `protocols`, dove è il coach a scrivere):

```
match /progressi/{id} {
  allow read: if isSignedIn() && (
    request.auth.uid == uid ||
    get(/databases/$(database)/documents/users/$(uid)).data.coachId == request.auth.uid
  );
  allow write: if isSignedIn() && request.auth.uid == uid;
}
```

Questa è la prima volta che un dato "personale" del cliente (finora solo
`protocols` viaggiava dal coach al cliente; misure e sessioni erano private)
viene condiviso in lettura col coach — cambiamento esplicitamente richiesto e
approvato in fase di brainstorming.

**Storage**: non esiste ancora un file `storage.rules` nè una voce
`"storage"` in `firebase.json` — vengono aggiunti entrambi, con una regola
che rispecchia la stessa logica lettura-proprietario-o-coach/scrittura-solo-
proprietario usando `firestore.get()` per leggere il `coachId` del cliente
dal documento Firestore corrispondente.

**CI**: `.github/workflows/firebase-deploy.yml` già esegue
`firebase deploy --only firestore:rules,firestore:indexes` ad ogni push su
`main`. Viene esteso ad includere anche `storage:rules`, così le nuove
regole si distribuiscono automaticamente come le altre, senza passi manuali.

## Nuovi file / componenti

- `src/app/models/progressi.model.ts` — `ProgressiRecord`.
- `src/app/services/progressi-data.service.ts` — CRUD su Firestore +
  Storage. Ogni metodo accetta uno `uid` esplicito come parametro (stesso
  pattern già usato da `ProtocolService.listForClient(clientId)`), così lo
  stesso servizio serve sia il cliente (che passa il proprio uid) sia il
  coach (che passa l'uid del cliente che sta visualizzando).
- `src/app/core/utils/image-resize.util.ts` — ridimensionamento canvas prima
  dell'upload.
- `src/app/pages/progressi-list/*` — lista (condivisa cliente/coach, la
  modalità sola-lettura si attiva se la rotta ha un parametro `clientId`;
  altrimenti usa l'utente corrente).
- `src/app/pages/progressi-upload/*` — upload (solo cliente).
- `src/app/pages/progressi-confronto/*` — confronto (condivisa
  cliente/coach, stesso criterio di rilevamento del ruolo).
- `src/app/pages/coach-client-protocolli/*` — **nuovo**, riceve il contenuto
  oggi inline in `coach-client-detail` (lista protocolli, creazione,
  attivazione, eliminazione), invariato nella logica.

## File modificati

- `src/app/pages/misure/misure.component.html/.ts` — nuova voce "Progressi"
  nella `.grouplist`.
- `src/app/pages/coach-client-detail/coach-client-detail.component.ts/.html`
  — rimossa la lista protocolli inline, sostituita da due righe
  `.daycard` di navigazione ("Protocolli", "Progressi"); resta la card
  "Cliente" con le info.
- `src/app/core/services/firebase.service.ts` — aggiunta istanza `Storage`.
- `src/app/app.routes.ts` — nuove rotte (vedi sotto).
- `firestore.rules`, `firebase.json`, `.github/workflows/firebase-deploy.yml`
  — regole e deploy Storage.

## Rotte

```
/misure/progressi                                        -> ProgressiListComponent (cliente)
/misure/progressi/nuovo                                  -> ProgressiUploadComponent
/misure/progressi/confronto/:data1/:data2                -> ProgressiConfrontoComponent (cliente)
/coach/clienti/:clientId/protocolli                       -> CoachClientProtocolliComponent (nuovo)
/coach/clienti/:clientId/progressi                        -> ProgressiListComponent (sola lettura)
/coach/clienti/:clientId/progressi/confronto/:data1/:data2 -> ProgressiConfrontoComponent (sola lettura)
```

## Cosa NON cambia

- `.set-check`/`.meal-check` non vengono toccate: la checkbox di selezione
  della lista progressi usa una classe dedicata `.progressi-check`, solo
  ispirata allo stesso linguaggio visivo.
- `misure-storico`, `misura-categoria`, `ProtocolService` restano invariati
  nella logica — `coach-client-detail` cambia solo la propria
  presentazione/navigazione, non il modo in cui i protocolli vengono
  caricati o gestiti.
- Nessuna condivisione col coach per `measurements` (peso/pliche/centimetri)
  — resta privata, solo `progressi` viene condivisa.

## Test plan

- Unit test per la logica di selezione (max 2, la meno recente si
  deseleziona automaticamente alla terza) — estratta in una funzione pura
  testabile in isolamento.
- Unit test per il calcolo delle dimensioni scalate nel resize immagine
  (funzione pura `computeScaledDimensions(width, height, maxDim)`,
  separata dalla parte canvas/Blob che richiede un vero browser e non è
  testabile in modo significativo in Vitest/jsdom — verificata manualmente).
- Verifica manuale: upload di 3 foto → record in lista con data corretta →
  selezione di 2 record → confronto con tab corrette per tipo → eliminazione
  rimuove sia il documento Firestore sia i file Storage → vista coach
  sola lettura (nessun bottone di upload/eliminazione visibile) → regole di
  sicurezza (un cliente non può leggere i progressi di un altro cliente; un
  coach non può scrivere/eliminare i progressi di un cliente).
- `npx ng build` e `npx ng test --watch=false` puliti.
