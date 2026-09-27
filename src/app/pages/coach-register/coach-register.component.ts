import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-coach-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideAngularModule],
  templateUrl: './coach-register.component.html',
  styles: [`:host { display: block; }`]
})
export class CoachRegisterComponent {
  displayName = '';
  email = '';
  password = '';

  loading = false;
  errorMsg = '';

  /** La password sul telefono si sbaglia al buio, e qui la si sta scegliendo. */
  showPassword = false;

  /**
   * Si sta finendo un'iscrizione rimasta a meta': l'utente su Auth c'e' gia',
   * manca il profilo. Email e password sono gia' state scelte.
   */
  completa = false;
  emailInSospeso: string | null = null;

  constructor(
    private auth: AuthService,
    private router: Router,
    route: ActivatedRoute
  ) {
    if (route.snapshot.queryParamMap.get('completa') === '1') {
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
          ? this.auth.completeCoachProfile(this.displayName)
          : this.auth.registerCoach(this.email, this.password, this.displayName),
        timeout
      ]);
      this.router.navigate(['/coach/bacheca']);
    } catch (e: any) {
      console.error('Errore registrazione coach:', e);
      if (e?.message === 'TIMEOUT') {
        this.errorMsg = 'La richiesta sta impiegando troppo tempo. Controlla che Email/Password sia attivo su Firebase Authentication, poi riprova.';
      } else if (e?.code === 'auth/email-already-in-use') {
        this.errorMsg = 'Questa email e\' gia\' registrata.';
      } else if (e?.code === 'auth/invalid-email') {
        this.errorMsg = 'Email non valida.';
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
