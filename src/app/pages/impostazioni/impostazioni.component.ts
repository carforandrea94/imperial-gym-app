import {
  Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef,
  ElementRef, Renderer2, ViewChild, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/services/auth.service';
import { Sex } from '../../core/models/user.model';
import { ThemeService } from '../../services/theme.service';
import { ToastService } from '../../services/toast.service';
import { isIosSafariNotStandalone } from '../../core/utils/platform.util';
import { todayLocalISO } from '../../core/utils/date.util';
import {
  heightOptions, toWheelValue, wheelValueAt, wheelOffsetOf, formatHeightCm
} from '../../core/utils/height.util';

@Component({
  selector: 'app-impostazioni',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './impostazioni.component.html',
  styles: [`
    :host { display: block; animation: fade .4s var(--spring-soft); }
    .account-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 0; border-bottom: 1px solid var(--separator);
    }
    .account-row:last-child { border-bottom: none; }
    /* Il suggerimento in fondo alla card non e' una riga: senza questo
       involucro sarebbe lui l'ultimo figlio, e l'ultima riga vera terrebbe
       un separatore appeso al nulla. */
    .rows { display: flex; flex-direction: column; }
    .account-row-label {
      font-family: 'Inter', sans-serif; font-size: 13.5px; color: var(--label-2);
    }
    .account-row-value {
      font-family: 'IBM Plex Mono', monospace; font-size: 13px; color: var(--label);
      text-align: right; word-break: break-all; margin-left: 12px;
    }
    /* Un'altezza mai messa non e' un valore: si spegne, come il resto dei
       segnaposto dell'app, invece di sembrare un dato. */
    .account-row-value.unset { color: var(--label-3); font-weight: 500; }
    .heightrow {
      width: 100%; min-height: 44px; padding: 10px 0; text-align: left;
      background: none; border: none; border-bottom: none;
      color: inherit; font: inherit; cursor: pointer;
    }
    .heightrow-right {
      display: flex; align-items: center; gap: 8px; color: var(--label-3);
    }
    /* Il campo data si veste da valore: e' una riga come le altre, non un
       modulo. Il selettore lo apre il sistema. */
    .daterow {
      background: none; border: none; outline: none; padding: 0; margin-left: 12px;
      font-family: 'IBM Plex Mono', monospace; font-size: 13px; color: var(--label);
      text-align: right; cursor: pointer; min-height: 44px;
    }
    .daterow.unset { color: var(--label-3); }
    .daterow:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: var(--r-xs); }
    .daterow::-webkit-calendar-picker-indicator { opacity: .5; cursor: pointer; }
    .settings-hint {
      font-size: var(--text-xs); line-height: 1.5; color: var(--label-3);
      margin: 10px 0 0;
    }
  `]
})
export class ImpostazioniComponent implements OnInit, AfterViewInit, OnDestroy {
  copied = false;

  readonly options = heightOptions();
  /** Il valore fermo al centro della ruota. E' un signal perche' lo muove
   *  l'evento di scorrimento, e l'app e' zoneless: senza, la tacca accesa
   *  resterebbe quella di partenza mentre la ruota gira. */
  readonly pick = signal(toWheelValue(null));
  heightModalOpen = false;
  saving = false;

  @ViewChild('heightSheetOverlay') sheetOverlayEl?: ElementRef<HTMLDivElement>;
  @ViewChild('heightWheel') wheelEl?: ElementRef<HTMLDivElement>;

  constructor(
    public auth: AuthService,
    public theme: ThemeService,
    private toast: ToastService,
    private renderer: Renderer2,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (this.auth.isCoach) {
      this.auth.ensureCoachCode().catch(e => console.error('Errore ensureCoachCode:', e));
    }
  }

  /**
   * Sposta il foglio fuori dal contenuto e direttamente in document.body: la
   * pagina vive dentro `.wrap`, che apre un proprio stacking context, e li'
   * dentro il foglio finirebbe sotto la tabbar qualunque z-index gli si dia.
   * Stessa ragione, stessa mossa del foglio del recupero.
   */
  ngAfterViewInit(): void {
    if (this.sheetOverlayEl) {
      this.renderer.appendChild(document.body, this.sheetOverlayEl.nativeElement);
    }
  }

  ngOnDestroy(): void {
    if (this.sheetOverlayEl?.nativeElement.parentNode === document.body) {
      this.renderer.removeChild(document.body, this.sheetOverlayEl.nativeElement);
    }
  }

  get heightSet(): boolean {
    const cm = this.auth.currentUser()?.heightCm;
    return cm !== null && cm !== undefined;
  }

  get heightLabel(): string {
    const cm = this.auth.currentUser()?.heightCm;
    return this.heightSet ? `${formatHeightCm(cm)} cm` : 'Da impostare';
  }

  get birthDate(): string | null {
    return this.auth.currentUser()?.birthDate ?? null;
  }

  /** Nessuno nasce domani. */
  readonly maxBirthDate = todayLocalISO();
  /** Un limite inferiore che nessun vivente supera, giusto per chiudere il
   *  campo: senza, il selettore nativo si apre sull'anno zero. */
  readonly minBirthDate = '1920-01-01';

  /**
   * La data si salva appena il selettore nativo si chiude. Il campo `date`
   * emette `change` solo con una data COMPLETA e gia' valida, quindi qui non
   * arriva mai un mezzo valore da respingere — un anno scritto a meta' resta
   * dentro il campo e non diventa un salvataggio.
   */
  async setBirthDate(event: Event): Promise<void> {
    const value = (event.target as HTMLInputElement).value || null;
    if (value === this.birthDate) return;
    const before = this.birthDate;
    this.auth.currentUser.set({ ...this.auth.currentUser()!, birthDate: value });
    try {
      await this.auth.patchBody({ birthDate: value });
    } catch (e) {
      console.error('Salvataggio della data di nascita fallito:', e);
      this.auth.currentUser.set({ ...this.auth.currentUser()!, birthDate: before });
      this.toast.error('Non sono riuscito a salvare. Riprova.');
    }
    this.cdr.detectChanges();
  }

  get sex(): Sex | null {
    return this.auth.currentUser()?.sex ?? null;
  }

  /**
   * Il sesso si salva al tocco, senza conferma: e' un segmentato, e la tacca
   * accesa e' gia' il riscontro. Toccare quella gia' accesa non scrive niente.
   *
   * La tacca si accende PRIMA della scrittura, cosi' il comando risponde
   * subito; se la scrittura fallisce torna dov'era, perche' una tacca accesa
   * su un valore mai salvato e' una bugia che si scopre al prossimo accesso.
   */
  async setSex(value: Sex): Promise<void> {
    const before = this.sex;
    if (before === value) return;
    this.auth.currentUser.set({ ...this.auth.currentUser()!, sex: value });
    try {
      await this.auth.patchBody({ sex: value });
    } catch (e) {
      console.error('Salvataggio del sesso fallito:', e);
      this.auth.currentUser.set({ ...this.auth.currentUser()!, sex: before });
      this.toast.error('Non sono riuscito a salvare. Riprova.');
    }
    this.cdr.detectChanges();
  }

  openHeightModal(): void {
    this.pick.set(toWheelValue(this.auth.currentUser()?.heightCm));
    this.heightModalOpen = true;
    this.cdr.detectChanges();
    // Lo scorrimento si puo' impostare solo dopo che il foglio ha una
    // dimensione: da chiuso la ruota e' alta zero e scrollTop resterebbe a 0,
    // aprendo sempre sul primo valore invece che sul proprio.
    requestAnimationFrame(() => this.centreOn(this.pick(), 'auto'));
  }

  closeHeightModal(): void {
    this.heightModalOpen = false;
    this.cdr.detectChanges();
  }

  onHeightOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('bottomsheet-overlay')) {
      this.closeHeightModal();
    }
  }

  onWheelScroll(): void {
    const el = this.wheelEl?.nativeElement;
    if (!el) return;
    this.pick.set(wheelValueAt(el.scrollTop));
  }

  /** Porta un valore al centro. Col tocco secco su una tacca scorre dolce;
   *  all'apertura salta, perche' un'animazione da un valore che non e' mai
   *  stato mostrato sarebbe solo un tremolio. */
  centreOn(cm: number, behavior: ScrollBehavior = 'smooth'): void {
    const el = this.wheelEl?.nativeElement;
    if (!el) return;
    this.pick.set(toWheelValue(cm));
    el.scrollTo({ top: wheelOffsetOf(cm), behavior });
  }

  async saveHeightModal(): Promise<void> {
    if (this.saving) return;
    const cm = this.pick();
    if (cm === (this.auth.currentUser()?.heightCm ?? null)) {
      this.closeHeightModal();
      return;
    }
    this.saving = true;
    this.cdr.detectChanges();
    try {
      await this.auth.patchBody({ heightCm: cm });
      this.toast.success('Altezza salvata.');
      this.closeHeightModal();
    } catch (e) {
      console.error('Salvataggio altezza fallito:', e);
      this.toast.error('Non sono riuscito a salvare l\'altezza. Riprova.');
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
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
