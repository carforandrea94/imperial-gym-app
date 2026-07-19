import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ProtocolService } from '../../services/protocol.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { Protocol } from '../../models/protocol.model';

@Component({
  selector: 'app-coach-client-protocolli',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './coach-client-protocolli.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class CoachClientProtocolliComponent implements OnInit {
  clientId = '';
  protocols: Protocol[] = [];
  loading = true;
  errorMsg = '';
  busyId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private protocolSvc: ProtocolService,
    private confirm: ConfirmDialogService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.clientId = this.route.snapshot.paramMap.get('clientId') ?? '';
    this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.errorMsg = '';

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 12000)
    );

    try {
      this.protocols = await Promise.race([this.protocolSvc.listForClient(this.clientId), timeout]);
    } catch (e: any) {
      console.error('Errore caricamento protocolli:', e);
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
