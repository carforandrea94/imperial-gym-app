import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, AfterViewInit, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.component.html'
})
export class NavbarComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() showBack = false;
  @Input() showHistory = false;
  @Input() showInfo = false;
  @Input() showAnalytics = false;
  @Input() showShoppingList = false;
  @Input() showViewToggle = false;
  @Input() viewMode: 'list' | 'slider' = 'list';
  @Input() showSettings = false;
  @Input() showSaveEdit = false;
  @Input() saveEditSaving = false;
  @Input() showProtocolSave = false;
  @Input() protocolSaving = false;
  @Input() showSaveMeasure = false;
  @Input() measureSaving = false;

  @Output() backClick = new EventEmitter<void>();
  @Output() historyClick = new EventEmitter<void>();
  @Output() infoClick = new EventEmitter<void>();
  @Output() analyticsClick = new EventEmitter<void>();
  @Output() shoppingListClick = new EventEmitter<void>();
  @Output() viewModeChange = new EventEmitter<'list' | 'slider'>();
  @Output() settingsClick = new EventEmitter<void>();
  @Output() saveEditClick = new EventEmitter<void>();
  @Output() saveDraftClick = new EventEmitter<void>();
  @Output() saveActivateClick = new EventEmitter<void>();
  @Output() saveMeasureClick = new EventEmitter<void>();

  private resizeObserver: ResizeObserver | null = null;

  constructor(private host: ElementRef<HTMLElement>) {}

  ngOnInit(): void {
    // `html, body { height: 100% }` fa del BODY il contenitore che scorre: e'
    // li' che arriva l'evento, mentre window.scrollY resta inchiodato a 0.
    // Restano in ascolto entrambi perche' la stessa app, in un contesto dove a
    // scorrere e' il documento, deve continuare a funzionare.
    document.body.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('scroll', this.onScroll, { passive: true });
  }

  /**
   * Pubblica l'altezza REALE della navbar in due variabili CSS, invece di
   * lasciare che il resto del layout la indovini con un numero fisso:
   *
   * --nav-h-now   altezza corrente, anche quando la navbar si rimpicciolisce
   *               allo scroll. La usa chi deve fermarsi appena sotto (la barra
   *               sessione sticky), cosi' non ci finisce mai sotto ne' troppo
   *               staccata.
   * --nav-h-rest  altezza a riposo, aggiornata solo quando la pagina NON e'
   *               scrollata. La usa lo spazio in cima al contenuto: se seguisse
   *               l'altezza corrente, scorrendo il contenuto scatterebbe verso
   *               l'alto mentre l'utente sta gia' scorrendo.
   */
  ngAfterViewInit(): void {
    const el = this.host.nativeElement.querySelector('.navbar') as HTMLElement | null;
    if (!el || typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => this.publishHeight(el));
    this.resizeObserver.observe(el);
    this.publishHeight(el);
  }

  ngOnDestroy(): void {
    document.body.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('scroll', this.onScroll);
    this.resizeObserver?.disconnect();
    // Senza navbar le variabili non descrivono piu' niente: tornano i default
    // del foglio di stile invece di restare congelate sull'ultimo valore.
    document.documentElement.style.removeProperty('--nav-h-now');
    document.documentElement.style.removeProperty('--nav-h-rest');
  }

  private publishHeight(el: HTMLElement): void {
    const h = `${Math.round(el.getBoundingClientRect().height)}px`;
    const root = document.documentElement;
    root.style.setProperty('--nav-h-now', h);
    if (!document.body.classList.contains('scrolled')) {
      root.style.setProperty('--nav-h-rest', h);
    }
  }

  private onScroll = (): void => {
    const scrolled = document.body.scrollTop || window.scrollY || 0;
    if (scrolled > 10) {
      document.body.classList.add('scrolled');
    } else {
      document.body.classList.remove('scrolled');
    }
  };
}
