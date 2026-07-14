# Design: modifica di una seduta nello storico allenamenti

Data: 2026-07-14

## Contesto

`HistoryDetailComponent` (`src/app/pages/history-detail/`, route
`/scheda/storico/:key`) mostra oggi una seduta salvata in sola lettura:
data, esercizi, e per ogni serie ripetizioni/carico/spuntato — piu' un
bottone "Elimina questa seduta". Non esiste modo di correggere un valore
gia' registrato ne' di cambiare la data di una seduta gia' salvata.

Richiesta: poter modificare tutti i valori gia' registrati (ripetizioni,
carico, spuntato per ogni serie) e la data della seduta. Non e' richiesto
poter aggiungere/rimuovere serie o esercizi — la struttura della seduta
(quali esercizi, quante serie) resta quella registrata al momento
dell'allenamento.

## Interazione: modifica inline nella stessa pagina

Nessuna nuova route. Un bottone "Modifica" nella `savebar` (accanto a
"Elimina questa seduta") attiva `editMode`:

- La vista passa da sola-lettura a un form: un campo data in cima
  (`<input type="date">` con `[max]` a oggi, stesso pattern gia' usato in
  `misura-categoria.component.html` per il campo data in modifica), e per
  ogni serie di ogni esercizio gli stessi input gia' usati nella scheda
  allenamento live (`scheda-detail.component.html`): `rip-input`/
  `load-input` (`type="text" inputmode="decimal"`) per ripetizioni/carico,
  e il tasto `.set-check` per spuntato/non spuntato.
- Due bottoni sostituiscono "Modifica"/"Elimina" mentre `editMode` e'
  attivo: "Salva" e "Annulla".
- "Annulla" scarta le modifiche (nessuna chiamata di rete) e torna alla
  vista sola-lettura con i valori originali.
- I dati editabili sono una copia della sessione caricata (clone semplice,
  dato che `WorkoutSession` e' solo dati piatti senza funzioni/date reali)
  cosi' "Annulla" puo' scartare senza ricaricare dal server.

## Salvataggio e cambio data

Ogni sessione e' salvata su Firestore con id = `${dayId}_${isoDate}`
(`WorkoutSessionsService.sessionId`, gia' esistente) — cambiare la data
significa quindi creare un nuovo documento con un id diverso ed eliminare
quello vecchio, non un semplice update in place.

Nuovo metodo `WorkoutSessionsService.moveSession(session, oldId, newDate)`,
che rispecchia esattamente `MeasurementDataService.moveCategoryEntry`
(stesso pattern gia' in uso e gia' corretto in questo progetto per essere
atomico via `writeBatch`, dopo un bug reale trovato e risolto in una
feature precedente sullo stesso meccanismo):

- **Stessa data** (l'utente non ha cambiato il campo data): aggiorna
  semplicemente il documento esistente con i nuovi valori (stesso id,
  nessun rischio di collisione).
- **Data diversa**: calcola il nuovo id (`${dayId}_${newDate}`) e verifica
  se un documento con quell'id esiste gia'.
  - Se esiste gia' → `'collision'`: il salvataggio viene rifiutato, nessun
    dato viene scritto ne' cancellato, un messaggio informa l'utente che
    esiste gia' una seduta per quel giorno di allenamento in quella data.
  - Se non esiste → scrive il nuovo documento e cancella quello vecchio in
    un'unica `writeBatch` (atomico: o succedono entrambe le operazioni o
    nessuna delle due, mai uno stato intermedio con due copie o nessuna).
- Ritorna `'ok' | 'collision' | 'error'` (stessa forma di
  `moveCategoryEntry`), per gestire il feedback in modo identico.

Dopo un salvataggio riuscito con data cambiata, la pagina naviga al nuovo
URL (`/scheda/storico/:nuovoKey`, stesso pattern di
`misura-categoria.component.ts` dopo `moveCategoryEntry`), cosi' l'URL
resta coerente con il documento realmente esistente (deep-link, refresh,
tasto indietro). Se la data non e' cambiata, si resta sulla stessa pagina
e si esce semplicemente da `editMode`.

## Cosa NON cambia

- Nessuna modifica al modello `WorkoutSession` (nessun nuovo campo).
- Nessuna possibilita' di aggiungere/rimuovere serie o esercizi dalla
  seduta storica — solo i valori di ripetizioni/carico/spuntato delle
  serie gia' esistenti, e la data.
- Il bottone "Elimina questa seduta" resta invariato (visibile fuori da
  `editMode`).
- `WorkoutSessionsService.save()`/`get()`/`delete()` restano invariati;
  `moveSession()` e' un nuovo metodo aggiuntivo, non li sostituisce.

## Test

`moveSession()` e' logica di dominio con un ramo di collisione/atomicita'
non banale — merita test TDD dedicati, stessa convenzione gia' seguita per
`moveCategoryEntry` (`measurement-data.service.spec.ts`): nuovo file
`workout-sessions.service.spec.ts` con lo stesso pattern di mock di
Firestore (`vi.mock('firebase/firestore', ...)`), casi: stessa data
aggiorna in place; data diversa senza collisione scrive+cancella
atomicamente; data diversa con collisione blocca senza scrivere ne'
cancellare nulla.

Nessun nuovo test automatico per `HistoryDetailComponent` (lavoro di
UI/form, stessa convenzione gia' seguita per il resto dei componenti
pagina del progetto — nessun file sotto `src/app/pages/**` ha uno
`.spec.ts` dedicato a logica di presentazione).
