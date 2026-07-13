import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd, RouterOutlet } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { NavbarComponent } from './components/navbar/navbar.component';
import { TabbarComponent } from './components/tabbar/tabbar.component';
import { RestTimerComponent } from './components/rest-timer/rest-timer.component';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { WorkoutDataService } from './services/workout-data.service';
import { WorkoutStateService } from './services/workout-state.service';
import { DietStateService } from './services/diet-state.service';
import { AuthService } from './core/services/auth.service';
import { CATEGORY_LABELS, MeasureCategory } from './models/measurement.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent, TabbarComponent, RestTimerComponent, ConfirmDialogComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  navTitle = 'Scheda';
  navSubtitle = '';
  showBack = false;
  showHistory = false;
  showInfo = false;
  showAnalytics = false;
  showShoppingList = false;
  showViewToggle = false;
  viewToggleTarget: 'scheda' | 'dieta' = 'scheda';
  showSaveWorkout = false;
  showSettings = false;
  showChrome = false;

  private routeSub: Subscription | null = null;

  constructor(
    private router: Router,
    private workoutData: WorkoutDataService,
    public workoutState: WorkoutStateService,
    public dietState: DietStateService,
    public auth: AuthService,
    private swUpdate: SwUpdate
  ) {}

  ngOnInit(): void {
    this.setupAutoUpdate();
    this.routeSub = this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e) => {
      const nav = e as NavigationEnd;
      this.updateNav(nav.urlAfterRedirects || nav.url);
    });
    // Init on load
    this.updateNav(this.router.url);
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  /**
   * Se il service worker rileva una nuova versione deployata, la attiva e
   * ricarica la pagina in automatico: evita che l'utente resti bloccato su
   * codice vecchio in cache aspettando il normale ciclo "serve due refresh".
   */
  private setupAutoUpdate(): void {
    if (!this.swUpdate.isEnabled) return;

    this.swUpdate.versionUpdates
      .pipe(filter((evt): evt is any => evt.type === 'VERSION_READY'))
      .subscribe(() => {
        this.swUpdate.activateUpdate().then(() => window.location.reload());
      });

    this.swUpdate.checkForUpdate().catch(() => { /* offline o check fallito, ignora */ });

    // Rete di sicurezza: se per qualsiasi motivo risultano registrazioni SW
    // multiple/orfane per questa origine, le ripulisce cosi' non restano
    // versioni vecchie in esecuzione in parallelo a quella corrente.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        if (regs.length > 1) {
          console.warn(`Trovate ${regs.length} registrazioni service worker, ripulisco le obsolete.`);
          regs.slice(1).forEach(r => r.unregister());
        }
      });
    }
  }

  private updateNav(url: string): void {
    const u = url.split('?')[0];

    if (u === '/login' || u === '/registrati' || u === '/coach/registrati') {
      this.showChrome = false;
      return;
    }
    this.showChrome = true;
    this.showShoppingList = false;
    this.showViewToggle = false;
    this.showSaveWorkout = false;
    this.showSettings = false;

    if (u === '/account') {
      this.navTitle = 'Account';
      this.navSubtitle = '';
      this.showBack = false;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      return;
    }

    if (u === '/coach/bacheca') {
      this.navTitle = 'Bacheca';
      this.navSubtitle = this.auth.currentUser()?.displayName ?? '';
      this.showBack = false;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      return;
    }

    if (u === '/coach/clienti') {
      this.navTitle = 'Clienti';
      this.navSubtitle = 'I tuoi atleti';
      this.showBack = false;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      return;
    }

    if (/^\/coach\/clienti\/[^/]+$/.test(u)) {
      this.navTitle = 'Cliente';
      this.navSubtitle = 'Protocolli';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      return;
    }

    if (/^\/coach\/clienti\/[^/]+\/nuovo$/.test(u)) {
      this.navTitle = 'Nuovo protocollo';
      this.navSubtitle = '';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      return;
    }

    if (/^\/coach\/clienti\/[^/]+\/importa-pdf$/.test(u)) {
      this.navTitle = 'Importa da PDF';
      this.navSubtitle = '';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      return;
    }

    if (/^\/coach\/clienti\/[^/]+\/builder\/[^/]+$/.test(u)) {
      this.navTitle = 'Protocollo';
      this.navSubtitle = '';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      this.showSettings = true;
      return;
    }

    if (u === '/dieta') {
      this.navTitle = 'Dieta';
      this.navSubtitle = 'Piano alimentare';
      this.showBack = false;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      this.showShoppingList = true;
      return;
    }

    if (u === '/dieta/lista-spesa') {
      this.navTitle = 'Lista della spesa';
      this.navSubtitle = '';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      return;
    }

    if (/^\/dieta\/(?!lista-spesa$)[^/]+$/.test(u)) {
      this.navTitle = 'Piano alimentare';
      this.navSubtitle = '';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      this.showViewToggle = true;
      this.viewToggleTarget = 'dieta';
      return;
    }

    if (u === '/misure') {
      this.navTitle = 'Misure';
      this.navSubtitle = 'Le tue misurazioni';
      this.showBack = false;
      this.showHistory = true;
      this.showInfo = false;
      this.showAnalytics = true;
      return;
    }

    if (u === '/misure/storico') {
      this.navTitle = 'Storico misure';
      this.navSubtitle = 'Misurazioni salvate';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      return;
    }

    if (u === '/misure/analytics') {
      this.navTitle = 'Andamento';
      this.navSubtitle = 'Analisi misure';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      return;
    }

    const categoriaMatch = u.match(/^\/misure\/(peso|centimetri|pliche)$/);
    if (categoriaMatch) {
      const isEdit = /[?&]date=/.test(url);
      this.navTitle = CATEGORY_LABELS[categoriaMatch[1] as MeasureCategory];
      this.navSubtitle = isEdit ? 'Modifica misurazione' : 'Nuova misurazione';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      return;
    }

    if (u === '/scheda/storico') {
      this.navTitle = 'Storico';
      this.navSubtitle = 'Sedute salvate';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      return;
    }

    if (u === '/scheda/info') {
      this.navTitle = 'Info';
      this.navSubtitle = 'Il programma';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      return;
    }

    const dayMatch = u.match(/^\/scheda\/day\/(\d+)$/);
    if (dayMatch) {
      const idx = parseInt(dayMatch[1], 10);
      const day = this.workoutData.days[idx];
      this.navTitle = day ? `Giorno ${idx + 1}` : 'Allenamento';
      this.navSubtitle = day ? `${day.label} · rec ${day.rec}` : '';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      this.showViewToggle = true;
      this.viewToggleTarget = 'scheda';
      this.showSaveWorkout = true;
      return;
    }

    const historicoMatch = u.match(/^\/scheda\/storico\/.+$/);
    if (historicoMatch) {
      this.navTitle = 'Dettaglio seduta';
      this.navSubtitle = '';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      return;
    }

    const misureStoricoMatch = u.match(/^\/misure\/storico\/.+$/);
    if (misureStoricoMatch) {
      this.navTitle = 'Dettaglio misurazione';
      this.navSubtitle = '';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
      return;
    }

    // Default: /scheda
    this.navTitle = this.workoutData.hasCustomProtocol ? (this.workoutData.protocolName || 'Scheda') : 'Scheda';
    this.navSubtitle = this.auth.currentUser()?.displayName ?? '';
    this.showBack = false;
    this.showHistory = true;
    this.showInfo = true;
    this.showAnalytics = false;
  }

  onBack(): void {
    const u = this.router.url.split('?')[0];
    if (u.match(/^\/scheda\/storico\/.+$/)) {
      this.router.navigate(['/scheda/storico']);
    } else if (u.match(/^\/misure\/storico\/.+$/)) {
      this.router.navigate(['/misure/storico']);
    } else if (u === '/misure/storico' || u === '/misure/analytics') {
      this.router.navigate(['/misure']);
    } else if (/^\/misure\/(peso|centimetri|pliche)$/.test(u)) {
      this.router.navigate(this.router.url.includes('date=') ? ['/misure/storico'] : ['/misure']);
    } else if (/^\/coach\/clienti\/[^/]+\/builder\/[^/]+$/.test(u)) {
      const clientId = u.split('/')[3];
      this.router.navigate(['/coach/clienti', clientId]);
    } else if (/^\/coach\/clienti\/[^/]+\/aggiorna-pdf\/[^/]+$/.test(u)) {
      const parts = u.split('/');
      this.router.navigate(['/coach/clienti', parts[3], 'builder', parts[5]]);
    } else if (/^\/coach\/clienti\/[^/]+\/importa-pdf$/.test(u)) {
      const clientId = u.split('/')[3];
      this.router.navigate(['/coach/clienti', clientId, 'nuovo']);
    } else if (/^\/coach\/clienti\/[^/]+\/nuovo$/.test(u)) {
      const clientId = u.split('/')[3];
      this.router.navigate(['/coach/clienti', clientId]);
    } else if (/^\/coach\/clienti\/[^/]+$/.test(u)) {
      this.router.navigate(['/coach/clienti']);
    } else if (u === '/dieta/lista-spesa' || /^\/dieta\/(?!lista-spesa$)[^/]+$/.test(u)) {
      this.router.navigate(['/dieta']);
    } else {
      this.router.navigate(['/scheda']);
    }
  }

  onHistory(): void {
    const u = this.router.url.split('?')[0];
    if (u.startsWith('/misure')) {
      this.router.navigate(['/misure/storico']);
    } else {
      this.router.navigate(['/scheda/storico']);
    }
  }

  onInfo(): void {
    this.router.navigate(['/scheda/info']);
  }

  onSettingsClick(): void {
    const u = this.router.url.split('?')[0];
    const match = u.match(/^\/coach\/clienti\/([^/]+)\/builder\/([^/]+)$/);
    if (!match) return;
    this.router.navigate(['/coach/clienti', match[1], 'aggiorna-pdf', match[2]]);
  }

  onAnalytics(): void {
    this.router.navigate(['/misure/analytics']);
  }

  onShoppingList(): void {
    this.router.navigate(['/dieta/lista-spesa']);
  }

  currentViewMode(): 'list' | 'slider' {
    return this.viewToggleTarget === 'dieta' ? this.dietState.viewMode() : this.workoutState.viewMode();
  }

  onViewModeChange(mode: 'list' | 'slider'): void {
    if (this.viewToggleTarget === 'dieta') {
      this.dietState.setViewMode(mode);
    } else {
      this.workoutState.setViewMode(mode);
    }
  }

  onSaveWorkoutClick(): void {
    this.workoutState.requestSave();
  }
}
