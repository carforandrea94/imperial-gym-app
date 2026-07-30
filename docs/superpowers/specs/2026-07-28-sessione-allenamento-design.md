# Design: sessione di allenamento con cronometro

Data: 2026-07-28

## Contesto

Oggi l'allenamento si compila nella pagina `/scheda/day/:n`
(`SchedaDetailComponent`) e si salva premendo un'icona nella navbar. Il
click sull'icona viene inoltrato alla pagina tramite
`WorkoutStateService.registerSaveHandler()`/`requestSave()`, perche' il
bottone vive fuori dalla pagina. Non esiste alcuna nozione di "durata"
dell'allenamento.

Richiesta: poter **avviare una sessione di allenamento** con un cronometro
incrementale che misura la durata totale, tramite una card iniziale
("Avvia sessione") e una card finale ("Termina e salva"), rendendo cosi'
superfluo il tasto salva nell'header. Le due card devono comparire solo
nella sezione allenamento, mai nella visualizzazione dello storico.

Decisioni prese con l'utente in fase di brainstorming:

- **La sessione sopravvive a chiusura/ricarica dell'app**: al rientro il
  cronometro mostra il tempo realmente trascorso dall'avvio.
- **Non si puo' salvare senza aver avviato la sessione**: il salvataggio
  e' possibile solo terminando una sessione in corso.
- **Una sola sessione alla volta**, non una per giorno.
- **La durata compare nello storico**, sia nell'elenco sia nel dettaglio.
- **Serve poter annullare** una sessione avviata per sbaglio, senza
  salvarla.

## Perche' lo storico non e' interessato

La visualizzazione di una seduta salvata usa un componente separato
(`src/app/pages/history-detail/`), non `SchedaDetailComponent`. Le card
vivono nel template di `SchedaDetailComponent`, quindi non compaiono nello
storico senza bisogno di alcuna condizione aggiuntiva.

## Modello dati

### Sessione attiva (stato effimero)

`AppState` (`src/app/services/app-state.service.ts`) guadagna:

```ts
activeWorkoutSession: { dayId: string; startedAt: string } | null;
```

Default `null` in `emptyState()`. `startedAt` e' un timestamp ISO
(`new Date().toISOString()`).

Viene salvato **l'istante di avvio**, non i secondi trascorsi: il tempo si
ricalcola sempre come `Date.now() - startedAt`. E' lo stesso principio gia'
usato dal timer di recupero (`restEndAt` in `WorkoutStateService`) ed e'
cio' che rende il cronometro corretto anche quando iOS sospende
l'esecuzione JS (schermo bloccato, app in background): al rientro il valore
mostrato e' quello reale, non quello "congelato" al momento della
sospensione. Passando da `AppStateService` (Firestore + cache
`localStorage`) la sessione sopravvive a ricarica, chiusura e cambio
dispositivo.

### Seduta salvata

`WorkoutSession` (`src/app/models/workout.model.ts:36-44`) guadagna un
campo **opzionale**:

```ts
durationSec?: number;
```

Opzionale per retrocompatibilita': le sedute gia' salvate non lo hanno e
devono restare valide e leggibili. Dove la durata manca, semplicemente non
viene mostrato nulla (nessun "0:00", nessun placeholder).

## Nuovo servizio: `WorkoutSessionStateService`

Nuovo file `src/app/services/workout-session-state.service.ts`. Resta
separato da `WorkoutStateService` (che gestisce il timer di **recupero**)
perche' ha un ciclo di vita diverso: il recupero dura secondi ed e'
puramente in memoria, la sessione dura un'ora ed e' persistita.

Interfaccia pubblica:

```ts
export interface ActiveWorkoutSession {
  dayId: string;
  startedAt: string;
}

class WorkoutSessionStateService {
  /** Sessione attiva, o null. Inizializzata dalla cache locale, poi allineata all'account. */
  activeSession: Signal<ActiveWorkoutSession | null>;

  /** Secondi trascorsi dall'avvio, ricalcolati da startedAt (0 se nessuna sessione attiva). */
  elapsedSec: Signal<number>;

  /** true se la sessione attiva appartiene a questo giorno. */
  isActiveForDay(dayId: string): boolean;

  start(dayId: string): void;
  cancel(): void;

  /** Chiude la sessione attiva. La durata va letta da elapsedSec() PRIMA di chiamarlo. */
  finish(): void;

  /** "45:12" / "1:05:30" — durata leggibile, usata dalle card e dallo storico. */
  formatDuration(seconds: number): string;
}
```

Comportamento:

- `elapsedSec` e' aggiornato da un `setInterval` di 1 secondo attivo solo
  quando c'e' una sessione, e **ricalcolato anche su `visibilitychange`**
  quando l'app torna visibile (stesso accorgimento gia' presente per il
  timer di recupero: il tick puo' essere rimasto fermo per minuti).
- `start()` e `cancel()`/`finish()` scrivono su `AppStateService`
  (`patchField('activeWorkoutSession', ...)` /
  `deleteFieldPath('activeWorkoutSession')`), aggiornando anche la cache
  `localStorage`, seguendo lo stesso pattern gia' usato da
  `ThemeService`/`WorkoutStateService.viewMode`.
- All'avvio del servizio, un `effect()` gated su
  `auth.authReady() && auth.currentUser()` allinea lo stato al valore
  salvato sull'account, come gia' fanno gli altri servizi di stato.

## UI: le due card in `SchedaDetailComponent`

Entrambe le card vivono nel template
`src/app/pages/scheda-detail/scheda-detail.component.html`, **fuori** dai
blocchi `.exlist` (riga 62) e `.exslider-wrap` (riga 95), cosi' sono
visibili in entrambe le viste lista e slider.

### Card iniziale (in cima, prima della lista esercizi)

Tre stati mutuamente esclusivi:

1. **Nessuna sessione attiva** — bottone primario "Avvia sessione".
2. **Sessione attiva su questo giorno** — il cronometro in evidenza
   (`formatDuration(elapsedSec())`, es. `45:12`), con l'etichetta
   "Sessione in corso".
3. **Sessione attiva su un altro giorno** — bottone "Avvia sessione"
   disabilitato, con il testo che indica su quale giorno e' in corso e un
   link per raggiungerlo (`/scheda/day/:n` ricavato dal `dayId`).

### Card finale (in fondo, dopo la lista esercizi)

- Bottone primario **"Termina e salva"**, disabilitato finche' non c'e'
  una sessione attiva su questo giorno. Mostra gli stati di salvataggio
  gia' esistenti (`saveStatus`): "Salvataggio…", "Salvato ✓", errore.
- Azione secondaria **"Annulla sessione"**, visibile solo a sessione
  attiva su questo giorno, con dialogo di conferma
  (`ConfirmDialogService.confirm(...)`, `dangerous: true`) prima di
  scartare la sessione senza salvare.

## Rimozione del tasto salva dall'header

Vengono rimossi:

- Il bottone `.saveworkout-icon` in
  `src/app/components/navbar/navbar.component.html:32-36` e i relativi
  `@Input() showSaveWorkout` / `@Input() saveStatus` e l'output
  `saveWorkoutClick` in `navbar.component.ts`.
- `showSaveWorkout` e `onSaveWorkoutClick()` in `src/app/app.ts`, e i
  binding corrispondenti in `src/app/app.html:12-13,27`.
- `registerSaveHandler()` / `requestSave()` e il campo `saveHandler` in
  `WorkoutStateService`: servivano solo a inoltrare il click dalla navbar
  alla pagina, e con il bottone dentro la pagina non hanno piu' ragione di
  esistere. Va rimossa anche la chiamata
  `this.state.registerSaveHandler(...)` in
  `scheda-detail.component.ts:89` e il `registerSaveHandler(null)` in
  `ngOnDestroy` (riga 137).

**Resta** `WorkoutStateService.saveStatus`, che ora alimenta gli stati
della card finale invece dell'icona in navbar.

Il riferimento a `showSaveWorkout` nella condizione `.navactions.hide`
(`navbar.component.html:12`) va rimosso dall'espressione, mantenendo gli
altri flag.

## Salvataggio

`saveWorkout()` (`scheda-detail.component.ts:380`) resta il punto unico di
salvataggio, con due modifiche:

1. Chiamato dalla card finale invece che dall'handler della navbar.
2. La durata viene letta **prima** del salvataggio
   (`const durationSec = this.sessionState.elapsedSec()`) e inclusa
   nell'oggetto `WorkoutSession`.
3. La sessione viene chiusa (`this.sessionState.finish()`) **solo dopo**
   che il salvataggio e' andato a buon fine, nello stesso punto in cui
   oggi viene cancellata la bozza.

Quest'ordine e' deliberato: se il salvataggio fallisce (rete assente,
timeout), la sessione resta attiva con il suo cronometro e l'utente puo'
riprovare senza aver perso ne' la durata ne' la sessione. Chiudere la
sessione prima del salvataggio la distruggerebbe anche in caso di errore.

Il resto (timeout di 12s, cancellazione della bozza
`workoutDrafts.<dayId>`, toast di esito, `saveStatus`) resta invariato.

## Durata nello storico

- **Elenco** (`src/app/pages/history-list/history-list.component.html:20`):
  la riga `meta` diventa
  `{{ s.displayDate }} · {{ s.completedSets }} serie` con l'aggiunta di
  `· {{ durata }}` solo quando `session.durationSec` e' presente.
- **Dettaglio** (`src/app/pages/history-detail/`): la durata compare
  accanto alle informazioni di seduta gia' mostrate, sempre solo se
  presente.

La formattazione usa `WorkoutSessionStateService.formatDuration()`, cosi'
il formato e' identico ovunque.

## Cosa NON cambia

- Il timer di **recupero** (`WorkoutStateService.restTimer`) resta
  completamente indipendente: puo' partire e finire piu' volte dentro una
  sessione, senza alcuna interazione con il cronometro di sessione.
- Il salvataggio automatico della bozza (`workoutDrafts`) resta com'e' e
  continua a funzionare anche a sessione non avviata: compilare
  l'allenamento senza avviare la sessione non fa perdere i dati inseriti,
  semplicemente non permette di salvarlo nello storico.
- Le sedute gia' presenti nello storico restano valide e visualizzabili.

## Test

- `workout-session-state.service.spec.ts` (nuovo, Vitest — niente
  `jasmine.createSpyObj`, mock manuali come negli altri spec del
  progetto): `start()` scrive stato e cache; `elapsedSec` calcolato da
  `startedAt` con orologio controllato (`vi.useFakeTimers()` /
  `vi.setSystemTime()`), incluso il caso "app sospesa": avanzando
  l'orologio senza far scattare i tick il valore resta corretto;
  `isActiveForDay()` distingue il giorno attivo dagli altri; `cancel()` e
  `finish()` azzerano lo stato (e dopo `finish()` `elapsedSec()` torna a 0);
  `formatDuration()` per durate sotto e sopra l'ora.
- Nessun test nuovo sui template di `scheda-detail`/storico: il progetto
  non ha oggi test su questi componenti e questa e' principalmente una
  modifica di markup e di collocazione dei controlli.
- Verifica manuale: avvio sessione, blocco schermo/ricarica pagina e
  rientro (il cronometro deve mostrare il tempo reale), tentativo di avvio
  su un secondo giorno, annullamento con conferma, salvataggio con durata
  e sua comparsa nello storico.
