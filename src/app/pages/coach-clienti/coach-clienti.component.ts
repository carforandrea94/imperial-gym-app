import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { UserProfile } from '../../core/models/user.model';

@Component({
  selector: 'app-coach-clienti',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './coach-clienti.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class CoachClientiComponent implements OnInit {
  clients: UserProfile[] = [];
  loading = true;
  copied = false;

  constructor(public auth: AuthService) {}

  ngOnInit(): void {
    this.auth.ensureCoachCode();
    this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.clients = await this.auth.listClients();
    this.loading = false;
  }

  get myCode(): string {
    return this.auth.currentUser()?.pairingCode ?? '';
  }

  async copyCode(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.myCode);
      this.copied = true;
      setTimeout(() => { this.copied = false; }, 2000);
    } catch {
      // clipboard non disponibile: l'utente puo' comunque selezionare il testo a mano
    }
  }
}
