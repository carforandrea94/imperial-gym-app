# Design: slider dieta parte dal pasto della fascia oraria corrente

Data: 2026-07-14

## Contesto

`DietaDetailComponent` (vista slider di un piano dieta) oggi riparte sempre
dalla prima card ogni volta che si entra nella pagina in modalita' slider
(`sliderIndex = 0` nell'`effect()` del costruttore, quando
`state.viewMode() === 'slider'`). Richiesta: che parta invece dal pasto
corrispondente all'ora corrente del dispositivo (es. se sono le 13:30, apri
sullo slide di "Pranzo").

Ambito confermato: solo dentro la schermata Dieta (nessun cambiamento alla
navigazione/schermata iniziale dell'app). Il pasto corrente si deduce da
parole chiave nel nome del pasto (nessuna nuova UI per il coach — i nomi
pasto restano liberi come oggi).

## Fasce orarie

Cinque fasce, basate sui nomi standard gia' usati come default
(`DEFAULT_MEAL_NAMES` in `diet.model.ts`), che coprono l'intera giornata
senza buchi:

| Parola chiave | Fascia oraria       |
|---------------|----------------------|
| colazione     | 05:00 – 10:29        |
| spuntino      | 10:30 – 11:59        |
| pranzo        | 12:00 – 15:29        |
| merenda       | 15:30 – 18:59        |
| cena          | 19:00 – 04:59 (giorno dopo) |

Riconoscimento case-insensitive per sottostringa nel nome del pasto (es.
"Colazione proteica" riconosce comunque "colazione"). Se **nessun** pasto
della dieta ha un nome che corrisponde alla parola chiave della fascia
oraria corrente (es. tutti i pasti hanno nomi personalizzati come
"Pre-workout"), lo slider parte dal primo pasto — stesso comportamento di
oggi, nessuna regressione.

## Nuova utility pura

`src/app/core/utils/meal-time.util.ts`:

```ts
export function findCurrentMealIndex(meals: NamedMeal[], now: Date = new Date()): number
```

Riceve l'elenco dei pasti del piano attivo e (opzionalmente, per i test) un
`Date` di riferimento; restituisce l'indice del pasto da mostrare per primo
nello slider. Logica pura, nessuna dipendenza da Angular — usa
`now.getHours()`/`now.getMinutes()` (ora locale del dispositivo, coerente
con "l'orario della location in cui si apre l'app").

## Integrazione in `DietaDetailComponent`

L'`effect()` gia' esistente nel costruttore (che oggi imposta sempre
`sliderIndex = 0` quando si passa alla vista slider) usa invece
`findCurrentMealIndex(this.plan?.meals ?? [])` per calcolare l'indice di
partenza, poi scrolla li' con lo stesso meccanismo gia' presente
(`scrollToIndex`). Nessun'altra modifica al componente: la vista lista, il
cambio manuale di pasto nello slider, e tutto il resto restano invariati.

## Cosa NON cambia

- Nessuna modifica al modello `Diet`/`NamedMeal` (nessun nuovo campo
  orario — deduzione solo dal nome, come deciso).
- Nessuna modifica alla navigazione dell'app all'avvio/login.
- Nessuna nuova UI lato coach.
- La vista lista (non-slider) della Dieta resta invariata.

## Test

`findCurrentMealIndex` e' logica pura e algoritmica (parsing orario +
matching parole chiave) → nuovo file `meal-time.util.spec.ts` con TDD,
casi: un orario dentro ciascuna delle 5 fasce con un pasto dal nome
riconosciuto corrispondente; un orario nella fascia "Cena" che attraversa
la mezzanotte (es. 02:00); nessun pasto con nome riconosciuto (fallback a
indice 0); pasto con nome che contiene la parola chiave come sottostringa
(es. "Colazione dolce").

Nessuna modifica a `DietaDetailComponent` giustifica un nuovo test
dedicato per il componente (convenzione gia' seguita per il resto delle
pagine del progetto) — la sola riga cambiata li' e' una chiamata alla
utility gia' testata.
