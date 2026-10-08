import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Un misuratore del viewport, per capire perche' la tabbar si appoggia a
 * altezze diverse fra una sezione e l'altra.
 *
 * Il problema: la barra in basso e' una sola regola - position:fixed con
 * bottom:var(--tabbar-gap) - eppure sul telefono finisce a 74,5px dal fondo
 * in Scheda e a 20,5 in Corsa. Venti e mezzo e' il valore di progetto. Gli
 * altri 54 non si spiegano dal foglio di stile, e in un container non si
 * riproducono: li' non c'e' ne' la barra dinamica di Safari ne' un'area
 * sicura vera. Quindi i numeri li deve dire il telefono.
 *
 * Non compare a nessuno se non lo si accende: serve scrivere
 *   localStorage.setItem('diag', '1')
 * e ricaricare. Si spegne togliendo la chiave. E' roba da buttare appena la
 * domanda ha una risposta.
 */
@Component({
  selector: 'app-viewport-probe',
  standalone: true,
  imports: [CommonModule],
  template: `
<div class="diagbox" *ngIf="acceso">
  <b>{{ sezione }}</b>
  <span>innerHeight {{ innerH }}</span>
  <span>visualViewport {{ vvH }} &nbsp;top {{ vvTop }}</span>
  <span>scrollHeight {{ scrollH }} &nbsp;scrollY {{ scrollY }}</span>
  <span>safe-area-bottom {{ safeB }}</span>
  <span>tabbar-gap {{ gap }}</span>
  <span>fondo pillola {{ fondoPillola }} dal bordo</span>
</div>`,
  styles: [`
    .diagbox{position:fixed;left:8px;right:8px;bottom:96px;z-index:200;
      display:flex;flex-direction:column;gap:1px;
      padding:8px 10px;border-radius:8px;
      background:rgba(255,0,170,.92);color:#fff;
      font-family:'IBM Plex Mono',monospace;font-size:10px;line-height:1.35;}
    .diagbox b{font-size:11px;letter-spacing:.08em;text-transform:uppercase;}
  `]
})
export class ViewportProbeComponent implements OnInit, OnDestroy {
  acceso = false;
  sezione = '';
  innerH = 0;
  vvH = 0;
  vvTop = 0;
  scrollH = 0;
  scrollY = 0;
  safeB = '';
  gap = '';
  fondoPillola = '';

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    try {
      this.acceso = localStorage.getItem('diag') === '1';
    } catch {
      this.acceso = false;
    }
    if (!this.acceso) return;

    this.aggiorna();
    window.addEventListener('resize', this.aggiorna, { passive: true });
    window.addEventListener('scroll', this.aggiorna, { passive: true });
    window.visualViewport?.addEventListener('resize', this.aggiorna);
    window.visualViewport?.addEventListener('scroll', this.aggiorna);
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.aggiorna);
    window.removeEventListener('scroll', this.aggiorna);
    window.visualViewport?.removeEventListener('resize', this.aggiorna);
    window.visualViewport?.removeEventListener('scroll', this.aggiorna);
  }

  private aggiorna = (): void => {
    const vv = window.visualViewport;
    const root = getComputedStyle(document.documentElement);
    const barra = document.querySelector('.tabbar');
    const r = barra?.getBoundingClientRect();

    this.sezione = location.pathname;
    this.innerH = Math.round(window.innerHeight);
    this.vvH = vv ? Math.round(vv.height) : -1;
    this.vvTop = vv ? Math.round(vv.offsetTop) : -1;
    this.scrollH = Math.round(document.scrollingElement?.scrollHeight ?? 0);
    this.scrollY = Math.round(window.scrollY || document.scrollingElement?.scrollTop || 0);
    this.safeB = root.getPropertyValue('--safe-b').trim();
    this.gap = root.getPropertyValue('--tabbar-gap').trim();
    this.fondoPillola = r ? `${Math.round(window.innerHeight - r.bottom)}px` : '—';

    this.cdr.detectChanges();
  };
}
