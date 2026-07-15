# Design: bottoni "Salva" nell'header + toast di esito

Data: 2026-07-15

## Contesto

Oggi i salvataggi che modificano dati esistenti hanno bottoni testuali in
fondo pagina (`.savebtn`), tranne "Completa allenamento" in scheda-detail
che gia' vive come icona nell'header (`NavbarComponent`, classe
`saveworkout-icon`) con cambio colore icona (verde/rosso, 2s) come unico
feedback.

Perimetro concordato (vedi conversazione): questa feature copre solo i
salvataggi che **modificano dati esistenti di una pagina**:

1. **scheda-detail** — "Completa allenamento" (gia' in header oggi)
2. **history-detail** — "Salva" (modifica data/valori di una seduta passata)
3. **coach-protocol-builder** — "Salva bozza" / "Salva e attiva" (i 2
   bottoni della pagina, non i salvataggi di un singolo esercizio/pasto
   in modifica, che restano dove sono)

Esclusi esplicitamente: login/register/coach-register (pagine senza
header/chrome), "Pubblica avviso" in coach-bacheca e "Elabora/Aggiorna"
in coach-protocol-import (creazione/processo, non modifica di dati
esistenti; l'import PDF ha gia' la sua progress bar dedicata).

C'era gia' un piano mai eseguito (`2026-07-14-messaggio-salvataggio-allenamento`)
per un banner di conferma testuale limitato al solo allenamento. Questa
feature lo generalizza e lo sostituisce: il banner diventa un toast
generico riusabile da qualunque pagina, non solo dall'allenamento.

## 1. `ToastService` + `<app-toast>` (meccanismo generico)

Nuovo servizio `providedIn: 'root'`:

```ts
export type ToastKind = 'success' | 'error';

@Injectable({ providedIn: 'root' })
export class ToastService {
  toast = signal<{ kind: ToastKind; message: string } | null>(null);
  private hideTimeout: ReturnType<typeof setTimeout> | null = null;

  success(message: string): void { this.show('success', message); }
  error(message: string): void { this.show('error', message); }

  private show(kind: ToastKind, message: string): void {
    if (this.hideTimeout) clearTimeout(this.hideTimeout);
    this.toast.set({ kind, message });
    this.hideTimeout = setTimeout(() => this.toast.set(null), 2500);
  }
}
```

Un solo toast alla volta: un nuovo `show()` sostituisce quello corrente e
riazzera il timer. Non serve una coda (i salvataggi di questa app sono
un'azione utente alla volta).

`<app-toast>` (nuovo componente, standalone, nessun `@Input`, legge
direttamente `toastService.toast()`), montato una volta sola in
`app.html` accanto a `<app-confirm-dialog>`:

```html
<app-toast></app-toast>
```

```html
<!-- toast.component.html -->
<div class="apptoast" *ngIf="toast.toast() as t" [class.error]="t.kind === 'error'">
  {{ t.message }}
</div>
```

CSS (riusa il linguaggio visivo e la posizione gia' pensati per il
banner mai spedito — in basso, sopra la tab bar, non bloccante):

```css
.apptoast{position:fixed;left:50%;bottom:calc(var(--tabbar-h) + var(--safe-b) + 12px);transform:translateX(-50%);z-index:65;padding:10px 20px;border-radius:20px;background:rgba(48,209,88,0.92);color:#04220f;font-weight:600;font-size:14px;box-shadow:0 6px 18px rgba(0,0,0,.3);backdrop-filter:blur(12px) saturate(125%);-webkit-backdrop-filter:blur(12px) saturate(125%);animation:fade .2s ease;white-space:nowrap;max-width:calc(100vw - 32px);text-overflow:ellipsis;overflow:hidden;}
.apptoast.error{background:rgba(255,69,58,0.92);color:#fff;}
```

Il toast e' additivo ovunque: non rimuove i messaggi di errore inline
gia' esistenti nelle pagine (es. `errorMsg`/`saveMsg`), che restano per
i dettagli piu' lunghi (es. "salvataggio incompleto: ..."). Il toast da'
solo un riscontro breve e coerente, visibile anche se il salvataggio
causa una navigazione immediata (caso di coach-protocol-builder, vedi
sotto) perche' vive nello shell dell'app, fuori dal `router-outlet`.

## 2. scheda-detail — solo aggiunta del toast

Nessun cambiamento strutturale (l'icona in header esiste gia'). In
`saveWorkout()` (`scheda-detail.component.ts:344-378`), in aggiunta al
comportamento attuale:
- ramo successo (riga ~368): `this.toast.success('Allenamento salvato ✓')`
- rami errore (righe ~370, ~374): `this.toast.error('Errore durante il salvataggio. Riprova.')`

Il cambio colore dell'icona (verde/rosso, 2s) resta invariato: il toast
si aggiunge, non sostituisce.

## 3. history-detail — icona in header + toast

**Nuovo servizio** `HistoryEditStateService` (root), stesso pattern gia'
usato da `WorkoutStateService` per inoltrare il click dall'header (fuori
dalla pagina) alla pagina stessa:

```ts
@Injectable({ providedIn: 'root' })
export class HistoryEditStateService {
  editMode = signal(false);
  saving = signal(false);
  private saveHandler: (() => void) | null = null;

  registerSaveHandler(handler: (() => void) | null): void { this.saveHandler = handler; }
  requestSave(): void { this.saveHandler?.(); }
}
```

**`HistoryDetailComponent`**: il campo locale `editMode: boolean`
diventa un getter che legge il servizio (nessun'altra riga del template
esistente cambia):

```ts
get editMode(): boolean { return this.historyEditState.editMode(); }
```

I 4 punti che oggi assegnano `this.editMode = true/false`
(`enterEditMode`, `cancelEdit`, `saveEdit` ramo successo, `ngOnInit`
guardia sessione-non-trovata) diventano
`this.historyEditState.editMode.set(true/false)`.

`ngOnInit`: `this.historyEditState.registerSaveHandler(() => this.saveEdit());`
`ngOnDestroy`: `this.historyEditState.registerSaveHandler(null); this.historyEditState.editMode.set(false);`
(l'uscita da edit mode alla chiusura pagina evita che l'icona nell'header
resti visibile se l'utente naviga via mentre e' in modifica).

`saveEdit()` (`history-detail.component.ts:153-182`): imposta
`this.historyEditState.saving.set(true)` all'inizio e `.set(false)` alla
fine (tutti e 3 i rami: successo/collisione/errore); in aggiunta al
comportamento attuale (che resta invariato):
- successo: `this.toast.success('Seduta aggiornata ✓')`
- collisione: `this.toast.error('Esiste gia\' una seduta in questa data.')`
- errore generico: `this.toast.error('Errore durante il salvataggio. Riprova.')`

**Template**: rimuovere il bottone `<button class="savebtn"
(click)="saveEdit()">Salva</button>` (`history-detail.component.html:87`).
Restano invariati "Modifica"/"Elimina questa seduta" (non editMode) e
"Annulla" (editMode, `cancel-accent`) — non sono salvataggi.

**`NavbarComponent`**: nuovo bottone icona, stesso stile di
`saveworkout-icon` (checkmark), stesso pattern esistente:

```html
<button class="navicon" *ngIf="showSaveEdit" [disabled]="saveEditSaving"
  (click)="saveEditClick.emit()" aria-label="Salva modifiche" title="Salva modifiche">
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 6L9 17l-5-5"/>
  </svg>
</button>
```

Nuovi `@Input() showSaveEdit`, `@Input() saveEditSaving`,
`@Output() saveEditClick`.

**`app.ts`/`app.html`**: `showSaveEdit` legge direttamente il signal del
servizio (non serve un flag di route: il signal e' `true` solo quando
`HistoryDetailComponent` e' montato ed e' lui stesso a metterlo a
`true`/`false`):

```html
[showSaveEdit]="historyEditState.editMode()"
[saveEditSaving]="historyEditState.saving()"
(saveEditClick)="historyEditState.requestSave()"
```

## 4. coach-protocol-builder — 2 icone in header + toast

**Nuovo servizio** `ProtocolBuilderStateService` (root), stesso pattern,
con 2 handler distinti (bozza/attiva) perche' sono 2 azioni diverse:

```ts
@Injectable({ providedIn: 'root' })
export class ProtocolBuilderStateService {
  editingSubform = signal(false);
  saving = signal(false);
  private draftHandler: (() => void) | null = null;
  private activateHandler: (() => void) | null = null;

  registerHandlers(draft: (() => void) | null, activate: (() => void) | null): void {
    this.draftHandler = draft;
    this.activateHandler = activate;
  }
  requestSaveDraft(): void { this.draftHandler?.(); }
  requestSaveActivate(): void { this.activateHandler?.(); }
}
```

**`CoachProtocolBuilderComponent`**: `editingSubform` rispecchia
`!!this.editingExercise || !!this.editingMeal`. Poiche'
`editingExercise`/`editingMeal` sono campi normali (non signal), la
sincronizzazione avviene con una chiamata esplicita
`this.protocolBuilderState.editingSubform.set(...)` subito dopo ciascuna
delle assegnazioni esistenti a quei 2 campi (7 punti, righe 86-234) —
stesso stile "set esplicito" gia' usato per `editMode` in history-detail.

`ngOnInit`: `this.protocolBuilderState.registerHandlers(() => this.save(false), () => this.save(true));`
`ngOnDestroy`: `this.protocolBuilderState.registerHandlers(null, null);`

`save(activateAfter: boolean)` (righe 363-396): imposta
`this.protocolBuilderState.saving.set(true)` a inizio e `.set(false)` in
`finally` (in aggiunta al gia' esistente `this.saving`, che resta
invariato per l'uso locale); in aggiunta al comportamento attuale:
- successo: `this.toast.success(activateAfter ? 'Protocollo attivato ✓' : 'Bozza salvata ✓')`
- mismatch: `this.toast.error('Salvataggio incompleto, riprova.')`
- catch: `this.toast.error('Errore durante il salvataggio. Riprova.')`

**Template**: rimuovere il blocco `.savebar.builder-savebar`
(`coach-protocol-builder.component.html:409-416`, i 2 bottoni "Salva
bozza"/"Salva e attiva"). Restano invariati "Salva esercizio"/"Fatto"
dentro l'editor di un esercizio/pasto (non sono l'azione salva-pagina).

**`NavbarComponent`**: 2 icone, stesso pattern del `.viewtoggle` (2
bottoni gia' affiancati in navbar):

```html
<div class="protocolsave" *ngIf="showProtocolSave">
  <button class="navicon" [disabled]="protocolSaving" (click)="saveDraftClick.emit()"
    aria-label="Salva bozza" title="Salva bozza">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
      <polyline points="17 21 17 13 7 13 7 21"/>
      <polyline points="7 3 7 8 15 8"/>
    </svg>
  </button>
  <button class="navicon" [disabled]="protocolSaving" (click)="saveActivateClick.emit()"
    aria-label="Salva e attiva" title="Salva e attiva">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 6L9 17l-5-5"/>
    </svg>
  </button>
</div>
```

Nuovi `@Input() showProtocolSave`, `@Input() protocolSaving`,
`@Output() saveDraftClick`, `@Output() saveActivateClick`.

**`app.ts`/`app.html`**: `showProtocolSave` combina la route gia'
riconosciuta oggi (stessa regex che gia' imposta `showSettings = true`
per `/coach/clienti/:id/builder/:protocolId`) con lo stato "non sto
modificando un sotto-form", esposto come getter:

```ts
get showProtocolSave(): boolean {
  return this.showSettings && !this.protocolBuilderState.editingSubform();
}
```

(riuso di `showSettings` come flag di route perche' e' gia' vero solo
ed esattamente su quella route — nessuna nuova regex duplicata).

```html
[showProtocolSave]="showProtocolSave"
[protocolSaving]="protocolBuilderState.saving()"
(saveDraftClick)="protocolBuilderState.requestSaveDraft()"
(saveActivateClick)="protocolBuilderState.requestSaveActivate()"
```

## Cosa NON cambia

- Nessuna coda toast, nessuna libreria esterna.
- Nessuna modifica ai messaggi di errore inline esistenti (`errorMsg`,
  `saveMsg`) — restano, il toast si aggiunge.
- Il cambio colore dell'icona di scheda-detail resta invariato.
- "Salva esercizio"/"Fatto" (editor di un singolo esercizio/pasto)
  restano bottoni testuali dove sono oggi, fuori scope.
- Il piano mai eseguito `2026-07-14-messaggio-salvataggio-allenamento`
  viene considerato superato da questa spec e non verra' implementato a
  parte (il suo CSS/posizionamento e' riusato qui per `.apptoast`).

## Test

Nessun test automatico dedicato al solo banner/toast visivo (stessa
convenzione gia' seguita per `app.html`/`styles.css` in questo
progetto), ma:
- `ToastService`: nuovo `.spec.ts` (auto-dismiss dopo 2.5s con
  `fakeAsync`/`tick`, sostituzione di un toast con uno nuovo cancella il
  timer precedente).
- `HistoryEditStateService`/`ProtocolBuilderStateService`: nuovi
  `.spec.ts` minimi (register/request inoltra la chiamata all'handler
  registrato, `null` non lancia).
- Verifica tramite `npx tsc --noEmit -p tsconfig.app.json`,
  `npx ng test --watch=false`, `npx ng build`, e verifica manuale:
  salvare da ciascuna delle 3 pagine mostra il toast corretto (verde
  per successo, rosso per errore), le icone spariscono/appaiono nelle
  condizioni giuste (edit mode per history-detail, non-sotto-form per
  coach-protocol-builder), i bottoni testuali in fondo pagina non ci
  sono piu' per le 2 pagine migrate.
