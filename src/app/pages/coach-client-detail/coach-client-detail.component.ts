import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { doc, getDoc } from 'firebase/firestore';
import { FirebaseService } from '../../core/services/firebase.service';
import { ProtocolService } from '../../services/protocol.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ZoneFixService } from '../../core/utils/zone.util';
import { UserProfile } from '../../core/models/user.model';
import { Protocol } from '../../models/protocol.model';

@Component({
  selector: 'app-coach-client-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './coach-client-detail.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class CoachClientDetailComponent implements OnInit, OnDestroy {
  clientId = '';
  client: UserProfile | null = null;
  protocols: Protocol[] = [];
  loading = true;
  errorMsg = '';
  busyId: string | null = null;
  private paramSub: Subscription | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FirebaseService,
    private protocolSvc: ProtocolService,
    private confirm: ConfirmDialogService,
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

  statusLabel(p: Protocol): string {
    if (p.status === 'active') return 'Attivo';
    if (p.status === 'draft') return 'Bozza';
    return 'Archiviato';
  }
}
