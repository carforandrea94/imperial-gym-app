import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SwipeTabsDirective } from './swipe-tabs.directive';

/**
 * Qui si prova il collegamento, non la regola: che gli ascoltatori ci siano,
 * che le guardie fermino il gesto e che si navighi davvero. La decisione su
 * cosa sia una passata sta in swipe-nav.util, provata a parte.
 */
@Component({
  standalone: true,
  imports: [SwipeTabsDirective],
  template: `<div [appSwipeTabs]="tabs" [swipeEnabled]="abilitato">
    <span id="libero"></span>
    <div class="exslider"><span id="dentro-slider"></span></div>
    <div class="wheel"><span id="dentro-ruota"></span></div>
    <div class="bottomsheet"><div class="wheel"><span id="ruota-nel-foglio"></span></div></div>
  </div>`
})
class Host {
  tabs = ['/scheda', '/dieta', '/corsa'];
  abilitato = true;
}

const TAB = ['/scheda', '/dieta', '/corsa'];

function tocco(tipo: string, x: number, y: number, target: Element): Event {
  const e = new Event(tipo, { bubbles: true });
  const punto = { clientX: x, clientY: y };
  Object.assign(e, { touches: tipo === 'touchend' ? [] : [punto], changedTouches: [punto] });
  Object.defineProperty(e, 'target', { value: target });
  return e;
}

describe('SwipeTabsDirective', () => {
  let navigate: ReturnType<typeof vi.fn>;
  let url = '/dieta';

  function monta(opts: { abilitato?: boolean } = {}) {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.abilitato = opts.abilitato ?? true;
    fixture.detectChanges();
    const zona = fixture.nativeElement.querySelector('div') as HTMLElement;
    return { fixture, zona };
  }

  /** Simula una passata: parte da `da`, arriva a `a`, in `ms`. */
  function passata(zona: HTMLElement, target: Element, da: number, a: number, dy = 0, ms = 150) {
    zona.dispatchEvent(tocco('touchstart', da, 100, target));
    const orig = Date.now;
    Date.now = () => orig() + ms;
    zona.dispatchEvent(tocco('touchend', a, 100 + dy, target));
    Date.now = orig;
  }

  beforeEach(() => {
    navigate = vi.fn();
    url = '/dieta';
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [{ provide: Router, useValue: { navigate, get url() { return url; } } }]
    });
  });

  it('a sinistra porta alla scheda dopo', () => {
    const { zona } = monta();
    passata(zona, zona.querySelector('#libero')!, 300, 150);
    expect(navigate).toHaveBeenCalledWith(['/corsa']);
  });

  it('a destra a quella prima', () => {
    const { zona } = monta();
    passata(zona, zona.querySelector('#libero')!, 150, 300);
    expect(navigate).toHaveBeenCalledWith(['/scheda']);
  });

  /* Dentro un elenco che scorre di lato il gesto e' gia' di qualcun altro. */
  it('dentro uno slider orizzontale non fa niente', () => {
    const { zona } = monta();
    passata(zona, zona.querySelector('#dentro-slider')!, 300, 150);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('con la barra nascosta non fa niente', () => {
    const { zona } = monta({ abilitato: false });
    passata(zona, zona.querySelector('#libero')!, 300, 150);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('uno scorrimento in diagonale resta uno scorrimento', () => {
    const { zona } = monta();
    passata(zona, zona.querySelector('#libero')!, 300, 150, 120);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('all\'ultima scheda non si va oltre', () => {
    url = '/corsa';
    const { zona } = monta();
    passata(zona, zona.querySelector('#libero')!, 300, 150);
    expect(navigate).not.toHaveBeenCalled();
  });

  // /scheda/day/2 e' sempre la scheda: la passata parte da li'.
  it('vale anche dentro una pagina figlia', () => {
    url = '/scheda/day/2';
    const { zona } = monta();
    passata(zona, zona.querySelector('#libero')!, 300, 150);
    expect(navigate).toHaveBeenCalledWith(['/dieta']);
  });

  it('su un indirizzo fuori dalle schede non si muove', () => {
    url = '/impostazioni';
    const { zona } = monta();
    passata(zona, zona.querySelector('#libero')!, 300, 150);
    expect(navigate).not.toHaveBeenCalled();
  });

  /**
   * Da quando carico e ripetizioni si scelgono con la ruota, ogni serie
   * aperta ne ha due larghe in mezzo allo schermo. Finche' la ruota era fra i
   * blocchi, il pollice partiva quasi sempre da li' e la passata fra le
   * sezioni non partiva mai.
   */
  it('una passata che parte dalla ruota di una serie cambia sezione', () => {
    const { zona } = monta();
    passata(zona, zona.querySelector('#dentro-ruota')!, 300, 150);
    expect(navigate).toHaveBeenCalledWith(['/corsa']);
  });

  it('ma dentro un foglio aperto no, ruota compresa', () => {
    const { zona } = monta();
    passata(zona, zona.querySelector('#ruota-nel-foglio')!, 300, 150);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('girare la ruota non cambia sezione: il gesto e\' verticale', () => {
    const { zona } = monta();
    passata(zona, zona.querySelector('#dentro-ruota')!, 300, 280, 90);
    expect(navigate).not.toHaveBeenCalled();
  });
});