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

    try {
      await this.auth.registerCoach(this.email, this.password, this.displayName);
      this.router.navigate(['/coach/bacheca']);
    } catch (e: any) {
      if (e?.code === 'auth/email-already-in-use') {
        this.errorMsg = 'Questa email e\' gia\' registrata.';
      } else {
        this.errorMsg = e?.message || 'Errore durante la registrazione. Riprova.';
      }
    } finally {
      this.loading = false;
    }
  }
}
