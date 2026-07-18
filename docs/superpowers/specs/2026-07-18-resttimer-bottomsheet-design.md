# Rest-timer modal → bottom sheet

## Problema

Il modal "Recupero" (impostazione tempo di riposo tra le serie, in
`scheda-detail.component.html:131-149`) oggi è un dialog centrato nello
schermo, con overlay scuro dietro. L'utente vuole che diventi un **bottom
sheet**: ancorato in basso, che scivola su dal fondo dello schermo invece di
apparire al centro.

## Vincolo tecnico chiave

Il modal oggi riusa le classi condivise `.confirmoverlay` / `.confirmbox`
(`styles.css:431-434`), le stesse usate dal componente generico
`ConfirmDialogComponent` (template inline in `confirm-dialog.component.ts`),
impiegato in tutta l'app per le conferme "Elimina" (es. history-detail,
misure-storico-detail). Queste classi **non vanno toccate**: qualsiasi
modifica di layout/animazione per il rest-timer deve passare da classi CSS
nuove e dedicate solo a questo modal.

## Design approvato

**Opzione scelta: B — il foglio copre la tabbar**, arrivando fino al bordo
vero dello schermo (non si ferma sopra la tabbar lasciandola visibile).

- **Classi nuove dedicate**: `.resttimer-sheet-overlay` (sostituisce
  `.confirmoverlay` solo per questo modal) e `.resttimer-sheet` (sostituisce
  la combinazione `.confirmbox.restbox`). `.confirmoverlay` / `.confirmbox` /
  `.restbox` restano invariate e continuano a servire `ConfirmDialogComponent`
  esattamente come oggi.
- **Posizionamento**: `position: fixed`, `left: 0`, `right: 0`, `bottom: 0`,
  z-index sopra la tabbar. Il foglio copre la tabbar quando aperto.
- **Angoli**: arrotondati solo in alto (`border-top-left-radius` /
  `border-top-right-radius`, 24px), non in basso — il foglio tocca il bordo
  reale dello schermo.
- **Safe area**: padding inferiore aumentato di `var(--safe-b)` per non far
  finire i pulsanti sotto la notch/home indicator dei dispositivi con gesture
  bar.
- **Maniglia (grabber)**: una barretta orizzontale centrata in cima al
  foglio, solo decorativa (nessuna gesture di drag-to-dismiss richiesta —
  fuori scope), a segnalare visivamente che si tratta di un bottom sheet.
- **Contenuto interno**: invariato — titolo "Recupero — {{ nome esercizio }}",
  stepper −15/+15, bottone "Usa il default del protocollo", pulsanti
  Annulla/Salva. Nessuna modifica alla logica TS: `onRestOverlayClick()`,
  `closeRestModal()`, `saveRestModal()`, `adjustRestModalValue()`,
  `resetRestModalToDefault()` restano identiche — cambiano solo i nomi delle
  classi nel template e le regole CSS corrispondenti.
- **Chiusura via overlay**: click sullo sfondo scuro chiude il modal, stesso
  comportamento di oggi (riusa `onRestOverlayClick($event)`).
- **Animazione**: il foglio scivola su dal basso all'apertura e scivola giù
  alla chiusura, seguendo lo stesso pattern già usato dal widget `.resttimer`
  esistente (`styles.css:420-421`):
  ```css
  transform: translateY(100%);
  opacity: 0;
  pointer-events: none;
  transition: transform .45s var(--spring), opacity .3s ease;
  ```
  e in stato aperto (`.show`): `transform: translateY(0); opacity: 1;
  pointer-events: auto;`. A differenza del widget `.resttimer` (che parte da
  `calc(100% + 20px)` perché è già "quasi in vista" sopra la tabbar), il
  foglio bottom-sheet parte da `translateY(100%)` puro, dato che deve entrare
  completamente da fuori schermo.
- **Effetto vetro/chrome**: il foglio deve avere lo stesso trattamento di
  rifrazione delle altre superfici "chrome" dell'app. Si estende in modo
  additivo il selettore condiviso esistente (`styles.css:467-479`):
  ```css
  .tabbar::before,
  .resttimer::before,
  .rocker::before,
  .confirmbox::before,
  .resttimer-sheet::before {
    ...
  }
  ```
  Questa è un'estensione additiva della lista selettori — non modifica il
  comportamento di nessun consumer esistente.

## Cosa NON cambia

- Nessuna modifica a `.confirmoverlay`, `.confirmbox`, `.restbox`.
- Nessuna modifica a `ConfirmDialogComponent`.
- Nessuna modifica alla logica TypeScript del rest-timer modal (metodi,
  stato, binding di eventi) — solo rename delle classi nel template HTML e
  CSS nuovo/dedicato.
- Nessun drag-to-dismiss gestuale sul grabber (puramente visivo).

## File coinvolti

- `src/app/pages/scheda-detail/scheda-detail.component.html` — rename classi
  del blocco modal (righe 131-149): `.confirmoverlay` → `.resttimer-sheet-overlay`,
  `.confirmbox.restbox` → `.resttimer-sheet`. Aggiunta del div `.grabber`.
  Nessun cambiamento agli altri elementi/binding.
- `src/styles.css` — nuove regole `.resttimer-sheet-overlay`,
  `.resttimer-sheet`, `.resttimer-sheet.show`, `.grabber` (o nome scoped
  equivalente); estensione additiva del selettore chrome `::before`.

## Test plan

- Verifica visiva manuale: apertura/chiusura del modal Recupero da
  scheda-detail, controllo che il foglio scivoli su dal basso e copra la
  tabbar, angoli arrotondati solo in alto, contenuto invariato e funzionante
  (stepper, default, Annulla, Salva), click sullo sfondo chiude il modal.
- Verifica che `ConfirmDialogComponent` (es. conferma "Elimina" in
  history-detail) sia visivamente invariato dopo la modifica.
- Nessun test automatico nuovo necessario: modifica puramente di
  presentazione/CSS, nessuna logica nuova da coprire.
