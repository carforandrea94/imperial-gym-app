import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styles: [`:host { display: block; }`]
})
export class LoginComponent {
  email = '';
  password = '';
  pairingCode = '';

  needsCode = false;
  loading = false;
  errorMsg = '';

  constructor(private auth: AuthService, private router: Router) {}

  async submit(): Promise<void> {
    if (!this.email || !this.password) return;
    this.loading = true;
    this.errorMsg = '';

    try {
      const profile = await this.auth.login(this.email, this.password, this.pairingCode || undefined);
      if (profile.role === 'coach') {
        this.router.navigate(['/coach/bacheca']);
      } else {
        this.router.navigate(['/scheda']);
      }
    } catch (e: any) {
      if (e?.message === 'CODE_REQUIRED') {
        this.needsCode = true;
        this.errorMsg = 'Primo accesso: inserisci anche il codice di accoppiamento fornito dal tuo coach.';
      } else if (e?.code === 'auth/invalid-credential' || e?.code === 'auth/wrong-password' || e?.code === 'auth/user-not-found') {
        this.errorMsg = 'Email o password non corrette.';
      } else {
        this.errorMsg = e?.message || 'Errore durante l\'accesso. Riprova.';
      }
    } finally {
      this.loading = false;
    }
  }
}
