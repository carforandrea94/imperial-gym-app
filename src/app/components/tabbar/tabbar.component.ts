import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

type ClientTab = 'scheda' | 'dieta' | 'misure';
type CoachTab = 'bacheca' | 'clienti';

@Component({
  selector: 'app-tabbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './tabbar.component.html'
})
export class TabbarComponent {
  constructor(private router: Router, public auth: AuthService) {}

  get isCoach(): boolean {
    return this.auth.isCoach;
  }

  get activeTab(): ClientTab {
    const url = this.router.url;
    if (url.startsWith('/dieta')) return 'dieta';
    if (url.startsWith('/misure')) return 'misure';
    return 'scheda';
  }

  get activeCoachTab(): CoachTab {
    return this.router.url.startsWith('/coach/clienti') ? 'clienti' : 'bacheca';
  }

  navigate(tab: ClientTab): void {
    this.router.navigate(['/' + tab]);
  }

  navigateCoach(tab: CoachTab): void {
    this.router.navigate(['/coach/' + tab]);
  }
}
