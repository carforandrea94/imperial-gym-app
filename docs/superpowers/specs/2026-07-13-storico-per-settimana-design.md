# Design: storico sedute diviso per settimana

Data: 2026-07-13

## Contesto

`HistoryListComponent` (`src/app/pages/scheda/storico`, file
`src/app/pages/history-list/`) mostra oggi tutte le sessioni di allenamento
salvate (`WorkoutSessionsService.listAll()`) come lista piatta, ordinate
dalla piu' recente alla piu' vecchia, sotto un unico titolo generico
"Sedute salvate".

Richiesta: dividere lo storico in base alle settimane del programma.

## Calcolo della settimana: nuovo metodo puro su `WorkoutStateService`

`WorkoutStateService` ha gia' `computeAutoWeek(startISO, maxWeeks)` (privato,
usato per calcolare la settimana di **oggi**, con clamp `[1, maxWeeks]` —
questa logica resta intatta, non va toccata).

Aggiungo un metodo pubblico separato, per classificare la settimana di una
**data qualsiasi** (non solo oggi), senza alcun clamp superiore (una seduta
puo' cadere in una settimana oltre `maxWeeks` se il cliente continua ad
allenarsi oltre la durata pianificata del protocollo) e senza clamp
inferiore (un numero ≤ 0 e' il segnale che la seduta e' precedente
all'inizio del programma attuale):

```ts
weekNumberForDate(dateISO: string, programStart: string): number {
  const start = new Date(programStart + 'T00:00:00');
  const date = new Date(dateISO + 'T00:00:00');
  const diffDays = Math.floor((date.getTime() - start.getTime()) / 86400000);
  return Math.floor(diffDays / 7) + 1;
}
```

Stessa formula di `computeAutoWeek` (nessuna divergenza algoritmica),
semplicemente applicata a una data arbitraria e senza i due `Math.min`/
`Math.max` che in `computeAutoWeek` servono solo per la visualizzazione
della settimana corrente.

## Raggruppamento in `HistoryListComponent`

```ts
interface SessionEntry {
  key: string;
  session: WorkoutSession;
  displayDate: string;
  completedSets: number;
  weekNumber: number; // da weekNumberForDate; ≤ 0 = precedente al programma attuale
}

interface WeekGroup {
  label: string;   // "Settimana N" oppure "Altre sedute"
  entries: SessionEntry[];
}
```

Dopo il caricamento (logica di `loadSessions()` invariata: race con timeout
12s, gestione errore, `cdr.detectChanges()`), ogni sessione riceve
`weekNumber` calcolato con `state.weekNumberForDate(session.date,
state.DEFAULT_PROGRAM_START)`. `state.DEFAULT_PROGRAM_START` e' gia'
garantito popolato con l'inizio del protocollo attivo reale prima che
questa pagina si attivi (route protetta da `clientGuard`, che attende
`ProtocolBootstrapService.ensureLoaded()` — verificato in
`core/guards/client.guard.ts:16` e `protocol-bootstrap.service.ts:33`).

Le sessioni vengono poi raggruppate:
- Un gruppo per ogni valore di `weekNumber >= 1` effettivamente presente tra
  le sedute salvate (nessun gruppo vuoto per settimane senza sedute),
  etichettato `Settimana {n}`, ordinati in ordine crescente (Settimana 1,
  Settimana 2, ...).
- Un gruppo finale `Altre sedute`, mostrato solo se non vuoto, con tutte le
  sedute che hanno `weekNumber <= 0` (precedenti all'inizio del protocollo
  attivo — es. da un protocollo sostituito in precedenza).
- Dentro ogni gruppo le sedute mantengono l'ordine gia' restituito da
  `listAll()` (piu' recente prima) — nessun nuovo ordinamento necessario.

## Template

Il titolo generico `<p class="sectiontitle">Sedute salvate</p>` viene
sostituito da un titolo per gruppo, iterando `weekGroups` invece della
lista piatta `sessions`:

```html
<div *ngIf="!loading && !errorMsg" *ngFor="let g of weekGroups">
  <p class="sectiontitle">{{ g.label }}</p>
  <div class="grouplist">
    <div class="daycard press-fx" *ngFor="let s of g.entries" (click)="goToDetail(s.key)">
      <!-- markup .daycard invariato: stesso binding di oggi -->
    </div>
  </div>
</div>
```

Gli stati di caricamento/errore/vuoto (`loading`, `errorMsg`,
`sessions.length === 0`) restano identici a oggi, solo la sezione "success"
viene ristrutturata in gruppi.

## Cosa NON cambia

- `computeAutoWeek()` (settimana corrente per la UI di allenamento) resta
  invariato, non viene toccato ne' riusato direttamente da questa feature.
- Nessuna modifica al modello `Protocol`/`WorkoutSession`.
- Comportamento di eliminazione seduta (`deleteSession`) invariato: dopo la
  cancellazione si ricarica e riraggruppa tutto da capo, stessa logica di
  oggi (`loadSessions()` seguito da re-render).

## Test

`weekNumberForDate` e' logica pura e algoritmica (stessa classe di
`detectProtocolWeekPlan` in `pdf-import.service.ts`) → nuovo file
`src/app/services/workout-state.service.spec.ts` con casi: data precedente
all'inizio programma (risultato ≤ 0), esattamente il giorno di inizio
(risultato 1), confine 7°/8° giorno (1 → 2), diverse settimane dopo, nessun
clamp superiore (settimana > 8 restituita cosi' com'e').

Il raggruppamento in `HistoryListComponent` (funzione pura ma di
presentazione, non di dominio) non ha test dedicati, stessa convenzione
gia' seguita per il resto dei componenti pagina del progetto (nessun
`.spec.ts` sotto `src/app/pages/**`).
