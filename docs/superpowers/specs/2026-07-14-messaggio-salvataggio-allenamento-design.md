# Design: messaggio di conferma salvataggio allenamento

Data: 2026-07-14

## Contesto

Quando il cliente salva una sessione di allenamento (`SchedaDetailComponent.saveWorkout()`),
l'unico feedback visivo oggi e' un cambio colore della piccola icona di
salvataggio nell'header (verde per successo, rosso per errore, per 2
secondi, poi torna allo stato neutro) — nessun testo. L'utente ha segnalato
che questo non basta: vuole un messaggio esplicito che confermi l'esito.

## Segnale gia' esistente (riusato, nessuna nuova logica)

`WorkoutStateService.saveStatus` e' gia' un signal `'idle' | 'saving' |
'saved' | 'err'`, aggiornato da `saveWorkout()`
(`scheda-detail.component.ts:344-378`) e gia' riportato a `'idle'`
automaticamente dopo 2 secondi (`scheda-detail.component.ts:376`). Questo
stesso segnale alimenta gia' oggi il colore dell'icona in `NavbarComponent`.

## Banner di conferma

Nuovo elemento nel template dello shell dell'app (`app.html`, dove vive
gia' `<app-navbar>`), **non** un nuovo componente/servizio dedicato:

```html
<div class="savebanner"
     *ngIf="showSaveWorkout && workoutState.saveStatus() !== 'idle' && workoutState.saveStatus() !== 'saving'"
     [class.err]="workoutState.saveStatus() === 'err'">
  {{ workoutState.saveStatus() === 'saved' ? 'Allenamento salvato ✓' : 'Errore durante il salvataggio. Riprova.' }}
</div>
```

- Visibile solo quando `showSaveWorkout` e' `true` (stessa condizione gia'
  usata per mostrare l'icona di salvataggio — la route della scheda
  allenamento), cosi' non compare mai su altre pagine.
- Compare/scompare in sync con l'icona esistente: nessun nuovo timer,
  riusa lo stesso reset a 2 secondi gia' presente in
  `scheda-detail.component.ts:376`.
- **Posizione**: in basso, sopra la tab bar inferiore (non in cima come
  prima ipotesi — l'utente ha chiesto esplicitamente "in basso").
  `position: fixed; bottom: calc(var(--tabbar-h) + var(--safe-b) + 12px);`
  centrato orizzontalmente, cosi' non copre la tab bar ne' richiede
  scroll per essere visto.
- Non bloccante: nessun overlay/backdrop, il resto della pagina resta
  interagibile.
- Stile: stesso linguaggio visivo delle classi `.saved`/`.err` gia'
  esistenti (verde `#30D158` / rosso `#FF453A`), pillola con
  `backdrop-filter` coerente con le altre card glass dell'app, breve
  transizione fade in/out (`.2s`).

## Testo

- `saved` → "Allenamento salvato ✓"
- `err` → "Errore durante il salvataggio. Riprova."

## Cosa NON cambia

- Nessuna modifica a `WorkoutStateService`, `saveWorkout()`, o al timer
  di reset a 2 secondi gia' esistente — il banner legge lo stesso signal
  gia' presente, non introduce nuovo stato.
- L'icona nell'header con il cambio colore resta invariata (il banner si
  aggiunge, non la sostituisce).

## Test

Nessun nuovo test automatico dedicato (lavoro di UI/template, stessa
convenzione gia' seguita per `app.html`/`app.ts` in questo progetto —
nessun file sotto `src/app/` a livello di shell ha `.spec.ts` dedicati a
logica di presentazione di questo tipo). Verifica tramite
`npx tsc --noEmit`, `npx ng test --watch=false` (conteggio invariato),
`npx ng build`, e verifica manuale: salvare un allenamento mostra il
banner verde in basso per ~2s; forzare un errore (es. disconnessione)
mostra il banner rosso; il banner non compare su altre pagine.
