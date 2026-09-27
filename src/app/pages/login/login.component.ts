import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/services/auth.service';
import { LogoComponent } from '../../components/logo/logo.component';
import { loginErrorMessage, resetErrorMessage, RESET_SENT_MESSAGE } from '../../core/utils/auth-errors.util';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LogoComponent, LucideAngularModule],
  templateUrl: './login.component.html',
  styles: [`:host { display: block; }`]
})
export class LoginComponent {
  email = '';
  password = '';

  /** Quale delle due tacche e' scelta. Prima erano tre link sotto al tasto,
   *  due dei quali dicevano quasi la stessa cosa: la scelta fra entrare e
   *  iscriversi ora si fa prima di scrivere qualcosa, non dopo. */
  mode: 'login' | 'register' = 'login';

  loading = false;
  errorMsg = '';

  /** La password in chiaro: senza, su una tastiera del telefono si sbaglia al
   *  buio e non si capisce perche' l'accesso non va. */
  showPassword = false;

  /** Sta partendo l'email per reimpostare la password. */
  sendingReset = false;
  /** Il messaggio dopo la richiesta: non e' un errore, quindi ha un posto suo. */
  infoMsg = '';

  constructor(private auth: AuthService, private router: Router) {}

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  /**
   * Cambia tacca. Ripulisce i messaggi: un errore d'accesso lasciato li'
   * mentre si guarda come iscriversi parlerebbe di un'altra cosa.
   */
  setMode(mode: 'login' | 'register'): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.errorMsg = '';
    this.infoMsg = '';
  }

  async submit(form: NgForm): Promise<void> {
    if (form.invalid) {
      Object.values(form.controls).forEach(c => c.markAsTouched());
      return;
    }
    this.loading = true;
    this.errorMsg = '';
    this.infoMsg = '';

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 15000)
    );

    try {
      const profile = await Promise.race([
        this.auth.login(this.email, this.password),
        timeout
      ]) as Awaited<ReturnType<AuthService['login']>>;
      if (profile.role === 'coach') {
        this.router.navigate(['/coach/bacheca']);
      } else {
        this.router.navigate(['/scheda']);
      }
    } catch (e: any) {
      console.error('Errore login:', e);
      this.errorMsg = loginErrorMessage(e);
    } finally {
      this.loading = false;
    }
  }

  /**
   * Reimposta la password, dall'indirizzo gia' scritto nel campo: e' quello
   * che si sta provando, e farlo riscrivere altrove sarebbe un giro a vuoto.
   */
  async resetPassword(): Promise<void> {
    if (this.sendingReset) return;
    this.errorMsg = '';
    this.infoMsg = '';

    const email = this.email.trim();
    if (!email) {
      this.errorMsg = 'Scrivi la tua email qui sopra, poi tocca di nuovo.';
      return;
    }

    this.sendingReset = true;
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 15000)
    );

    try {
      await Promise.race([this.auth.sendPasswordReset(email), timeout]);
      this.infoMsg = RESET_SENT_MESSAGE;
    } catch (e: any) {
      console.error('Errore invio reset password:', e);
      this.errorMsg = resetErrorMessage(e);
    } finally {
      this.sendingReset = false;
    }
  }
}
