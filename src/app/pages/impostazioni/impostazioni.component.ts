import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { ToastService } from '../../services/toast.service';
import { isIosSafariNotStandalone } from '../../core/utils/platform.util';
import {
  parseHeightCm, formatHeightCm, HEIGHT_MIN_CM, HEIGHT_MAX_CM
} from '../../core/utils/height.util';

@Component({
  selector: 'app-impostazioni',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
    .settings-hint {
      font-size: var(--text-xs); line-height: 1.5; color: var(--label-3);
      margin: 10px 0 0;
    }
  `]
})
export class ImpostazioniComponent implements OnInit {
  copied = false;
  heightInput = '';
  savingHeight = false;

  constructor(
    public auth: AuthService,
    public theme: ThemeService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.heightInput = formatHeightCm(this.auth.currentUser()?.heightCm);
    if (this.auth.isCoach) {
      this.auth.ensureCoachCode().catch(e => console.error('Errore ensureCoachCode:', e));
    }
  }

  /**
   * Salva l'altezza quando il campo perde il fuoco. Non c'e' un pulsante
   * perche' il campo e' uno solo: il riscontro lo da' il toast.
   *
   * Un valore rifiutato non resta a schermo — tornerebbe a sembrare salvato —
   * ma il campo torna a quello che c'e' davvero sul profilo.
   */
  async saveHeight(): Promise<void> {
    const parsed = parseHeightCm(this.heightInput);
    const current = this.auth.currentUser()?.heightCm ?? null;

    if (!parsed.ok) {
      this.toast.error(parsed.reason === 'range'
        ? `L'altezza va in centimetri, fra ${HEIGHT_MIN_CM} e ${HEIGHT_MAX_CM}: per esempio 180.`
        : 'Scrivi solo un numero, per esempio 180.');
      this.resetHeightInput();
      return;
    }

    // Il campo e' stato solo sfiorato: niente scrittura, niente toast.
    if (parsed.value === current) {
      this.heightInput = formatHeightCm(parsed.value);
      this.cdr.detectChanges();
      return;
    }

    this.savingHeight = true;
    this.cdr.detectChanges();
    try {
      await this.auth.updateHeight(parsed.value);
      this.heightInput = formatHeightCm(parsed.value);
      this.toast.success(parsed.value === null ? 'Altezza rimossa.' : 'Altezza salvata.');
    } catch (e) {
      console.error('Salvataggio altezza fallito:', e);
      this.toast.error('Non sono riuscito a salvare l\'altezza. Riprova.');
      this.resetHeightInput();
    } finally {
      this.savingHeight = false;
      this.cdr.detectChanges();
    }
  }

  private resetHeightInput(): void {
    this.heightInput = formatHeightCm(this.auth.currentUser()?.heightCm);
    this.cdr.detectChanges();
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
