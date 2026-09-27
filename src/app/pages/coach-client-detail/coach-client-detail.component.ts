import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { doc, getDoc } from 'firebase/firestore';
import { FirebaseService } from '../../core/services/firebase.service';
import { ProtocolService } from '../../services/protocol.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../services/toast.service';
import { ZoneFixService } from '../../core/utils/zone.util';
import { UserProfile } from '../../core/models/user.model';
import { Protocol } from '../../models/protocol.model';

@Component({
  selector: 'app-coach-client-detail',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './coach-client-detail.component.html',
  styles: [`
    :host { display: block; animation: fade .4s var(--spring-soft); }
    /* Togliere un cliente non e' un'azione della pagina come le altre: sta in
       fondo, staccata, e non porta il colore dell'accento. */
    .dangerbtn {
      width: 100%; min-height: 48px; display: flex; align-items: center;
      justify-content: center; gap: 8px; border-radius: var(--r-md);
      background: var(--state-danger-soft); border: 1px solid var(--state-danger-soft-border);
      color: var(--state-danger-text); font-family: 'Inter', sans-serif;
      font-weight: 600; font-size: var(--text-md); cursor: pointer;
    }
    .dangerbtn:disabled { opacity: .55; cursor: default; }
    .danger-hint {
      font-size: var(--text-xs); line-height: 1.5; color: var(--label-3); margin: 10px 0 0;
    }
  `]
})
export class CoachClientDetailComponent implements OnInit, OnDestroy {
  clientId = '';
  client: UserProfile | null = null;
  protocols: Protocol[] = [];
  loading = true;
  errorMsg = '';
  busyId: string | null = null;
  removingClient = false;
  private paramSub: Subscription | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FirebaseService,
    private protocolSvc: ProtocolService,
    private confirm: ConfirmDialogService,
    private auth: AuthService,
    private toast: ToastService,
    private zoneFix: ZoneFixService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.paramSub = this.route.paramMap.subscribe(params => {
      this.clientId = params.get('clientId') ?? '';
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.paramSub?.unsubscribe();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.errorMsg = '';

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 12000)
    );

    try {
      const [client, protocols] = await Promise.race([
        Promise.all([
          this.zoneFix.run((async () => {
            const snap = await getDoc(doc(this.fb.db, 'users', this.clientId));
            return snap.exists() ? (snap.data() as UserProfile) : null;
          })()),
          this.protocolSvc.listForClient(this.clientId)
        ]),
        timeout
      ]);
      this.client = client;
      this.protocols = protocols;
    } catch (e: any) {
      console.error('Errore caricamento dettaglio cliente:', e);
      this.errorMsg = e?.message === 'TIMEOUT'
        ? 'La connessione sta impiegando troppo tempo. Controlla la rete e riprova.'
        : 'Errore nel caricamento. Riprova.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  newProtocol(): void {
    this.router.navigate(['/coach/clienti', this.clientId, 'nuovo']);
  }

  editProtocol(p: Protocol): void {
    this.router.navigate(['/coach/clienti', this.clientId, 'builder', p.id]);
  }

  async activate(p: Protocol, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    if (p.status === 'active') return;
    this.busyId = p.id;
    this.cdr.detectChanges();
    await this.protocolSvc.activate(this.clientId, p.id);
    await this.load();
    this.busyId = null;
    this.cdr.detectChanges();
  }

  async remove(p: Protocol, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    const ok = await this.confirm.confirm(`Eliminare il protocollo "${p.name}"?`);
    if (ok) {
      await this.protocolSvc.delete(this.clientId, p.id);
      await this.load();
    }
  }

  /**
   * Toglie il cliente e tutto quello che ha.
   *
   * La conferma dice anche cosa NON succede: l'accesso del cliente resta
   * aperto, perche' chiudere l'utente di qualcun altro su Auth lo puo' fare
   * solo un server. Tacerlo farebbe credere che sia stato chiuso.
   */
  async removeClient(): Promise<void> {
    if (this.removingClient) return;
    const nome = this.client?.displayName ?? 'questo cliente';
    const ok = await this.confirm.confirm(
      `Togliere ${nome}? Se ne vanno il suo profilo, i protocolli, le sedute salvate, ` +
      'le uscite di corsa e le misurazioni. Non si annulla. Il suo accesso resta ' +
      'attivo ma vuoto: per tornare dovra\' iscriversi di nuovo con il tuo codice.',
      { confirmLabel: 'Togli' }
    );
    if (!ok) return;

    this.removingClient = true;
    this.cdr.detectChanges();
    try {
      await this.auth.deleteClient(this.clientId);
      this.toast.success(`${nome} non e' piu' fra i tuoi clienti.`);
      this.router.navigate(['/coach/clienti']);
    } catch (e: any) {
      console.error('Errore rimozione cliente:', e);
      this.toast.error(e?.message || 'Non sono riuscito a togliere il cliente. Riprova.');
      this.removingClient = false;
      this.cdr.detectChanges();
    }
  }

  statusLabel(p: Protocol): string {
    if (p.status === 'active') return 'Attivo';
    if (p.status === 'draft') return 'Bozza';
    return 'Archiviato';
  }
}
