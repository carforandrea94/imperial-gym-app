# Design: bottone "Salva" di misura-categoria nell'header

Data: 2026-07-15

## Contesto

La feature "bottoni salva nell'header + toast di esito" (spec
`2026-07-15-salva-header-toast-design.md`, PR #47/#48) ha spostato i
bottoni "Salva" di scheda-detail/history-detail/coach-protocol-builder
nell'header, introducendo `ToastService` per l'esito del salvataggio.
Quella spec escludeva esplicitamente le altre pagine. L'utente segnala
che la pagina di inserimento/modifica di una misura
(`MisuraCategoriaComponent`, route `/misure/:categoria`) ha ancora il
vecchio bottone testuale in fondo pagina — questa spec estende la
feature a quella pagina.

`MisuraCategoriaComponent` serve **due flussi con lo stesso bottone**:
registrare una nuova misurazione oggi (nessun `?date=` in query) o
modificare una misurazione passata (`?date=YYYY-MM-DD`). A differenza
di history-detail (dove il bottone compare solo in "edit mode", un
sotto-stato della pagina), qui il bottone deve essere sempre visibile
su questa route, in entrambi i flussi.

## `MeasureCategoryStateService`

Nuovo servizio root, stesso pattern gia' usato da
`HistoryEditStateService`/`ProtocolBuilderStateService`:

```ts
@Injectable({ providedIn: 'root' })
export class MeasureCategoryStateService {
  saving = signal(false);
  private saveHandler: (() => void) | null = null;

  registerSaveHandler(handler: (() => void) | null): void {
    this.saveHandler = handler;
  }
  requestSave(): void {
    this.saveHandler?.();
  }
}
```

Nessun signal `editMode`/`editingSubform`: la visibilita' dell'icona
nell'header dipende **solo dalla route**, non da uno stato interno
della pagina (a differenza di history-detail/coach-protocol-builder).

## `MisuraCategoriaComponent`

`ngOnInit`: `this.measureState.registerSaveHandler(() => this.save());`
`ngOnDestroy`: `this.measureState.registerSaveHandler(null);`

`save()`: imposta `this.measureState.saving.set(true)` a inizio e
`.set(false)` in tutti i percorsi di uscita (nuova misurazione:
successo con navigate + ramo errore; modifica: successo con navigate +
ramo collisione + ramo errore). In aggiunta al comportamento esistente
(che resta invariato: `errorMsg`, `saveStatus` locale usato solo per il
colore/stile del bottone in fondo pagina, che verra' rimosso):

- nuova misurazione, successo → `toast.success('Misurazione salvata ✓')`
- nuova misurazione, errore → `toast.error('Errore durante il salvataggio. Riprova.')`
- modifica, successo → `toast.success('Misurazione aggiornata ✓')`
- modifica, collisione → `toast.error('Esiste gia\' una misurazione di questo tipo in questa data.')`
- modifica, errore generico → `toast.error('Errore durante il salvataggio. Riprova.')`

Il campo `saveStatus: 'idle'|'err'` e i metodi `getSaveBtnClass()`/
`getSaveBtnText()` vengono **rimossi** insieme al bottone in fondo
pagina (non hanno piu' un consumatore: l'icona nell'header non ha
testo, l'esito lo comunica solo il toast). `errorMsg` resta invariato
per il messaggio di collisione/data futura mostrato inline
(`<p class="autherror">`).

**Template**: rimuovi il blocco `.savebar` con il bottone Salva
(`misura-categoria.component.html:32-36`).

## Icona nell'header

Stesso pattern gia' usato per `showSaveEdit`/`showProtocolSave` in
`NavbarComponent`: nuovo `@Input() showSaveMeasure`, `@Input()
measureSaving`, `@Output() saveMeasureClick`, stesso checkmark SVG
riusato altrove.

`app.ts`: nel blocco che gia' gestisce la route `/misure/:categoria`
(`app.ts`, match `categoriaMatch`), aggiungi `this.showSaveMeasure =
true;` (nuovo campo, azzerato come gli altri a `false` all'inizio di
`updateNav()` insieme a `showSaveWorkout`/`showSettings`/etc.).

`app.html`: nuovi binding `[showSaveMeasure]="showSaveMeasure"`,
`[measureSaving]="measureState.saving()"`,
`(saveMeasureClick)="measureState.requestSave()"`.

## Cosa NON cambia

- Nessuna modifica a `ToastService`, alle altre pagine gia' migrate, o
  al comportamento delle route diverse da `/misure/:categoria`.
- `errorMsg` (messaggio di data futura/collisione mostrato inline)
  resta invariato — il toast si aggiunge.

## Test

Nessun test automatico dedicato al solo componente di presentazione
(stessa convenzione gia' seguita per history-detail/coach-protocol-builder
in questa feature), ma nuovo `.spec.ts` minimo per
`MeasureCategoryStateService` (stesso stile di
`history-edit-state.service.spec.ts`): `saving` parte a `false`,
`requestSave()` senza handler non lancia, invoca l'handler registrato,
`registerSaveHandler(null)` lo rimuove.
Verifica tramite `npx tsc --noEmit -p tsconfig.app.json`, `npx ng test
--watch=false`, `npx ng build`, e verifica manuale: aprire una nuova
misurazione mostra l'icona nell'header (non il vecchio bottone),
salvare mostra il toast verde e torna a `/misure`; aprire una
misurazione passata da modificare mostra la stessa icona, salvare
mostra il toast verde e torna allo storico; forzare una collisione
mostra il toast rosso con lo stesso testo gia' presente inline.
