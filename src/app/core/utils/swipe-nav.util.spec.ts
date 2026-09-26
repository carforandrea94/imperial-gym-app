import {
  swipeDirection, nextTab, startsOnBlocker,
  SWIPE_MIN_X, SWIPE_MAX_MS
} from './swipe-nav.util';

const TAB = ['/scheda', '/dieta', '/corsa', '/misure', '/account'];

describe('swipeDirection', () => {
  it('a sinistra si va avanti', () => {
    expect(swipeDirection(-120, 10, 200)).toBe('next');
  });

  it('a destra si torna indietro', () => {
    expect(swipeDirection(120, -10, 200)).toBe('prev');
  });

  it('troppo corta non e\' una passata', () => {
    expect(swipeDirection(-(SWIPE_MIN_X - 1), 0, 200)).toBeNull();
  });

  it('alla misura minima lo e\'', () => {
    expect(swipeDirection(-SWIPE_MIN_X, 0, 200)).toBe('next');
  });

  /* Se pende troppo e' la pagina che si sta scorrendo, e interromperla per
     cambiare sezione sarebbe un agguato. */
  it('troppo pendente e\' uno scorrimento, non una passata', () => {
    expect(swipeDirection(-120, 80, 200)).toBeNull();
  });

  it('al limite della pendenza passa ancora', () => {
    expect(swipeDirection(-120, 60, 200)).toBe('next');
  });

  it('troppo lenta e\' un trascinamento', () => {
    expect(swipeDirection(-200, 0, SWIPE_MAX_MS + 1)).toBeNull();
  });

  it('un dito fermo non decide niente', () => {
    expect(swipeDirection(0, 0, 100)).toBeNull();
  });
});

describe('nextTab', () => {
  it('avanti e indietro di una', () => {
    expect(nextTab(TAB, '/corsa', 'next')).toBe('/misure');
    expect(nextTab(TAB, '/corsa', 'prev')).toBe('/dieta');
  });

  // Girare dall'ultima alla prima farebbe attraversare l'app con un gesto.
  it('alla prima non si torna indietro', () => {
    expect(nextTab(TAB, '/scheda', 'prev')).toBeNull();
  });

  it('all\'ultima non si va avanti', () => {
    expect(nextTab(TAB, '/account', 'next')).toBeNull();
  });

  it('senza direzione non si va da nessuna parte', () => {
    expect(nextTab(TAB, '/corsa', null)).toBeNull();
  });

  it('da una scheda che non e\' nell\'elenco non si muove', () => {
    expect(nextTab(TAB, '/boh', 'next')).toBeNull();
  });
});

describe('startsOnBlocker', () => {
  function dentro(html: string, sel: string): Element {
    const host = document.createElement('div');
    host.innerHTML = html;
    return host.querySelector(sel)!;
  }

  it('dentro uno slider orizzontale il gesto e\' di qualcun altro', () => {
    expect(startsOnBlocker(dentro('<div class="exslider"><span id="x"></span></div>', '#x'))).toBe(true);
  });

  it('dentro la ruota pure', () => {
    expect(startsOnBlocker(dentro('<div class="wheel"><span id="x"></span></div>', '#x'))).toBe(true);
  });

  it('sopra un campo di testo pure', () => {
    expect(startsOnBlocker(dentro('<input id="x">', '#x'))).toBe(true);
  });

  it('su una card qualsiasi no', () => {
    expect(startsOnBlocker(dentro('<div class="ex"><span id="x"></span></div>', '#x'))).toBe(false);
  });

  it('senza bersaglio no', () => {
    expect(startsOnBlocker(null)).toBe(false);
  });
});
