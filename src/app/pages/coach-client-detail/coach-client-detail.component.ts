import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { doc, getDoc } from 'firebase/firestore';
import { FirebaseService } from '../../core/services/firebase.service';
import { ZoneFixService } from '../../core/utils/zone.util';
import { UserProfile } from '../../core/models/user.model';

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
  loading = true;
  errorMsg = '';
  private paramSub: Subscription | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FirebaseService,
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
      this.client = await Promise.race([
        this.zoneFix.run((async () => {
          const snap = await getDoc(doc(this.fb.db, 'users', this.clientId));
          return snap.exists() ? (snap.data() as UserProfile) : null;
        })()),
        timeout
      ]);
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

  goToProtocolli(): void {
    this.router.navigate(['/coach/clienti', this.clientId, 'protocolli']);
  }

  goToProgressi(): void {
    this.router.navigate(['/coach/clienti', this.clientId, 'progressi']);
  }
}
