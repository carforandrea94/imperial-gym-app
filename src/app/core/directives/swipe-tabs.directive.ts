import { Directive, ElementRef, Input, NgZone, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { swipeDirection, nextTab, startsOnBlocker } from '../utils/swipe-nav.util';

/**
 * Passare da una scheda all'altra con una passata del pollice.
 *
 * Vale solo dove la tabbar c'e' davvero: dentro un allenamento la barra in
 * fondo e' il recupero, non le schede, e un gesto che cambiasse sezione
 * porterebbe via da una sessione aperta.
 *
 * Gli ascoltatori stanno fuori da Angular: un touchmove passa decine di volte
 * al secondo e non deve far girare il rilevamento delle modifiche per niente.
 * Si rientra solo per navigare davvero.
 */
@Directive({
  selector: '[appSwipeTabs]',
  standalone: true
})
export class SwipeTabsDirective implements OnInit, OnDestroy {

  /** Le schede in ordine, come le si vede nella barra. */
  @Input('appSwipeTabs') tabs: readonly string[] = [];

  /** La barra c'e' ed e' quella delle schede. */
  @Input() swipeEnabled = false;

  private x = 0;
  private y = 0;
  private at = 0;
  /** null = questa passata non conta (e' partita male, o e' a piu' dita). */
  private valida = false;

  constructor(
    private host: ElementRef<HTMLElement>,
    private router: Router,
    private zone: NgZone
  ) {}

  ngOnInit(): void {
    this.zone.runOutsideAngular(() => {
      const el = this.host.nativeElement;
      el.addEventListener('touchstart', this.onStart, { passive: true });
      el.addEventListener('touchend', this.onEnd, { passive: true });
      el.addEventListener('touchcancel', this.onCancel, { passive: true });
    });
  }

  ngOnDestroy(): void {
    const el = this.host.nativeElement;
    el.removeEventListener('touchstart', this.onStart);
    el.removeEventListener('touchend', this.onEnd);
    el.removeEventListener('touchcancel', this.onCancel);
  }

  private onStart = (e: TouchEvent): void => {
    // Due dita sono una pinza, non una passata.
    this.valida = this.swipeEnabled && e.touches.length === 1 && !startsOnBlocker(e.target);
    if (!this.valida) return;
    const t = e.touches[0];
    this.x = t.clientX;
    this.y = t.clientY;
    this.at = Date.now();
  };

  private onCancel = (): void => { this.valida = false; };

  private onEnd = (e: TouchEvent): void => {
    if (!this.valida) return;
    this.valida = false;
    // Durante la passata la tabbar puo' essere sparita (una sessione avviata
    // da un'altra scheda): la condizione si rilegge alla fine, non all'inizio.
    if (!this.swipeEnabled) return;

    const t = e.changedTouches[0];
    if (!t) return;
    const dir = swipeDirection(t.clientX - this.x, t.clientY - this.y, Date.now() - this.at);
    const dove = nextTab(this.tabs, this.tabCorrente(), dir);
    if (!dove) return;

    this.zone.run(() => this.router.navigate([dove]));
  };

  /** La scheda su cui si e' adesso: la prima dell'elenco che apre l'indirizzo.
   *  Vale anche dentro una pagina figlia (/scheda/day/2 e' sempre /scheda). */
  private tabCorrente(): string {
    const url = this.router.url;
    return this.tabs.find(t => url === t || url.startsWith(t + '/')) ?? '';
  }
}
