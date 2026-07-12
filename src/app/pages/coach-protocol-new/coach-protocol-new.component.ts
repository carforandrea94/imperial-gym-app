import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ProtocolService } from '../../services/protocol.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-coach-protocol-new',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './coach-protocol-new.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class CoachProtocolNewComponent implements OnInit, OnDestroy {
  clientId = '';
  creating = false;
  private paramSub: Subscription | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private protocolSvc: ProtocolService,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.paramSub = this.route.paramMap.subscribe(params => {
      this.clientId = params.get('clientId') ?? '';
    });
  }

  ngOnDestroy(): void {
    this.paramSub?.unsubscribe();
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
