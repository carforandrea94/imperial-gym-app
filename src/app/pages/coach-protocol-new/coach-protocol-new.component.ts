import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ProtocolService } from '../../services/protocol.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-coach-protocol-new',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './coach-protocol-new.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class CoachProtocolNewComponent {
  clientId = '';
  creating = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private protocolSvc: ProtocolService,
    private auth: AuthService
  ) {
    this.clientId = this.route.snapshot.paramMap.get('clientId') ?? '';
  }

  async createManual(): Promise<void> {
    if (this.creating) return;
    this.creating = true;
    const coach = this.auth.currentUser()!;
    const id = await this.protocolSvc.create(this.clientId, coach.uid);
    this.router.navigate(['/coach/clienti', this.clientId, 'builder', id]);
  }

  goToPdfImport(): void {
    this.router.navigate(['/coach/clienti', this.clientId, 'importa-pdf']);
  }
}
