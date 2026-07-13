# Design: "Storico e carichi" e "Consigli generali" da dati reali

Data: 2026-07-13

## Contesto

In `scheda-info.component.html` (tab "Info" lato cliente), due blocchi sono
testo statico hardcoded nel template, identico per ogni cliente/protocollo:

- **"Storico e carichi"**: paragrafo descrittivo generico su cosa il cliente
  puo' vedere altrove (ultimo carico, sparkline, suggerimento wave).
- **"Consigli generali"**: lista fissa di 5 consigli (recupero, progressione,
  wave, idratazione, sonno), identica anche per protocolli senza esercizi
  wave.

Richiesta: sostituire entrambi con contenuto derivato dai dati reali gia'
presenti (storico allenamenti in Firestore, dati del protocollo attivo), non
testo statico.

## "Storico e carichi" -> riepilogo calcolato dallo storico reale

Nessun nuovo campo sul modello `Protocol`. `SchedaInfoComponent` carica lo
storico dell'utente via `WorkoutSessionsService.listAll()` (gia' esistente,
stesso servizio usato da `HistoryListComponent`), seguendo lo stesso pattern
gia' in uso in `history-list.component.ts` (race con timeout 12s, gestione
errore, `cdr.detectChanges()` dopo il caricamento perche' l'app e' zoneless).

Calcolo:
- `totalWorkouts = sessions.length`
- `lastWorkoutDate` = data dell'ultima sessione (`sessions[0].session.date`,
  gia' ordinate piu' recenti prima), formattata con
  `toLocaleDateString('it-IT', { day, month, year })` come nel resto
  dell'app.

Template:
```html
<div class="infocard">
  <h3>Storico e carichi</h3>
  <p *ngIf="loadingHistory">Caricamento storico...</p>
  <p *ngIf="!loadingHistory && totalWorkouts === 0">
    Non hai ancora registrato allenamenti. Il tuo storico apparira' qui dopo
    il primo allenamento completato.
  </p>
  <ng-container *ngIf="!loadingHistory && totalWorkouts > 0">
    <p>Allenamenti completati: <b>{{ totalWorkouts }}</b></p>
    <p>Ultimo allenamento: <b>{{ lastWorkoutDate }}</b></p>
    <p>Nella scheda dettaglio puoi vedere, per ogni esercizio: l'ultimo
       carico usato, il grafico della progressione e un suggerimento di
       carico per gli esercizi wave.</p>
  </ng-container>
</div>
```

Nessun rischio di regressione sui protocolli/clienti esistenti: il valore
non e' un default statico ma un calcolo dal vero storico gia' salvato, quindi
un cliente con storico lo vede subito popolato correttamente; un cliente
senza storico (nuovo) vede lo stato vuoto, comportamento corretto e non
diverso da oggi in sostanza (oggi non mostrava comunque dati reali).

## "Consigli generali" -> condizionale sui dati reali del protocollo

Nessun nuovo campo sul modello `Protocol`. I consigli universali restano
fissi in codice (non derivano da PDF: verificato che i PDF campione non
contengono testo di questo tipo — vedi indagine sotto); il consiglio
specifico wave diventa condizionale.

`hasWaveExercises` = `workoutData.days.some(d => d.ex.some(e => e.scheme === 'wave'))`
— derivato da `WorkoutDataService.days`, gia' popolato con il protocollo
attivo (stessa fonte dati gia' usata per `WEEK_PLAN`/`currentWeek` in questo
componente), nessun nuovo caricamento asincrono necessario.

Template:
```html
<div class="consigli">
  <h3>Consigli generali</h3>
  <ul>
    <li>Recupero tra le serie: segui i tempi indicati (timer automatico)</li>
    <li>Progressione: aumenta il carico quando completi tutte le serie con buona tecnica</li>
    <li *ngIf="hasWaveExercises">Per gli esercizi wave: aumenta di 2.5–5 kg quando completi tutte le serie</li>
    <li>Bevi almeno 2L di acqua al giorno, di più nei giorni di allenamento</li>
    <li>Assicurati di dormire almeno 7–8 ore per ottimizzare il recupero</li>
  </ul>
</div>
```

**Nota su dietNotesSource**: il PDF dieta contiene una sezione "Consigli di
base" (idratazione, sgarro) gia' estratta oggi come `dietNotesSource` e
mostrata nella card "Note dal tuo coach" (via `infoNote`). Non viene
duplicata qui: comparirebbe due volte identica nella stessa pagina.
Confermato con l'utente di ometterla da "Consigli generali".

**Indagine PDF svolta**: verificato il testo campione del PDF scheda
(`SCHEDA_TEXT` in `pdf-import.service.spec.ts`) — non contiene alcuna
sezione di consigli generici (recupero/sonno/progressione); quel testo
esiste solo lato codice. Per questo i consigli universali restano statici
in `scheda-info.component.ts`, non estratti da PDF.

## Modifiche ai file

- `src/app/pages/scheda-info/scheda-info.component.ts`: implementa
  `OnInit`, inietta `WorkoutSessionsService` e `ChangeDetectorRef`; aggiunge
  `loadingHistory`, `totalWorkouts`, `lastWorkoutDate`,
  `hasWaveExercises` (getter). `ngOnInit` chiama `loadHistory()` (async,
  pattern identico a `history-list.component.ts`).
- `src/app/pages/scheda-info/scheda-info.component.html`: sostituisce i 2
  blocchi statici come sopra.

## Cosa NON cambia

- Nessuna modifica al modello `Protocol` (nessun nuovo campo, nessun
  problema di dati legacy sui protocolli esistenti: entrambe le sezioni
  sono calcolate al volo dai dati gia' esistenti, non lette da un campo che
  potrebbe essere `undefined`).
- Nessuna modifica a `pdf-import.service.ts`/parser esistenti.
- Card "Note dal tuo coach" (infoNote) invariata.

## Test

Nessun nuovo test automatico dedicato: la logica (`totalWorkouts`,
`lastWorkoutDate`, `hasWaveExercises`) sono derivazioni dirette da dati gia'
caricati, stesso livello di complessita' del codice equivalente in
`history-list.component.ts`, che oggi non ha test dedicati — stessa
convenzione gia' seguita nel resto del progetto per logica di
presentazione/UI.
