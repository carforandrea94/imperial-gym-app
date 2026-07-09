import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

type ClientTab = 'scheda' | 'dieta' | 'misure' | 'account';
type CoachTab = 'bacheca' | 'clienti' | 'account';

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
    if (url.startsWith('/account')) return 'account';
    return 'scheda';
  }

  get activeCoachTab(): CoachTab {
    const url = this.router.url;
    if (url.startsWith('/coach/clienti')) return 'clienti';
    if (url.startsWith('/account')) return 'account';
    return 'bacheca';
  }

  navigate(tab: ClientTab): void {
    this.router.navigate(['/' + tab]);
  }

  navigateCoach(tab: CoachTab): void {
    if (tab === 'account') {
      this.router.navigate(['/account']);
    } else {
      this.router.navigate(['/coach/' + tab]);
    }
  }
}
