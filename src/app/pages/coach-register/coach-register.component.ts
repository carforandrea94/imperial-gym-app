import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-coach-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './coach-register.component.html',
  styles: [`:host { display: block; }`]
})
export class CoachRegisterComponent {
  displayName = '';
  email = '';
  password = '';

  loading = false;
  errorMsg = '';

  constructor(private auth: AuthService, private router: Router) {}

  async submit(): Promise<void> {
    if (!this.displayName || !this.email || !this.password) return;
    if (this.password.length < 6) {
      this.errorMsg = 'La password deve avere almeno 6 caratteri.';
      return;
    }
    this.loading = true;
    this.errorMsg = '';

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 15000)
    );

    try {
      await Promise.race([
        this.auth.registerCoach(this.email, this.password, this.displayName),
        timeout
      ]);
      this.router.navigate(['/coach/bacheca']);
    } catch (e: any) {
      console.error('Errore registrazione coach:', e);
      if (e?.message === 'TIMEOUT') {
        this.errorMsg = 'La richiesta sta impiegando troppo tempo. Controlla che Email/Password sia attivo su Firebase Authentication, poi riprova.';
      } else if (e?.code === 'auth/email-already-in-use') {
        this.errorMsg = 'Questa email e\' gia\' registrata.';
      } else if (e?.code === 'auth/operation-not-allowed') {
        this.errorMsg = 'Accesso Email/Password non ancora attivato su Firebase. Contatta l\'amministratore.';
      } else {
        this.errorMsg = e?.message || 'Errore durante la registrazione. Riprova.';
      }
    } finally {
      this.loading = false;
    }
  }
}
