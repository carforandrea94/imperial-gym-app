import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, NewClientResult } from '../../core/services/auth.service';
import { UserProfile } from '../../core/models/user.model';

@Component({
  selector: 'app-coach-clienti',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './coach-clienti.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class CoachClientiComponent implements OnInit {
  clients: UserProfile[] = [];
  loading = true;

  showForm = false;
  newName = '';
  newEmail = '';
  creating = false;
  errorMsg = '';

  createdResult: NewClientResult | null = null;

  constructor(private auth: AuthService) {}

  ngOnInit(): void {
    this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.clients = await this.auth.listClients();
    this.loading = false;
  }

  openForm(): void {
    this.showForm = true;
    this.newName = '';
    this.newEmail = '';
    this.errorMsg = '';
    this.createdResult = null;
  }

  cancelForm(): void {
    this.showForm = false;
  }

  async createClient(): Promise<void> {
    if (!this.newName.trim() || !this.newEmail.trim()) return;
    this.creating = true;
    this.errorMsg = '';
    try {
      this.createdResult = await this.auth.createClientAccount(this.newName, this.newEmail);
      await this.load();
    } catch (e: any) {
      if (e?.code === 'auth/email-already-in-use') {
        this.errorMsg = 'Questa email e\' gia\' registrata.';
      } else {
        this.errorMsg = e?.message || 'Errore durante la creazione. Riprova.';
      }
    } finally {
      this.creating = false;
    }
  }

  doneWithResult(): void {
    this.showForm = false;
    this.createdResult = null;
  }
}
