import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd, RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { NavbarComponent } from './components/navbar/navbar.component';
import { TabbarComponent } from './components/tabbar/tabbar.component';
import { RestTimerComponent } from './components/rest-timer/rest-timer.component';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { WorkoutDataService } from './services/workout-data.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, TabbarComponent, RestTimerComponent, ConfirmDialogComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  navTitle = 'Scheda';
  navSubtitle = '';
  showBack = false;
  showActions = false;

  private routeSub: Subscription | null = null;

  constructor(
    private router: Router,
    private workoutData: WorkoutDataService
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

    if (u === '/dieta') {
      this.navTitle = 'Dieta';
      this.navSubtitle = 'Piano alimentare';
      this.showBack = false;
      this.showActions = false;
      return;
    }

    if (u === '/scheda/storico') {
      this.navTitle = 'Storico';
      this.navSubtitle = 'Sedute salvate';
      this.showBack = true;
      this.showActions = false;
      return;
    }

    if (u === '/scheda/info') {
      this.navTitle = 'Info';
      this.navSubtitle = 'Il programma';
      this.showBack = true;
      this.showActions = false;
      return;
    }

    const dayMatch = u.match(/^\/scheda\/day\/(\d+)$/);
    if (dayMatch) {
      const idx = parseInt(dayMatch[1], 10);
      const day = this.workoutData.days[idx];
      this.navTitle = day ? `Giorno ${idx + 1}` : 'Allenamento';
      this.navSubtitle = day?.label ?? '';
      this.showBack = true;
      this.showActions = false;
      return;
    }

    const historicoMatch = u.match(/^\/scheda\/storico\/.+$/);
    if (historicoMatch) {
      this.navTitle = 'Dettaglio seduta';
      this.navSubtitle = '';
      this.showBack = true;
      this.showActions = false;
      return;
    }

    // Default: /scheda
    this.navTitle = 'Protocollo Cut';
    this.navSubtitle = 'Andrea Carfora';
    this.showBack = false;
    this.showActions = true;
  }

  onBack(): void {
    const u = this.router.url.split('?')[0];
    if (u.match(/^\/scheda\/storico\/.+$/)) {
      this.router.navigate(['/scheda/storico']);
    } else {
      this.router.navigate(['/scheda']);
    }
  }

  onHistory(): void {
    this.router.navigate(['/scheda/storico']);
  }

  onInfo(): void {
    this.router.navigate(['/scheda/info']);
  }
}
