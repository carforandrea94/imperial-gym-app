import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
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
  errorMsg = '';
  copied = false;

  constructor(public auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.auth.ensureCoachCode().catch(e => console.error('Errore ensureCoachCode:', e));
    this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.errorMsg = '';

    const timeout = new Promise<UserProfile[]>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 12000)
    );

    try {
      this.clients = await Promise.race([this.auth.listClients(), timeout]);
    } catch (e: any) {
      console.error('Errore caricamento clienti:', e);
      this.errorMsg = e?.message === 'TIMEOUT'
        ? 'La connessione sta impiegando troppo tempo. Controlla la rete e riprova.'
        : 'Errore nel caricamento dei clienti. Riprova.';
    } finally {
      this.loading = false;
    }
  }

  openClient(c: UserProfile): void {
    this.router.navigate(['/coach/clienti', c.uid]);
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
