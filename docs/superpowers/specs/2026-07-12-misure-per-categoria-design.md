# Design: card per categoria misure + edit storico con cambio data

Data: 2026-07-12

## Contesto

Oggi la pagina "Misure" (`/misure`) mostra tre sezioni sempre espanse in un unico
form ("Corpo": peso+altezza, "Pliche", "Circonferenze") con un solo pulsante di
salvataggio complessivo. Lo storico (`/misure/storico`, `/misure/storico/:key`)
e' di sola visualizzazione: l'unica azione disponibile su una voce e'
l'eliminazione completa.

Richiesta: dividere la pagina Misure in 3 card (Peso, Centimetri, Pliche); al
tap su una card si inserisce la misura corrispondente e si salva nello
storico; nello storico deve essere possibile modificare una misurazione,
inclusa la sua data.

## Modello dati

`src/app/models/measurement.model.ts`:

- Rimuovere il campo `altezza` da `MeasurementEntry` e da ogni costante dei
  campi. Non e' referenziato altrove nel codebase (nessun calcolo BMI o
  simile), quindi va eliminato del tutto invece di lasciarlo come campo morto.
  I documenti storici gia' salvati su Firestore possono ancora contenere un
  valore `altezza`: non viene letto ne' scritto da nessuna parte dell'app dopo
  questa modifica (Firestore e' schemaless, nessun problema di compatibilita').
- Rinominare le costanti dei campi in base al loro significato reale (oggi si
  chiamano `MEASURE_CARD_1/2/3`, ambiguo e slegato dal contenuto):
  - `PESO_FIELDS`: `[peso]` (1 campo, altezza rimossa)
  - `PLICHE_FIELDS`: i 5 campi plica* esistenti, invariati
  - `CENTIMETRI_FIELDS`: gli 11 campi cm* esistenti, invariati
- `ALL_MEASURE_FIELDS` resta la concatenazione delle tre costanti, usato
  invariato da `getLastValues()` e dal resto del servizio.
- Aggiungere un tipo `MeasureCategory = 'peso' | 'centimetri' | 'pliche'` e una
  mappa `CATEGORY_FIELDS: Record<MeasureCategory, MeasureField[]>` (e
  un'etichetta titolo per categoria, es. `CATEGORY_LABELS`) per risolvere i
  campi/il titolo a partire dal segmento di route.

## Pagina Misure (`/misure`)

Sostituisce il form attuale con 3 card semplici, una per categoria: solo
etichetta + icona, nessuna anteprima di valori. Il tap su una card naviga a
`/misure/:categoria` (senza query param: modalita' inserimento rapido di
oggi).

## Schermata categoria (`/misure/:categoria`, nuovo componente riutilizzabile)

Un solo componente (`MisuraCategoriaComponent`) gestisce tutte e 3 le
categorie, risolvendo campi/titolo dal parametro di route `categoria`.

**Modalita' inserimento rapido** (nessun query param `date`):

- Campi vuoti all'apertura; placeholder = ultimo valore noto per quel campo
  (via `getLastValues()`, filtrato ai campi della categoria) — stesso
  comportamento di oggi.
- Bozza automatica mentre si digita (debounce ~500ms, stesso meccanismo di
  oggi) ma isolata per categoria: chiave di bozza distinta per
  peso/centimetri/pliche, cosi' aprire una categoria non sovrascrive la bozza
  di un'altra categoria non ancora salvata.
- Salvataggio: carica (o crea) la voce storico della data odierna, applica
  solo i campi di questa categoria (le altre categorie eventualmente gia'
  salvate oggi restano intatte — unica voce per data, come oggi), pulisce la
  bozza di questa categoria. Al termine torna a `/misure`.

**Modalita' modifica** (query param `?date=YYYY-MM-DD`, arrivo dallo
storico):

- Campi precompilati con i valori reali gia' salvati in quella data per
  questa categoria (non placeholder: valori veri).
- Il campo data e' modificabile (input data, non permette date future).
- Nessuna bozza automatica in questa modalita': si sta gia' modificando un
  dato persistito, non serve un salvataggio "in corso d'opera".
- Salvataggio:
  - Data invariata: aggiorna solo i campi di questa categoria nella voce di
    quella data (`updateCategoryAtDate`).
  - Data cambiata: prima verifica se la voce nella data di destinazione ha
    gia' valori non nulli per almeno uno dei campi di questa categoria.
    - Se si': blocca il salvataggio, mostra errore ("Esiste gia' una
      misurazione di questo tipo in questa data"), non scrive nulla.
    - Se no: scrive i campi di questa categoria nella voce della nuova data
      (merge con eventuali altri campi/categorie gia' presenti in quella
      data, creando la voce se non esiste), quindi azzera quei campi nella
      voce della data originale. Se la voce originale risulta priva di
      valori in **tutte** le categorie dopo la rimozione, la voce viene
      eliminata interamente (nessuna voce storico vuota residua).
  - Al termine torna al dettaglio storico della data risultante
    (`/misure/storico/:date`).

## Storico (`misure-storico-detail.component`)

Ogni sezione del dettaglio (Peso / Pliche / Centimetri) riceve un'azione
"Modifica" che naviga a `/misure/{categoria}?date={date}`. L'eliminazione
dell'intera voce (bottone gia' esistente in cima alla pagina) resta invariata
e continua a rimuovere l'intero documento indipendentemente dalla categoria.

## Routing (`app.routes.ts`)

Aggiungere `misure/:categoria` **dopo** le route statiche esistenti
`misure/storico` e `misure/analytics` nell'array (Angular Router valuta le
route nell'ordine dichiarato: se `:categoria` precedesse quelle statiche,
intercetterebbe per errore `/misure/storico` come se `categoria='storico'`).

## Service layer (`measurement-data.service.ts`)

Nuovi metodi (oltre a quelli esistenti, invariati):

- `getCategoryValues(category, date)`: legge la voce di una data e restituisce
  solo i campi di quella categoria (per precompilare il form in modifica).
- `saveCategoryToday(category, values)`: merge dei campi di una categoria
  nella voce odierna (crea se assente).
- `moveCategoryEntry(category, oldDate, newDate, values)`: implementa la
  logica di collisione/spostamento descritta sopra; restituisce un esito
  (`ok` | `collision`) invece di lanciare, cosi' il componente puo' mostrare
  l'errore senza try/catch dedicato.
- `saveDraft`/`loadDraft`/`clearDraft` esistenti diventano per-categoria: la
  chiave di bozza in `AppStateService` include la categoria (es.
  `measureDraft.peso`, `measureDraft.centimetri`, `measureDraft.pliche`
  invece dell'attuale `measureDraft` unico).

## Cosa NON cambia

- Il modello di una singola voce storico per data (con tutti i campi di tutte
  le categorie) resta invariato — nessuna migrazione a piu' documenti per
  data.
- L'eliminazione di un'intera voce storico dallo storico resta un'azione
  unica, non per categoria.
- Analytics (`misure-analytics.component`) non richiede modifiche: continua a
  leggere `loadHistory()`/i campi esistenti, semplicemente senza piu'
  `altezza`.

## Test

Il progetto segue la convenzione di verifica manuale (tsc/build) senza test
automatici per la maggior parte delle feature — unica eccezione finora e' il
parser PDF, che ha un banco di test maturo. La logica di
collisione/spostamento tra date in `moveCategoryEntry` e' pero' l'unico punto
realmente rischioso di questa feature (un bug potrebbe far perdere dati
storici in silenzio, es. cancellare valori senza portarli nella nuova data).
Si aggiungono quindi alcuni test mirati solo su questa funzione in un nuovo
`measurement-data.service.spec.ts` (merge senza collisione, blocco con
collisione, pulizia/eliminazione della voce di origine svuotata). Il resto
della feature (UI, routing, form) segue la convenzione esistente:
verifica tramite tsc/build/test manuale.
