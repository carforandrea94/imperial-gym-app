import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

type Tab = 'scheda' | 'dieta' | 'misure';

@Component({
  selector: 'app-tabbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './tabbar.component.html'
})
export class TabbarComponent {
  constructor(private router: Router) {}

  get activeTab(): Tab {
    const url = this.router.url;
    if (url.startsWith('/dieta')) return 'dieta';
    if (url.startsWith('/misure')) return 'misure';
    return 'scheda';
  }

  navigate(tab: Tab): void {
    this.router.navigate(['/' + tab]);
  }
}
