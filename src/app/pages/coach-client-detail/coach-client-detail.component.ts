import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { doc, getDoc } from 'firebase/firestore';
import { FirebaseService } from '../../core/services/firebase.service';
import { ProtocolService } from '../../services/protocol.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { UserProfile } from '../../core/models/user.model';
import { Protocol } from '../../models/protocol.model';

@Component({
  selector: 'app-coach-client-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './coach-client-detail.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class CoachClientDetailComponent implements OnInit {
  clientId = '';
  client: UserProfile | null = null;
  protocols: Protocol[] = [];
  loading = true;
  busyId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FirebaseService,
    private protocolSvc: ProtocolService,
    private confirm: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.clientId = this.route.snapshot.paramMap.get('clientId') ?? '';
    this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    const snap = await getDoc(doc(this.fb.db, 'users', this.clientId));
    this.client = snap.exists() ? (snap.data() as UserProfile) : null;
    this.protocols = await this.protocolSvc.listForClient(this.clientId);
    this.loading = false;
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
    await this.protocolSvc.activate(this.clientId, p.id);
    await this.load();
    this.busyId = null;
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
