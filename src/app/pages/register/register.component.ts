import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styles: [`:host { display: block; }`]
})
export class RegisterComponent {
  displayName = '';
  email = '';
  password = '';
  coachCode = '';

  loading = false;
  errorMsg = '';

  constructor(private auth: AuthService, private router: Router) {}

  async submit(): Promise<void> {
    if (!this.displayName || !this.email || !this.password || !this.coachCode) return;
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
        this.auth.registerClient(this.displayName, this.email, this.password, this.coachCode),
        timeout
      ]);
      this.router.navigate(['/scheda']);
    } catch (e: any) {
      console.error('Errore registrazione cliente:', e);
      if (e?.message === 'TIMEOUT') {
        this.errorMsg = 'La richiesta sta impiegando troppo tempo. Riprova.';
      } else if (e?.code === 'auth/email-already-in-use') {
        this.errorMsg = 'Questa email e\' gia\' registrata.';
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
