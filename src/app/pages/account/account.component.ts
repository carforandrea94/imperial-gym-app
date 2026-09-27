import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { FormaCardComponent } from '../../components/forma-card/forma-card.component';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, FormaCardComponent],
  templateUrl: './account.component.html',
  styles: [`
    :host { display: block; animation: fade .4s var(--spring-soft); }
    .account-header { display: flex; align-items: center; gap: 14px; }
    .account-avatar {
      width: 56px; height: 56px; border-radius: var(--r-lg); flex-shrink: 0;
      background: var(--accent-dim); color: var(--accent);
      border: 1px solid rgba(255,255,255,.12);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.25);
      display: flex; align-items: center; justify-content: center;
      font-family: 'Inter', sans-serif; font-weight: 800; font-size: var(--text-2xl);
    }
    .account-header .info { flex: 1; min-width: 0; }
    .account-header .lbl {
      font-family: 'Inter', sans-serif; font-weight: 700; font-size: var(--text-lg);
      letter-spacing: -.005em; line-height: 1.25;
    }
    .account-header .meta {
      font-family: 'IBM Plex Mono', monospace; font-size: var(--text-xs);
      color: var(--label-2); margin-top: 3px;
    }
  `]
})
export class AccountComponent {
  constructor(public auth: AuthService, private router: Router) {}

  get initial(): string {
    return (this.auth.currentUser()?.displayName ?? '?').charAt(0).toUpperCase();
  }

  get roleLabel(): string {
    return this.auth.isCoach ? 'Coach' : 'Cliente';
  }

  goToImpostazioni(): void {
    this.router.navigate(['/account/impostazioni']);
  }
}
