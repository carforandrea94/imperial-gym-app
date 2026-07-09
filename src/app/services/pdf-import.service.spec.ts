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
