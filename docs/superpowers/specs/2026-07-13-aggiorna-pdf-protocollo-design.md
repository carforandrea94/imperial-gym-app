# Design: bottone "Aggiorna da PDF" nel builder del protocollo

Data: 2026-07-13

## Contesto

L'unico modo per portare dati da PDF in un protocollo e' il flusso di creazione
(`/coach/clienti/:clientId/importa-pdf`, `CoachProtocolImportComponent`), che:
- richiede **sia** scheda **sia** dieta insieme (`canProcess` esige entrambi i
  file);
- crea sempre un protocollo nuovo (`protocolSvc.create()`), sovrascrivendo
  interamente `workout`/`diet`/`infoNote`.

Non esiste modo di aggiornare un protocollo gia' esistente ricaricando un PDF
corretto/aggiornato, ne' di caricare i 3 PDF (scheda/dieta/integrazione)
singolarmente in momenti diversi.

Richiesta: nel builder del protocollo (`CoachProtocolBuilderComponent`), un
bottone icona-only nell'header per ricaricare i PDF anche singolarmente e
aggiornare il protocollo esistente.

## Bottone nell'header

Nuovo slot generico nella navbar esistente (`NavbarComponent`), stesso schema
di `showHistory`/`historyClick`:

- `@Input() showSettings = false;`
- `@Output() settingsClick = new EventEmitter<void>();`
- Icona ingranaggio (SVG lineare, stesso stile delle altre icone header),
  bottone `<button class="navicon" *ngIf="showSettings" (click)="settingsClick.emit()" title="Aggiorna da PDF">`.

`app.ts`: `updateNav()` imposta `showSettings = true` sulla route
`/coach/clienti/:clientId/builder/:protocolId` (nessun'altra route lo abilita);
`onSettingsClick()` naviga a `/coach/clienti/:clientId/aggiorna-pdf/:protocolId`.
Il bottone e' sempre visibile su questa route, indipendentemente da
`protocol.source` (anche un protocollo creato manualmente puo' "agganciare"
un PDF in un secondo momento).

## Nuova route: aggiornamento da PDF

`coach/clienti/:clientId/aggiorna-pdf/:protocolId` — riusa lo stesso
componente `CoachProtocolImportComponent`, esteso con una modalita'
"aggiornamento" quando la route ha il param `protocolId` (assente = modalita'
creazione attuale, invariata).

**Differenze in modalita' aggiornamento:**
- Titolo pagina: "Aggiorna da PDF" invece di "Importa da PDF".
- `canProcess` richiede **almeno uno** dei 3 file (non piu' scheda+dieta
  obbligatori insieme).
- Prima di salvare, conferma esplicita (`ConfirmDialogService.confirm(...)`)
  che elenca cosa verra' sovrascritto in base a quali file sono stati
  selezionati (es. "Verranno aggiornati: giorni di allenamento, onda di
  carico." se solo scheda; "Verranno aggiornati: dieta, note." se solo
  dieta).
- Se `protocolSvc.get(clientId, protocolId)` non trova il protocollo (id
  invalido/cancellato), redirect a `/coach/clienti/:clientId` invece di
  mostrare la pagina — stesso trattamento gia' usato altrove per un id non
  valido (es. `dieta-detail.component.ts`).
- Ogni file aggiorna solo la porzione corrispondente del protocollo
  **esistente** (letto via `protocolSvc.get(clientId, protocolId)` a inizio
  pagina, non creato da zero):
  - **Scheda**: `workout.days` + `workout.weekPlan` (via
    `detectProtocolWeekPlan`, gia' esistente). `workout.programStart` NON
    viene toccato (resta quello gia' impostato sul protocollo).
  - **Dieta**: `diet`. Inoltre ricalcola `dietNotesSource` (vedi sotto) e di
    conseguenza `infoNote`.
  - **Integrazione**: ricalcola solo `supplementNotesSource` e di
    conseguenza `infoNote`.
- Al termine, torna al builder (`/coach/clienti/:clientId/builder/:protocolId`),
  non alla Dashboard cliente come fa oggi la creazione.

## Note "Info": tracciamento a 2 sorgenti

`infoNote` oggi e' un'unica stringa libera, modificabile dal coach nel
builder (textarea), generata una tantum in creazione come concatenazione di
"note estratte dalla dieta" + "testo integrazione" — non c'e' modo di sapere
quale porzione viene da quale fonte per poterla rigenerare parzialmente senza
perdere l'altra.

Aggiungo 2 campi interni al modello `Protocol` (non editabili direttamente
dal coach, nessuna nuova UI dedicata):

```ts
dietNotesSource?: string;       // ultima estrazione da extractDietNotes(dietaText)
supplementNotesSource?: string; // ultimo testo integrazione (trim)
```

Regola di ricalcolo di `infoNote` (sia in creazione sia in aggiornamento):
`infoNote = [dietNotesSource, supplementNotesSource].filter(Boolean).join('\n\n')`,
ricalcolato ogni volta che **uno dei due** viene rigenerato:
- Ricarico solo dieta → `dietNotesSource` aggiornato da `extractDietNotes(dietaText)`,
  `supplementNotesSource` invariato, `infoNote` ricalcolato da entrambi.
- Ricarico solo integrazione → `supplementNotesSource` aggiornato dal nuovo
  testo, `dietNotesSource` invariato, `infoNote` ricalcolato da entrambi.
- Ricarico entrambi (o creazione da zero) → entrambe le sorgenti aggiornate.
- Ricarico solo scheda → nessuna delle due sorgenti ne' `infoNote` vengono
  toccate.

Il textarea "Info" del builder resta invariato nell'interfaccia (un solo
campo libero): eventuali modifiche manuali del coach a `infoNote` vengono
sovrascritte solo quando la porzione corrispondente (dieta o integrazione)
viene effettivamente ricaricata — stesso comportamento gia' esistente oggi
quando si ri-importa tutto da zero (il coach perde le modifiche manuali gia'
in creazione; qui si applica la stessa logica, ma per porzione).

## Cosa NON cambia

- Il flusso di creazione (`importa-pdf` senza `protocolId`) resta identico a
  oggi: entrambi i file obbligatori, crea sempre un protocollo nuovo,
  nessuna conferma richiesta (comportamento gia' esistente, non nel
  perimetro di questa modifica).
- Il textarea "Info" nel builder resta un solo campo libero, nessuna nuova
  UI per i 2 campi sorgente (sono interni, mai mostrati/editati
  direttamente).
- Nessuna modifica a `detectProtocolWeekPlan`/`extractDietNotes`/altri
  parser gia' esistenti: vengono solo richiamati in un punto aggiuntivo
  (l'aggiornamento parziale) con lo stesso comportamento di oggi.

## Test

Nessun nuovo test automatico per il componente/route/navbar (lavoro di
UI/routing, stessa convenzione gia' seguita nel resto del progetto). La
logica di ricalcolo di `infoNote` dalle 2 sorgenti e' pura e semplice
(concatenazione con filtro), non giustifica una sospensione della
convenzione come accaduto per `moveCategoryEntry`.
