import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd, RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { NavbarComponent } from './components/navbar/navbar.component';
import { TabbarComponent } from './components/tabbar/tabbar.component';
import { RestTimerComponent } from './components/rest-timer/rest-timer.component';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { WorkoutDataService } from './services/workout-data.service';
import { AuthService } from './core/services/auth.service';

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
  showChrome = true;

  private routeSub: Subscription | null = null;

  constructor(
    private router: Router,
    private workoutData: WorkoutDataService,
    public auth: AuthService
  ) {}

  ngOnInit(): void {
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

  private updateNav(url: string): void {
    const u = url.split('?')[0];

    if (u === '/login' || u === '/coach/registrati') {
      this.showChrome = false;
      return;
    }
    this.showChrome = true;

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

    if (u === '/dieta') {
      this.navTitle = 'Dieta';
      this.navSubtitle = 'Piano alimentare';
      this.showBack = false;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
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
      this.navSubtitle = day?.label ?? '';
      this.showBack = true;
      this.showHistory = false;
      this.showInfo = false;
      this.showAnalytics = false;
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
    this.navTitle = 'Protocollo Cut';
    this.navSubtitle = 'Andrea Carfora';
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

  onAnalytics(): void {
    this.router.navigate(['/misure/analytics']);
  }

  async onLogout(): Promise<void> {
    await this.auth.logout();
    this.router.navigate(['/login']);
  }
}
