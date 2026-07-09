import { vi } from 'vitest';

// pdfjs-dist tocca API browser (DOMMatrix, canvas) assenti nell'ambiente di test:
// qui testiamo solo il parsing testuale, non l'estrazione reale dal PDF, quindi
// stubbiamo il modulo per poter importare il servizio senza side effect.
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {},
  version: '0.0.0',
  getDocument: () => ({ promise: Promise.resolve({ numPages: 0 }) })
}));

import { PdfImportService } from './pdf-import.service';

// Testo ricostruito riga per riga come lo produrrebbe extractText() (con hasEOL corretto)
// a partire dal PDF "DIETA_ANDREA_CARFORA" (template Giorno ON/OFF, Dott. Luigi Iannotta).
// Include volutamente i casi limite osservati nel PDF reale:
// - alimento e marcatore "Alternative:" uniti sulla stessa riga ("Petto di pollo 200 g Alternative:")
// - "Alternative:" ripetuto dopo un'interruzione di pagina ("...Continua Cena")
// - il glitch di estrazione "Olio di oli 10 g va (media)" al posto di "Olio di oliva (media) 10 g"
// - "Verdure fresche" che non ha uno slot dedicato nel modello a 3 macro
const SAMPLE_TEXT = `
Dott. Luigi Iannotta
Giorno ON
COLAZIONE
Uova di gallina - albume 200 g
Farina d'avena 5 Cucchiai 50 g
Burro d'arachidi 2 Cucchiaini 10 g
COLAZIONE ALTERNATIVA 1
Yogurt greco 0% bianco 200 g
Fiocchi d'avena 4 Cucchiai 40 g
Alternative:
Riso soffiato 4 Cucchiai 40 g
Fette biscottate integrali 4 Fette 40 g
Frutta secca e oleosa (media) 10 g
Alternative:
Semi di Chia 10 g
COLAZIONE ALTERNATIVA 2
Uova di gallina (media) 120 g
Pane tostato 2 Fette 50 g
Uova di gallina - albume 70 g
SPUNTINO MATTINA
Proteine Isolate - Myprotein 25 g Alternative:
Fesa di tacchino arrosto 80 g
Bresaola 70 g
Yogurt greco 0% bianco 200 g
Uova di gallina - albume 200 g
Pane di segale 2 Fette 60 g Alternative:
Gallette di riso 4 Fette 40 g
Pane azzimo 1 Panino 40 g
...Continua Spuntino Mattina
Frutta fresca (media) 200 g
Farina d'avena 4 Cucchiai 40 g
Frutta secca e oleosa (media) 15 g
PRANZO
Riso 3 Cucchiai 60 g Alternative:
Pasta di semola integrale 1 Piatto 70 g
Patate (media) 280 g
Petto di pollo 200 g Alternative:
Tacchino petto 200 g
Merluzzo o nasello 250 g
Verdure fresche (media) 150 g
Olio di oli 10 g va (media)
CENA
Riso 1 Piatto e 1/4 100 g Alternative:
Pasta di semola integrale 1 Piatto e 1/4 100 g
Patate (media) 300 g
...Continua Cena
Alternative:
Gnocchi 200 g
Cous Cous 90 g
Petto di pollo 200 g Alternative:
Tacchino petto 200 g
Verdure fresche (media) 150 g
Olio di oli 10 g va (media)
Giorno OFF
COLAZIONE
Uova di gallina - albume 200 g
Farina d'avena 5 Cucchiai 50 g
Burro d'arachidi 2 Cucchiaini 10 g
Consigli di base
Consigli di base
Bere almeno 2-3l di acqua naturale al giorno
Sgarro: consentito 1 volta ogni 2 settimane
`;

describe('PdfImportService', () => {
  let service: PdfImportService;

  beforeEach(() => {
    service = new PdfImportService();
  });

  it('riconosce entrambi i piani "Giorno ON" e "Giorno OFF"', () => {
    const diet = service.parseDietText(SAMPLE_TEXT);
    expect(diet.map(p => p.name)).toEqual(['Giorno ON', 'Giorno OFF']);
  });

  it('crea le combinazioni Base + Alternativa 1 + Alternativa 2 per la Colazione', () => {
    const diet = service.parseDietText(SAMPLE_TEXT);
    const colazione = diet[0].meals.find(m => m.name === 'Colazione')!;
    expect(colazione.combinations.map(c => c.label)).toEqual(['Base', 'Alternativa 1', 'Alternativa 2']);

    const base = colazione.combinations[0];
    expect(base.protein?.name).toBe("Uova di gallina - albume");
    expect(base.protein?.qty).toBe('200 g');
    expect(base.carb?.name).toBe("Farina d'avena");
    expect(base.carb?.qty).toBe('5 Cucchiai · 50 g');
    expect(base.fat?.name).toBe("Burro d'arachidi");
    expect(base.fat?.qty).toBe('2 Cucchiaini · 10 g');

    const alt1 = colazione.combinations[1];
    expect(alt1.carb?.name).toBe("Fiocchi d'avena");
    expect(alt1.carb?.alt?.map(a => a.name)).toEqual(['Riso soffiato', 'Fette biscottate integrali']);
    expect(alt1.fat?.name).toBe('Frutta secca e oleosa (media)');
    expect(alt1.fat?.alt?.map(a => a.name)).toEqual(['Semi di Chia']);

    const alt2 = colazione.combinations[2];
    expect(alt2.fat?.name).toBe('Uova di gallina (media)'); // uovo intero -> grassi
    expect(alt2.carb?.name).toBe('Pane tostato');
    expect(alt2.protein?.name).toBe("Uova di gallina - albume");
  });

  it("gestisce il marcatore 'Alternative:' unito sulla stessa riga dell'alimento", () => {
    const diet = service.parseDietText(SAMPLE_TEXT);
    const pranzo = diet[0].meals.find(m => m.name === 'Pranzo')!;
    const base = pranzo.combinations[0];
    expect(base.protein?.name).toBe('Petto di pollo');
    expect(base.protein?.alt?.map(a => a.name)).toEqual(['Tacchino petto', 'Merluzzo o nasello']);
  });

  it('accumula le alternative attraverso una interruzione di pagina ("...Continua")', () => {
    const diet = service.parseDietText(SAMPLE_TEXT);
    const spuntino = diet[0].meals.find(m => m.name === 'Spuntino Mattina')!;
    const base = spuntino.combinations[0];
    expect(base.carb?.name).toBe('Pane di segale');
    expect(base.carb?.alt?.map(a => a.name)).toEqual([
      'Gallette di riso', 'Pane azzimo', 'Frutta fresca (media)', "Farina d'avena"
    ]);
    // Il fat successivo (categoria diversa) non deve finire tra le alternative del carb
    expect(base.fat?.name).toBe('Frutta secca e oleosa (media)');
    expect(base.fat?.qty).toBe('15 g');
  });

  it('accumula le alternative anche quando "Alternative:" si ripete dopo "...Continua"', () => {
    const diet = service.parseDietText(SAMPLE_TEXT);
    const cena = diet[0].meals.find(m => m.name === 'Cena')!;
    const base = cena.combinations[0];
    expect(base.carb?.name).toBe('Riso');
    expect(base.carb?.alt?.map(a => a.name)).toEqual([
      'Pasta di semola integrale', 'Patate (media)', 'Gnocchi', 'Cous Cous'
    ]);
  });

  it('corregge il glitch di estrazione "Olio di oli ... va (media)" e lo assegna ai grassi', () => {
    const diet = service.parseDietText(SAMPLE_TEXT);
    const pranzo = diet[0].meals.find(m => m.name === 'Pranzo')!;
    const base = pranzo.combinations[0];
    expect(base.fat?.name).toBe('Olio di oliva (media)');
    expect(base.fat?.qty).toBe('10 g');
  });

  it('non inserisce "Verdure fresche" in nessuno slot macro', () => {
    const diet = service.parseDietText(SAMPLE_TEXT);
    const pranzo = diet[0].meals.find(m => m.name === 'Pranzo')!;
    const values = pranzo.combinations.flatMap(c => [c.carb, c.protein, c.fat]);
    expect(values.some(v => v?.name.toLowerCase().includes('verdur'))).toBe(false);
  });

  it('estrae le verdure e i consigli di base come note libere', () => {
    const notes = service.extractDietNotes(SAMPLE_TEXT);
    expect(notes).toContain('Verdure fresche libere');
    expect(notes).toContain('150 g');
    expect(notes).toContain('Consigli di base:');
    expect(notes).toContain('Bere almeno 2-3l di acqua naturale al giorno');
    expect(notes).toContain('Sgarro: consentito 1 volta ogni 2 settimane');
  });

  it('ripiega sul parser generico per un testo che non segue il template "Giorno X"', () => {
    const genericText = `Colazione\nAvena 50 g\nPranzo\nPollo 200 g`;
    const diet = service.parseDietText(genericText);
    expect(diet.length).toBe(1);
    expect(diet[0].meals.map(m => m.name)).toEqual(['Colazione', 'Pranzo']);
  });
});

// Testo ricostruito riga per riga come lo produrrebbe extractText() a partire dal PDF
// "ANDREA_CARFORA_SCHEDA" (template "DURATA N SETTIMANE" / "DAY N: Gruppo REC TRA X-Y" /
// "EX.N/Nome" + riga schema). Include i casi limite osservati nel PDF reale: progressione
// wave su 8 settimane, schemi a range ("10/12"), sequenze per-set ("12-10-8"), bodyweight
// ("MAX"), isometria ("2'"), drop-set con nota libera, schema a piu' segmenti ("2x8 1x20")
// e reps bilaterali ("12+12").
const SCHEDA_TEXT = `
DURATA 8 SETTIMANE
DAY 1 : PETTO-SPALLE-TRICIPITI REC TRA 60-90”
EX.1/SPINTE MANUBRI PANCA PIANA
4X10 4X10 4X8 4X8 5X6 5X6… E RIPRENDI DA 4X10 AUMENTANDO IL CARICO RISPETTO ALL SETT.1 SCORSA
EX.2/DIPS MACHINE/PARALLELE
4X10 4X10 4X8 4X8 5X6 5X6… E RIPRENDI DA 4X10 AUMENTANDO IL CARICO RISPETTO ALL SETT.1 SCORSA
EX.3/CHEST PRESS
3X12-10-8
EX.4/ALZATE LATERALI MANUBRI IN PIEDI
4X10 4X10 4X8 4X8 5X6 5X6… E RIPRENDI DA 4X10 AUMENTANDO IL CARICO RISPETTO ALL SETT.1 SCORSA
EX.5/ALZATE MANUBRI CON PETTO SU PANCA A 45
3X10/12
EX.6/FRENCH PRESS MANUBRI SDRAITO
4X10 4X10 4X8 4X8 5X6 5X6… E RIPRENDI DA 4X10 AUMENTANDO IL CARICO RISPETTO ALL SETT.1 SCORSA
EX.7/PUSH DOWN GIRATO DI SCHIENA AL PACCO PESI
3X8/12
EX.8/FLESSIONI DEL BUSTO AL CAVO OPPURE ALLA LAT MACHINE
4X12/15
EX.9/INVERSI SU PANCA
3XMAX
DAY 2: DORSO-DELT.POST-BICIPITI REC TRA 60-90”
EX.1/LAT MACHINE AVANTI
5X8
EX.2/T BAR
4X10 4X10 4X8 4X8 5X6 5X6… E RIPRENDI DA 4X10 AUMENTANDO IL CARICO RISPETTO ALL SETT.1 SCORSA
EX.3/REMATORE MANUBRIO
4X10 4X10 4X8 4X8 5X6 5X6… E RIPRENDI DA 4X10 AUMENTANDO IL CARICO RISPETTO ALL SETT.1 SCORSA
EX.4/LAT INVERSA
4X10/12
EX.5/CROCI AI CAVI INCROCIATI
3X12/15
EX.5/CURL BILANCIERE
4X10 4X10 4X8 4X8 5X6 5X6… E RIPRENDI DA 4X10 AUMENTANDO IL CARICO RISPETTO ALL SETT.1 SCORSA
EX.6/CURL MANUBRI A MARTELLO
4X10+ ULTIMA IN STRIP MENO DEL 30%
EX.7/CRUNCH SU FITBALL
3X2’
EX.8/GINOCCHIA AL PETTO DA SEDUTO
3XMAX
DAY 3: GAMBE REC TRA 60-90”
EX.1/SQUAT AL M.POWER
4X10 4X10 4X8 4X8 5X6 5X6… E RIPRENDI DA 4X10 AUMENTANDO IL CARICO RISPETTO ALL SETT.1 SCORSA
EX.2/LEG PRESS 45°
4X8/12
EX.3/SPLIT SQUAT AL M.POWER
3X12/15 con fermo in basso di 2”
EX.4/LEG EXTENSION UNILATERALE
2x8 1x20
EX.5/LEG CURL IN PIEDI
4x8/12
EX.6/HIP THRUST CON BILANCIERE+AFFONDI CAMMINANDO
3X12+12
`;

describe('PdfImportService - scheda allenamento', () => {
  let service: PdfImportService;

  beforeEach(() => {
    service = new PdfImportService();
  });

  it('rileva la durata del programma dichiarata nel PDF', () => {
    expect(service.detectProgramDurationWeeks(SCHEDA_TEXT)).toBe(8);
    expect(service.detectProgramDurationWeeks('nessuna durata qui')).toBe(8); // default
  });

  it('riconosce i 3 giorni con label e recupero', () => {
    const days = service.parseWorkoutText(SCHEDA_TEXT);
    expect(days.length).toBe(3);
    expect(days.map(d => d.label)).toEqual(['Petto-Spalle-Tricipiti', 'Dorso-Delt.post-Bicipiti', 'Gambe']);
    expect(days.every(d => d.rec === '60-90"')).toBe(true);
  });

  it('costruisce una progressione wave su 8 settimane che ricomincia dal ciclo iniziale', () => {
    const days = service.parseWorkoutText(SCHEDA_TEXT);
    const ex1 = days[0].ex[0];
    expect(ex1.name).toBe('SPINTE MANUBRI PANCA PIANA');
    expect(ex1.scheme).toBe('wave');
    expect(ex1.weekPlan?.length).toBe(8);
    expect(ex1.weekPlan).toEqual([
      { sets: 4, reps: 10 }, { sets: 4, reps: 10 },
      { sets: 4, reps: 8 }, { sets: 4, reps: 8 },
      { sets: 5, reps: 6 }, { sets: 5, reps: 6 },
      { sets: 4, reps: 10 }, { sets: 4, reps: 10 } // settimane 7-8: "riprendi da 4x10"
    ]);
    expect(ex1.muscle).toBe('Petto');
  });

  it('interpreta gli schemi semplici (sequenza per-set, range, bodyweight, isometria)', () => {
    const days = service.parseWorkoutText(SCHEDA_TEXT);
    const day1ByName = (n: string) => days[0].ex.find(e => e.name === n)!;

    const chestPress = day1ByName('CHEST PRESS');
    expect(chestPress.scheme).toBe('plain');
    expect(chestPress.sets).toBe(3);
    expect(chestPress.reps).toEqual(['12', '10', '8']); // sequenza per-set

    const alzate45 = day1ByName('ALZATE MANUBRI CON PETTO SU PANCA A 45');
    expect(alzate45.sets).toBe(3);
    expect(alzate45.reps).toEqual(['10/12', '10/12', '10/12']); // range uniforme

    const inversi = day1ByName('INVERSI SU PANCA');
    expect(inversi.reps).toEqual(['MAX', 'MAX', 'MAX']);

    const day2ByName = (n: string) => days[1].ex.find(e => e.name === n)!;
    const crunch = day2ByName('CRUNCH SU FITBALL');
    expect(crunch.sets).toBe(3);
    expect(crunch.reps).toEqual(['2’', '2’', '2’']); // isometria
  });

  it('separa la nota libera (drop-set, tempo di recupero) dallo schema serie/ripetizioni', () => {
    const days = service.parseWorkoutText(SCHEDA_TEXT);
    const curlMartello = days[1].ex.find(e => e.name === 'CURL MANUBRI A MARTELLO')!;
    expect(curlMartello.sets).toBe(4);
    expect(curlMartello.reps).toEqual(['10', '10', '10', '10']);
    expect(curlMartello.note).toContain('ULTIMA IN STRIP MENO DEL 30%');

    const splitSquat = days[2].ex.find(e => e.name === 'SPLIT SQUAT AL M.POWER')!;
    expect(splitSquat.reps).toEqual(['12/15', '12/15', '12/15']);
    expect(splitSquat.note).toContain('fermo in basso di 2');
  });

  it('somma gli schemi a piu\' segmenti sulla stessa riga ("2x8 1x20")', () => {
    const days = service.parseWorkoutText(SCHEDA_TEXT);
    const legExt = days[2].ex.find(e => e.name === 'LEG EXTENSION UNILATERALE')!;
    expect(legExt.scheme).toBe('plain');
    expect(legExt.sets).toBe(3);
    expect(legExt.reps).toEqual(['8', '8', '20']);
  });

  it('mantiene le reps bilaterali ("12+12") come descrittore unico per set', () => {
    const days = service.parseWorkoutText(SCHEDA_TEXT);
    const hipThrust = days[2].ex.find(e => e.name.startsWith('HIP THRUST'))!;
    expect(hipThrust.sets).toBe(3);
    expect(hipThrust.reps).toEqual(['12+12', '12+12', '12+12']);
  });

  it('categorizza il gruppo muscolare dal nome esercizio, con fallback al giorno', () => {
    const days = service.parseWorkoutText(SCHEDA_TEXT);
    const byName = (dayIdx: number, n: string) => days[dayIdx].ex.find(e => e.name === n)!;

    expect(byName(0, 'DIPS MACHINE/PARALLELE').muscle).toBe('Tricipiti');
    expect(byName(0, 'ALZATE LATERALI MANUBRI IN PIEDI').muscle).toBe('Spalle');
    expect(byName(0, 'FLESSIONI DEL BUSTO AL CAVO OPPURE ALLA LAT MACHINE').muscle).toBe('Core'); // non Dorso, nonostante "LAT MACHINE"
    expect(byName(0, 'INVERSI SU PANCA').muscle).toBe('Core'); // non Petto, nonostante "PANCA"
    expect(byName(1, 'GINOCCHIA AL PETTO DA SEDUTO').muscle).toBe('Core'); // non Petto
    expect(byName(1, 'CROCI AI CAVI INCROCIATI').muscle).toBe('Petto');
    expect(byName(2, 'LEG CURL IN PIEDI').muscle).toBe('Gambe'); // non Bicipiti, nonostante "CURL"
  });

  it('ripiega sul parser generico per un testo che non segue il template "DAY N / EX.N"', () => {
    const genericText = `Giorno 1\nPanca piana 4x10\nSquat 3x8`;
    const days = service.parseWorkoutText(genericText);
    expect(days.length).toBe(1);
    expect(days[0].ex.map(e => e.name)).toEqual(['Panca piana', 'Squat']);
  });
});
