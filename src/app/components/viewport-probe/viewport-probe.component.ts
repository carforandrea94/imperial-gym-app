import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * TEMPORANEO — da togliere appena la domanda ha una risposta.
 *
 * La tabbar e' una regola sola, position:fixed con bottom:var(--tabbar-gap),
 * eppure sul telefono finisce a 81px dal fondo in Scheda e a 22 in Corsa
 * (misurati sugli screenshot: pillola alta 60,1px in entrambe, contenuto in
 * cima identico al pixel). Due tentativi alla cieca - prima un tetto
 * all'inset, poi la distanza scritta a mano - non hanno spostato niente, e
 * in un container non si riproduce: li' non c'e' ne' un'area sicura vera ne'
 * la barra del browser. I numeri li deve dire il telefono.
 *
 * La versione precedente si accendeva con localStorage.setItem('diag','1'),
 * che su un iPhone in standalone vuol dire collegarlo a un Mac: per questo
 * non e' mai stata accesa. Questa si vede e basta.
 *
 * Cosa dicono i numeri:
 * - schermo vs finestra: se non coincidono, la pagina vive in una finestra
 *   piu' corta dello schermo, e un elemento fisso "a 22px dal fondo" finisce
 *   piu' in alto di 22px dal bordo vero. E' l'ipotesi principale.
 * - inset: il valore grezzo che il sistema riporta, risolto in pixel.
 * - bottom: quanto vale davvero la regola applicata alla barra.
 * - fondo: dove la barra finisce per davvero dentro la finestra.
 */
@Component({
  selector: 'app-viewport-probe',
  standalone: true,
  imports: [CommonModule],
  template: `
<div class="diagbox">
  <b>SONDA · {{ sezione }}</b>
  <span>schermo {{ screenH }} · finestra {{ innerH }} · doc {{ clientH }}</span>
  <span>visualViewport {{ vvH }} · top {{ vvTop }}</span>
  <span>inset {{ insetRisolto }} · --safe-b {{ safeB }} · --gap {{ gap }}</span>
  <span>bottom applicato {{ bottomApplicato }}</span>
  <span>fondo pillola {{ fondoPillola }} dalla finestra</span>
  <span>scroll {{ scrollY }} di {{ scrollH }}</span>
</div>
<!-- Legge l'inset grezzo: su una proprieta' vera il browser lo risolve in
     pixel, su una custom property no. -->
<div class="diagprobe" aria-hidden="true"></div>`,
  styles: [`
    .diagbox{position:fixed;left:8px;right:8px;bottom:96px;z-index:200;
      display:flex;flex-direction:column;gap:1px;
      padding:8px 10px;border-radius:8px;
      background:rgba(255,0,170,.92);color:#fff;
      font-family:'IBM Plex Mono',monospace;font-size:10px;line-height:1.4;}
    .diagbox b{font-size:11px;letter-spacing:.08em;}
    .diagprobe{position:fixed;left:-9999px;bottom:0;width:1px;height:1px;
      padding-bottom:env(safe-area-inset-bottom, 0px);}
  `]
})
export class ViewportProbeComponent implements OnInit, OnDestroy {
  sezione = '';
  screenH = 0;
  innerH = 0;
  clientH = 0;
  vvH = 0;
  vvTop = 0;
  scrollH = 0;
  scrollY = 0;
  insetRisolto = '';
  safeB = '';
  gap = '';
  bottomApplicato = '';
  fondoPillola = '';

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.aggiorna();
    // Il viewport su iOS si assesta dopo il primo fotogramma: una lettura
    // sola, fatta troppo presto, direbbe i numeri del caricamento.
    setTimeout(this.aggiorna, 300);
    setTimeout(this.aggiorna, 1200);
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
    const barra = document.querySelector('.tabbar') ?? document.querySelector('.restbar');
    const r = barra?.getBoundingClientRect();
    const sonda = document.querySelector('.diagprobe');

    this.sezione = location.pathname;
    this.screenH = Math.round(window.screen?.height ?? 0);
    this.innerH = Math.round(window.innerHeight);
    this.clientH = Math.round(document.documentElement.clientHeight);
    this.vvH = vv ? Math.round(vv.height) : -1;
    this.vvTop = vv ? Math.round(vv.offsetTop) : -1;
    this.scrollH = Math.round(document.scrollingElement?.scrollHeight ?? 0);
    this.scrollY = Math.round(window.scrollY || document.scrollingElement?.scrollTop || 0);
    this.insetRisolto = sonda ? getComputedStyle(sonda).paddingBottom : '—';
    this.safeB = root.getPropertyValue('--safe-b').trim();
    this.gap = root.getPropertyValue('--tabbar-gap').trim();
    this.bottomApplicato = barra ? getComputedStyle(barra).bottom : '—';
    this.fondoPillola = r ? `${Math.round(window.innerHeight - r.bottom)}px` : '—';

    this.cdr.detectChanges();
  };
}
