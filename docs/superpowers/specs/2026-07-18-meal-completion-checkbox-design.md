# Checkbox "pasto completato" nella vista slider dieta

## Problema

Nella pagina "Piano alimentare" (`dieta-detail`, vista slider — una card pasto
alla volta con lo stepper a trattini), non esiste modo di segnare un pasto
come completato. Lo slider inoltre parte sempre dal pasto della fascia oraria
corrente (`findCurrentMealIndex`), indipendentemente da cosa è già stato
consumato.

## Requisiti approvati

- Una checkbox rotonda in alto a destra di ogni card pasto, **solo nella
  vista slider** (la vista lista/accordion resta invariata).
- Il completamento si resetta ogni giorno di calendario (data reale), a
  prescindere da quale piano dieta (Giorno ON, Giorno OFF, Rifeed, ecc.) è
  aperto in quel momento.
- Quando si apre la pagina (o si passa da vista lista a vista slider), lo
  slider parte dal **primo pasto non ancora completato oggi** — sostituisce
  completamente la logica basata sull'orario corrente (`findCurrentMealIndex`,
  che viene rimossa insieme al suo file `meal-time.util.ts`/spec, non più
  usata da nessun'altra parte).
- Se tutti i pasti del giorno sono già completati, lo slider parte
  dall'**ultimo** pasto della lista.

## Persistenza

Estende `AppState` (`src/app/services/app-state.service.ts`) con un nuovo
campo:

```ts
mealsCompletion: { date: string; done: Record<string, boolean> } | null;
```

- `date`: stringa `YYYY-MM-DD` (`todayLocalISO()`), la data in cui i flag in
  `done` sono stati registrati.
- `done`: mappa `meal.id → boolean`. `meal.id` è già globalmente univoco
  (generato con `newId('meal')` in fase di creazione del piano), quindi non
  serve qualificarlo con l'id del piano.

**Reset "pigro" lato client**: quando l'utente marca/smarca un pasto, si
confronta `mealsCompletion.date` con la data odierna. Se non coincidono, si
riparte da una mappa `done` vuota per oggi (i flag del giorno precedente
vengono scartati, non riportati). Non c'è alcuna scrittura automatica al
cambio di giorno: il reset avviene solo alla prossima interazione
dell'utente, esattamente come gli altri stati "di sessione" già gestiti da
`AppStateService` (bozze allenamento, override recupero). Ogni toggle
sovrascrive per intero il campo `mealsCompletion` con un'unica
`patchField('mealsCompletion', { date, done })` — niente merge parziale,
niente chiavi di giorni passati che si accumulano.

## UI

Nella card della vista slider (`dieta-detail.component.html`, blocco
`.meal-summary.noclick` righe 95-97), accanto al nome del pasto, viene
aggiunta una checkbox rotonda in una nuova classe dedicata `.meal-check`,
variante più piccola (18px invece di 28px) dello stile già esistente
`.set-check` (bordo neutro quando vuota, sfondo `--accent` + spunta nera
quando completata) — stesso linguaggio visivo del completamento delle serie
in allenamento, dimensione adattata al contesto (header della card, accanto
al nome, allineata a destra via flexbox). Confermata via mockup
(18px, font-size 9px per la spunta, bordo 2px invariato).

La vista lista (accordion) non viene toccata.

## Logica di indice iniziale

Nuova funzione di utilità (sostituisce interamente `findCurrentMealIndex`):

```ts
function firstUncompletedIndex(meals: MealVM[]): number {
  const idx = meals.findIndex(vm => !vm.completed);
  return idx === -1 ? meals.length - 1 : idx;
}
```

(Ritorna `0` se `meals` è vuoto, dato che `meals.length - 1` sarebbe `-1`
solo in quel caso — va gestito esplicitamente nel codice finale.)

Viene chiamata in due punti, entrambi già esistenti nel componente:

1. **`ngOnInit`** (diventa `async`): dopo aver impostato `this.plan` e
   `this.meals` (come oggi), attende `appState.load()`, legge
   `mealsCompletion` (ignorandolo se la sua `date` non è quella odierna),
   marca `vm.completed` per ciascun pasto, poi calcola `sliderIndex` con
   `firstUncompletedIndex(this.meals)` e scorre lì (`scrollToIndex`). Chiama
   `this.cdr.detectChanges()` alla fine (mutazione di stato dopo un `await`,
   pattern già stabilito nel resto della codebase per quest'app zoneless).
2. **L'`effect()` esistente nel costruttore** (si attiva quando
   `state.viewMode()` diventa `'slider'`): oggi chiama
   `findCurrentMealIndex(...)`, viene aggiornato per chiamare
   `firstUncompletedIndex(this.meals)` invece. Non ha problemi di timing
   asincrono perché scatta solo quando l'utente cambia vista manualmente,
   momento in cui il caricamento iniziale di `ngOnInit` è già concluso da
   tempo.

Il fatto che `ngOnInit` ricalcoli l'indice DOPO il proprio `await` (punto 1)
è ciò che evita la race: se l'app parte già in modalità slider, l'`effect`
del costruttore potrebbe scattare prima che `appState.load()` sia risolto
(userebbe `vm.completed = false` per tutti, indice 0) — ma il ricalcolo a
fine `ngOnInit` è autoritativo e sovrascrive `sliderIndex`/la posizione dello
slider non appena i dati reali sono disponibili.

## Toggle

Nuovo metodo `toggleMealCompleted(vm: MealVM): void` (o `async` se scrive
subito su Firestore) su `DietaDetailComponent`:

1. Calcola la mappa `done` corrente: se `mealsCompletion` in cache è di un
   giorno diverso da oggi, parte da `{}` invece che dai valori del giorno
   precedente.
2. Inverte `vm.completed` e aggiorna la entry corrispondente nella mappa
   `done` (chiave `vm.meal.id`).
3. Persiste con `appState.patchField('mealsCompletion', { date: todayLocalISO(), done })`.
4. Non tocca `sliderIndex` — l'utente resta sulla card che ha appena
   spuntato; il ricalcolo dell'indice avviene solo al caricamento pagina o
   al cambio vista lista/slider, non ad ogni singolo toggle.

## Cosa NON cambia

- Vista lista (accordion): nessuna modifica.
- `.set-check` (usata in scheda-detail per le serie) non viene toccata: la
  nuova `.meal-check` è una classe dedicata separata, solo ispirata allo
  stesso stile.
- Nessun impatto su `scheda-detail`, `WorkoutStateService`, o qualunque
  altro stato in `AppState` già esistente (il nuovo campo è additivo).

## File coinvolti

- `src/app/services/app-state.service.ts` — nuovo campo `mealsCompletion` in
  `AppState` e in `emptyState()`.
- `src/app/pages/dieta-detail/dieta-detail.component.ts` — `MealVM.completed`,
  `ngOnInit` asincrono, nuova funzione `firstUncompletedIndex`, metodo
  `toggleMealCompleted`, rimozione import/uso di `findCurrentMealIndex`.
- `src/app/pages/dieta-detail/dieta-detail.component.html` — checkbox nella
  card slider (righe 95-97).
- `src/styles.css` — nuova classe `.meal-check` (18px, variante dedicata di
  `.set-check`, non ne modifica la regola esistente).
- `src/app/core/utils/meal-time.util.ts` e
  `src/app/core/utils/meal-time.util.spec.ts` — **eliminati** (logica
  sostituita, nessun altro consumer).

## Test plan

- Aggiornare/aggiungere test unitari per `firstUncompletedIndex` (array
  vuoto → 0, nessun pasto completato → 0, alcuni completati → primo indice
  non completato, tutti completati → ultimo indice).
- Verifica visiva manuale: checkbox appare solo in vista slider, si riempie
  al tap, persiste ricaricando la pagina, si resetta cambiando la data di
  sistema del dispositivo (o verificando che una `mealsCompletion` con
  `date` di ieri venga ignorata), lo slider parte dal pasto giusto in tutti
  e 3 gli scenari (alcuni completati, nessuno completato, tutti completati).
- `npx ng build` e `npx ng test --watch=false` puliti.
