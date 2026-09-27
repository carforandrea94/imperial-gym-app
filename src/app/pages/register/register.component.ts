import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideAngularModule],
  templateUrl: './register.component.html',
  styles: [`:host { display: block; }`]
})
export class RegisterComponent {
  displayName = '';
  email = '';
  password = '';
  coachCode = '';

  /** L'informativa accettata. Parte spenta: un consenso prespuntato non e' un
   *  consenso, e le regole rifiutano un profilo senza. */
  privacyOk = false;

  loading = false;
  errorMsg = '';

  /** La password sul telefono si sbaglia al buio, e qui la si sta scegliendo. */
  showPassword = false;

  /**
   * Si sta finendo un'iscrizione rimasta a meta', non iniziandone una nuova:
   * l'utente su Auth c'e' gia', manca il profilo. Email e password sono gia'
   * state scelte, quindi qui si chiede solo quello che manca.
   */
  completa = false;
  /** L'indirizzo della sessione da completare, per dire di chi si tratta. */
  emailInSospeso: string | null = null;

  constructor(
    private auth: AuthService,
    private router: Router,
    route: ActivatedRoute
  ) {
    if (route.snapshot.queryParamMap.get('completa') === '1') {
      // Ci si arriva solo dall'accesso, con una sessione aperta senza profilo.
      // Scritto a mano nella barra degli indirizzi non vuol dire niente.
      if (this.auth.hasPendingProfile()) {
        this.completa = true;
        this.emailInSospeso = this.auth.pendingEmail();
      } else {
        this.router.navigate(['/login']);
      }
    }
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  /** Lascia perdere l'iscrizione a meta' e chiude la sessione. */
  async annulla(): Promise<void> {
    await this.auth.logout();
    this.router.navigate(['/login']);
  }

  async submit(form: NgForm): Promise<void> {
    if (form.invalid) {
      Object.values(form.controls).forEach(c => c.markAsTouched());
      return;
    }
    this.loading = true;
    this.errorMsg = '';

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 15000)
    );

    try {
      await Promise.race([
        this.completa
          ? this.auth.completeClientProfile(this.displayName, this.coachCode)
          : this.auth.registerClient(this.displayName, this.email, this.password, this.coachCode),
        timeout
      ]);
      this.router.navigate(['/scheda']);
    } catch (e: any) {
      console.error('Errore registrazione cliente:', e);
      if (e?.message === 'TIMEOUT') {
        this.errorMsg = 'La richiesta sta impiegando troppo tempo. Riprova.';
      } else if (e?.code === 'auth/email-already-in-use') {
        this.errorMsg = 'Questa email e\' gia\' registrata.';
      } else if (e?.code === 'auth/invalid-email') {
        this.errorMsg = 'Email non valida.';
      } else if (e?.message?.startsWith('Codice coach')) {
        this.errorMsg = e.message;
      } else {
        this.errorMsg = e?.message || 'Errore durante la registrazione. Riprova.';
      }
    } finally {
      this.loading = false;
    }
  }
}
