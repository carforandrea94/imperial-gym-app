import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { isIosSafariNotStandalone } from '../../core/utils/platform.util';

@Component({
  selector: 'app-impostazioni',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './impostazioni.component.html',
  styles: [`
    :host { display: block; animation: fade .4s var(--spring-soft); }
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
export class ImpostazioniComponent implements OnInit {
  copied = false;

  constructor(
    public auth: AuthService,
    public theme: ThemeService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (this.auth.isCoach) {
      this.auth.ensureCoachCode().catch(e => console.error('Errore ensureCoachCode:', e));
    }
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
      setTimeout(() => { this.copied = false; this.cdr.detectChanges(); }, 2000);
    } catch {
      // clipboard non disponibile: l'utente puo' comunque selezionare il testo a mano
    }
  }
}
