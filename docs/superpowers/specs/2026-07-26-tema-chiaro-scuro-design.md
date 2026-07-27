# Design: tema chiaro/scuro con toggle in Account

Data: 2026-07-26

## Contesto

L'app oggi ha un solo tema (scuro, "iOS 26 dark"), definito da ~35 custom
property CSS in un unico blocco `:root` di `src/styles.css`. Richiesta:
"Aggiungi nella sezione account una sezione impostazioni in cui puoi
cambiare da modalità notte a modalità giorno" — un tema chiaro reale,
applicato a tutta l'app (non solo un'anteprima), attivabile da un nuovo
controllo nella pagina Account.

Un mockup a 2 schermate (card esercizio scheda, card pasto dieta) e' gia'
stato mostrato e approvato in linea di massima:
`https://claude.ai/code/artifact/32b13674-0aa9-4a36-be0d-363d73f72df9`, con
questa palette chiara di partenza:

| Token | Scuro (attuale) | Chiaro (proposto) |
|---|---|---|
| `--bg` | `#0C0D14` | `#F6F7FA` |
| `--content-glass-bg` | `rgba(22,26,34,.46)` | `#FFFFFF` |
| `--label` | `#FFFFFF` | `#14171C` |
| `--accent` (`--imp-red`) | `#A4C2F6` | `#3E63E0` |
| `--imp-amber` (verde, secondario/"Grassi") | `#80D09A` | `#2E9A5C` |
| `--macro-carb` | `#E8C468` | `#B8862A` |
| `--macro-protein` | `#E8918A` | `#C85C52` |
| `--sys-cyan` | `#64D2FF` | `#0A8FC4` |

Il mockup copriva solo 2 schermate: questa spec estende il retheme a
**tutti** i token del blocco `:root` (35 righe, `src/styles.css:2-43`) e a
tutte le pagine dell'app.

Decisioni gia' prese con l'utente:
- **Persistenza**: sincronizzata su Firestore (come `workoutViewMode`/
  `dietViewMode` in `AppStateService`), non solo locale al dispositivo.
- **Default per chi non ha mai scelto**: segue la preferenza del sistema
  operativo (`prefers-color-scheme`), non fisso su scuro.

## Approccio

Pattern a custom property + attributo `data-theme` sull'elemento `<html>`:
un secondo blocco `:root[data-theme="light"] { ... }` ridefinisce tutti i
token esistenti; ogni componente continua a referenziare `var(--xxx)` senza
modifiche — nessuna proprieta' CSS del resto del codebase cambia nome o uso.

Alternative scartate:
- **Classe su `<body>` invece di attributo su `<html>`**: equivalente in
  pratica, ma `data-theme` e' lo stesso pattern gia' usato nei mockup
  Artifact di questa sessione e si presta meglio a un domani "auto" (media
  query) senza dover toccare JS.
- **Duplicare gli stili per componente invece di ridefinire i token**:
  scartato subito — vanificherebbe il punto centrale del sistema di design
  esistente (un'unica fonte di verita' per i colori) e richiederebbe di
  toccare decine di file invece di uno.

## `--accent-contrast`: il problema del testo scuro sull'accento

Grep su `styles.css` mostra molte regole che affiancano un
`background:var(--accent)` (o `var(--imp-red)`/`var(--state-success)`, che
oggi puntano allo stesso blu) a un **testo scuro hardcoded**
(`color:#000` o `color:#04140D`) — corretto oggi perche' l'accento e' un
blu pastello chiaro (`#A4C2F6`), ma il tema chiaro approvato lo approfondisce
a `#3E63E0` (blu pieno), su cui un testo nero diventa illeggibile. Spot
individuati (lista indicativa, l'audit completo e' compito
dell'implementazione):

`.saveworkout-icon`/`.saveworkout-icon.saved`, `.viewtogglebtn.active`,
`.ex-counter.complete`, `.set-check.done`, `.meal-check.done`,
`.protocol-status.ps-active`, `.shop-check`, `.shop-addbtn`, `.savebtn`,
`.rocker .lbl.active`, `.confirmbtn.restsave`, `.confirmbtn.confirm`.

Soluzione: nuovo token `--accent-contrast` (`#04140D` in scuro, `#FFFFFF` in
chiaro — invariato per lo stato scuro, cosi' nessuna resa visiva cambia nel
tema esistente), e sostituzione sistematica di ogni `color:#000`/
`color:#04140D` affiancato a uno sfondo derivato da `--accent` con
`color:var(--accent-contrast)`. Gli stati "verdi" indipendenti dall'accento
(es. `.savebtn.saved` con `rgba(var(--state-success-rgb),.85)` e
`color:#04220f`) restano come sono: non sono nello scope di questo problema
perche' non condividono la tinta con `--accent`.

## `ThemeService`

Nuovo servizio, stesso pattern di `WorkoutStateService.viewMode`
(`src/app/services/workout-state.service.ts:34-91`):

```ts
export type ThemeMode = 'dark' | 'light';

const THEME_CACHE_KEY = 'themePreference';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  mode = signal<ThemeMode>(this.initialMode());

  constructor(private appState: AppStateService, private auth: AuthService) {
    effect(() => {
      document.documentElement.setAttribute('data-theme', this.mode());
    });

    effect(() => {
      if (!this.auth.authReady() || !this.auth.currentUser()) return;
      this.appState.load().then(state => {
        if (state.themeMode && state.themeMode !== this.mode()) {
          this.mode.set(state.themeMode);
          localStorage.setItem(THEME_CACHE_KEY, state.themeMode);
        }
      });
    });
  }

  private initialMode(): ThemeMode {
    const cached = localStorage.getItem(THEME_CACHE_KEY);
    if (cached === 'dark' || cached === 'light') return cached;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  setMode(mode: ThemeMode): void {
    if (this.mode() === mode) return;
    this.mode.set(mode);
    localStorage.setItem(THEME_CACHE_KEY, mode);
    this.appState.patchField('themeMode', mode);
  }
}
```

Differenza voluta rispetto a `viewMode`: qui il valore Firestore e' opzionale
per natura (`themeMode: ThemeMode | null` in `AppState`, default `null`) —
se l'utente non ha mai toccato il toggle, non scriviamo mai un valore
esplicito, cosi' l'app continua a seguire `prefers-color-scheme` anche se
l'utente cambia le impostazioni del proprio telefono in futuro. Solo il
primo `setMode()` esplicito "fissa" la scelta su Firestore.

Il servizio va istanziato presto (es. iniettato in `AppComponent` cosi' il
suo costruttore gira all'avvio) per applicare `data-theme` prima che l'utente
navighi.

`AppStateService.AppState` (`src/app/services/app-state.service.ts:14-27`)
guadagna `themeMode: ThemeMode | null`, con default `null` in `emptyState()`.

## Anti-flash (FOUC)

Uno script inline in `src/index.html`, dentro `<head>` prima del CSS
compilato Angular, legge `localStorage['themePreference']` (stessa chiave
usata da `ThemeService`) o `matchMedia` come fallback, e applica subito
`document.documentElement.setAttribute('data-theme', ...)`. Evita il lampo
del tema scuro di default prima che Angular finisca il bootstrap.

## UI in Account

`src/app/pages/account/account.component.html`: nuova card `.infocard`
"Impostazioni", inserita subito dopo la card profilo (righe 1-9) e prima
della card email/membro-dal (righe 18-27):

```html
<p class="sectiontitle">Impostazioni</p>
<div class="infocard">
  <div class="account-row">
    <span class="account-row-label">Tema</span>
    <div class="viewtoggle theme-toggle">
      <button class="viewtogglebtn" [class.active]="theme.mode() === 'dark'"
              (click)="theme.setMode('dark')">Notte</button>
      <button class="viewtogglebtn" [class.active]="theme.mode() === 'light'"
              (click)="theme.setMode('light')">Giorno</button>
    </div>
  </div>
</div>
```

Riuso di `.viewtoggle`/`.viewtogglebtn` (`styles.css:159-161`, oggi usato
per lista/slider in navbar): stesso linguaggio visivo del resto dell'app
invece di un componente nuovo. Serve una variante `.theme-toggle` (o
regole aggiuntive scoped) perche' l'uso attuale e' pensato per due icone
strette (30px) in una toolbar, mentre qui il controllo ospita due etichette
di testo ("Notte"/"Giorno") in una riga di impostazioni — stessa struttura
(`display:flex`, pillola attiva con `background:var(--accent)`), ma
`width:auto` e padding orizzontale per il testo invece della larghezza fissa
a icona.

`AccountComponent` inietta `theme = inject(ThemeService)` (pattern gia' in
uso per `auth` nello stesso componente) — nessun nuovo metodo nel
componente, il binding chiama direttamente `theme.setMode(...)`.

## Cosa NON cambia

- Nessun nome di custom property esistente cambia — solo nuovi valori sotto
  `:root[data-theme="light"]` e il nuovo token `--accent-contrast`.
- Nessuna struttura HTML/layout dei componenti esistenti (a parte la nuova
  card Impostazioni in Account).
- Tipografia (Inter + IBM Plex Mono) invariata in entrambi i temi.
- `--imp-red`/`--imp-amber` restano i nomi storici anche se la spec li
  chiama "blu"/"verde" per chiarezza — non li rinominiamo per non toccare
  ogni file che li referenzia.

## Test

- `theme.service.spec.ts` (nuovo, scritto da zero — `WorkoutStateService`
  non ha un file di test dedicato da cui copiare setup): `initialMode()`
  legge da localStorage se presente, altrimenti da `matchMedia`; `setMode()`
  aggiorna signal + localStorage + chiama
  `appState.patchField('themeMode', ...)`; l'`effect` di sync da Firestore
  aggiorna signal+localStorage solo se `state.themeMode` e' impostato e
  diverso dal valore corrente. `AppStateService`/`AuthService` mockati come
  oggetti/funzioni manuali (Vitest, non `jasmine.createSpyObj`).
- Nessun nuovo test per `account.component` (il componente non ha oggi test
  propri, stesso principio gia' applicato a `coach-protocol-builder` nella
  spec Integrazione).
- Verifica manuale (Playwright) su almeno 2-3 schermate reali (scheda,
  dieta, account) in entrambi i temi, per side-effect da controllare
  visivamente (contrasto, nessun colore hardcoded dimenticato) che un test
  automatico non catturerebbe comunque.
