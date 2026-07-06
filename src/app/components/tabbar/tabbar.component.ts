import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-tabbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './tabbar.component.html'
})
export class TabbarComponent {
  constructor(private router: Router) {}

  get activeTab(): 'scheda' | 'dieta' {
    return this.router.url.startsWith('/dieta') ? 'dieta' : 'scheda';
  }

  navigate(tab: 'scheda' | 'dieta'): void {
    this.router.navigate(['/' + tab]);
  }
}
