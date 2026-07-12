# Design: vista slider/lista per la schermata Dieta

Data: 2026-07-12

## Contesto

La schermata scheda (`/scheda/day/:idx`, `scheda-detail.component.ts`) ha gia'
due modalita' di visualizzazione per gli esercizi di un giorno di allenamento,
scelte dall'utente tramite un toggle nella navbar:

- **Lista**: accordion, un esercizio per riga, si espande al tap.
- **Slider**: scorrimento orizzontale con snap, una card per esercizio,
  contenuto sempre espanso, pallini di navigazione in basso.

La preferenza (`WorkoutViewMode = 'list' | 'slider'`) vive in
`WorkoutStateService` come signal, persistita in `localStorage`
(`schedaViewMode`) e sincronizzata su Firestore (`AppStateService.load()`
espone `workoutViewMode`, aggiornato via `patchField`). Il toggle e' un
componente navbar generico (`showViewToggle`/`viewMode`/`viewModeChange`),
abilitato solo sulla pagina di dettaglio giorno (non sull'elenco allenamenti).

Richiesta: replicare esattamente lo stesso comportamento per la schermata
dieta (`/dieta/:mode`, `dieta-detail.component.ts`), dove oggi i pasti sono
mostrati solo in un'unica vista ad accordion (`DietaDetailComponent`,
`toggleMeal`/`vm.open`).

## Architettura

**Nuovo `DietStateService`** (mirror di `WorkoutStateService`, stessa
separazione dati/stato-UI gia' esistente tra `DietDataService` e
`WorkoutStateService`/`WorkoutDataService`):

- `viewMode = signal<'list' | 'slider'>(...)`, inizializzato da
  `localStorage.getItem('dietaViewMode')` (fallback `'list'`).
- `setViewMode(mode)`: aggiorna il signal, `localStorage`, e
  `appState.patchField('dietViewMode', mode)`.
- `effect()` nel costruttore che allinea il signal al valore Firestore
  (`state.dietViewMode`) non appena `AppStateService.load()` risolve, stesso
  pattern di `WorkoutStateService`.
- Preferenza indipendente da quella della scheda: chiavi (`dietaViewMode`
  vs `schedaViewMode`) e campo Firestore (`dietViewMode` vs
  `workoutViewMode`) separati.

**`AppStateService`**: aggiungere `dietViewMode?: 'list' | 'slider'` al
modello di stato (stesso trattamento di `workoutViewMode`, campo opzionale
gestito via `patchField`).

**Navbar/routing (`app.ts`)**: `showViewToggle` va abilitato anche per la
route `/dieta/:mode` (attualmente abilitato solo per
`/scheda/day/(\d+)`), leggendo `dietState.viewMode()` invece di
`workoutState.viewMode()` quando la route corrente e' quella dieta.
`onViewModeChange()` deve instradare la chiamata al servizio giusto in base
alla pagina corrente (un flag tipo `viewToggleTarget: 'scheda' | 'dieta'`
impostato insieme a `showViewToggle` in `updateNav()`, usato da
`onViewModeChange()` per decidere quale service.setViewMode chiamare). Il
toggle NON compare su `/dieta` (elenco piani), solo sul dettaglio piano —
stessa scelta gia' fatta per la scheda.

## Componente `DietaDetailComponent`

- Vista lista: invariata, stesso accordion/`toggleMeal`/`vm.open` di oggi.
- Vista slider (nuova): un pasto per card, scorrimento orizzontale con
  snap, pallini di navigazione. Contenuto del pasto (combinazioni,
  alimenti, alternative) sempre espanso nella card — nessun tap per
  aprire, dato che l'utente e' gia' isolato su un pasto alla volta (stessa
  scelta della scheda: la vista slider degli esercizi non ha accordion
  interno).
- Il markup del contenuto pasto (tab combinazioni, lista alimenti,
  alternative) e' condiviso tra le due viste tramite `ng-template`
  (`mealDetail`) con `ngTemplateOutlet`, esattamente come `exDetail`/
  `exMeta` in `scheda-detail.component.html` — nessuna duplicazione di
  markup tra lista e slider.
- Il blocco statico "Consigli di base" resta sempre visibile sotto
  lista/slider, invariato, fuori da entrambi i blocchi `*ngIf`.

## Sincronizzazione scroll↔indice (codice condiviso)

`scheda-detail.component.ts` ha gia' un piccolo algoritmo (rAF +
rilevamento della card visibile piu' vicina via `offsetLeft`/`scrollLeft`,
piu' `scrollIntoView` per la navigazione via pallino) che verrebbe
duplicato identico in `dieta-detail.component.ts`. Va estratto in un
helper condiviso in `src/app/core/utils/` (funzione pura o piccola classe,
es. `findClosestSlideIndex(children, scrollLeft)` +
`scrollToSlide(container, idx)`), usato da entrambi i componenti al posto
di due implementazioni identiche. `scheda-detail.component.ts` viene
aggiornato per usare lo stesso helper (nessuna duplicazione residua).

Il componente chiamante resta responsabile di: mantenere il proprio
`sliderIndex`, chiamare `this.cdr.detectChanges()` quando l'indice cambia
(app zoneless — stesso trattamento gia' presente in
`scheda-detail.component.ts`'s `onSliderScroll()`), e richiamare l'helper
al momento giusto (scroll event, click su un pallino).

## Cosa NON cambia

- Il contenuto/la logica di un pasto (combinazioni, alimenti, alternative,
  toggle "Alternative") resta identico — la vista slider lo mostra per
  intero invece di dietro un accordion, ma non introduce nuovi dati o
  comportamenti.
- L'elenco piani (`/dieta`) non ha il toggle, invariato.
- `WorkoutStateService`/`schedaViewMode`/`workoutViewMode` non vengono
  toccati (a parte l'estrazione dell'helper di scroll, che non ne cambia
  il comportamento osservabile).

## Test

Nessun nuovo test automatico: lavoro di UI/interazione, stessa convenzione
gia' seguita per l'analoga feature della scheda e per il resto del
progetto (verifica tramite `tsc`/`ng build`/`ng test` e verifica manuale,
nessuna logica a rischio-dati come nel caso di `moveCategoryEntry`).
