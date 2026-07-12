import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { isIosSafariNotStandalone } from '../../core/utils/platform.util';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './account.component.html',
  styles: [`
    :host { display: block; animation: fade .4s var(--spring-soft); }
    .account-header { display: flex; align-items: center; gap: 14px; }
    .account-avatar {
      width: 56px; height: 56px; border-radius: 16px; flex-shrink: 0;
      background: var(--accent-dim); color: var(--accent);
      border: 1px solid rgba(255,255,255,.12);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.25);
      display: flex; align-items: center; justify-content: center;
      font-family: 'Inter', sans-serif; font-weight: 800; font-size: 22px;
    }
    .account-header .info { flex: 1; min-width: 0; }
    .account-header .lbl {
      font-family: 'Inter', sans-serif; font-weight: 700; font-size: 17px;
      letter-spacing: -.005em; line-height: 1.25;
    }
    .account-header .meta {
      font-family: 'IBM Plex Mono', monospace; font-size: 12px;
      color: var(--label-2); margin-top: 3px;
    }
    .account-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 0; border-bottom: 1px solid var(--separator);
    }
    .account-row:last-child { border-bottom: none; }
    .account-row-label {
      font-family: 'Inter', sans-serif; font-size: 13.5px; color: var(--label-2);
    }
    .account-row-value {
      font-family: 'IBM Plex Mono', monospace; font-size: 13px; color: var(--label);
      text-align: right; word-break: break-all; margin-left: 12px;
    }
  `]
})
export class AccountComponent implements OnInit {
  copied = false;

  constructor(public auth: AuthService) {}

  ngOnInit(): void {
    if (this.auth.isCoach) {
      this.auth.ensureCoachCode().catch(e => console.error('Errore ensureCoachCode:', e));
    }
  }

  get initial(): string {
    return (this.auth.currentUser()?.displayName ?? '?').charAt(0).toUpperCase();
  }

  get roleLabel(): string {
    return this.auth.isCoach ? 'Coach' : 'Cliente';
  }

  get showIosNotificationHint(): boolean {
    return isIosSafariNotStandalone();
  }

  get memberSince(): string {
    const iso = this.auth.currentUser()?.createdAt;
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  async copyCode(): Promise<void> {
    const code = this.auth.currentUser()?.pairingCode;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      this.copied = true;
      setTimeout(() => { this.copied = false; }, 2000);
    } catch {
      // clipboard non disponibile: l'utente puo' comunque selezionare il testo a mano
    }
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    // Reload completo (non router.navigate) cosi' tutti i singleton
    // (AppStateService, ProtocolBootstrapService, WorkoutDataService,
    // DietDataService, ecc.) ripartono da zero: evita che i dati
    // dell'account precedente restino in memoria per il prossimo login.
    window.location.href = '/login';
  }
}
