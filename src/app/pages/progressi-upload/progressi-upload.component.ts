import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ProgressiDataService } from '../../services/progressi-data.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../services/toast.service';
import { resizeImageFile } from '../../core/utils/image-resize.util';
import { todayLocalISO } from '../../core/utils/date.util';
import { ProgressiPhotoType, PROGRESSI_PHOTO_TYPES, PROGRESSI_PHOTO_LABELS } from '../../models/progressi.model';

interface PhotoSlot {
  type: ProgressiPhotoType;
  label: string;
  file: File | null;
  previewUrl: string | null;
}

@Component({
  selector: 'app-progressi-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './progressi-upload.component.html',
  styles: [`:host { display: block; animation: fade .4s var(--spring-soft); }`]
})
export class ProgressiUploadComponent {
  slots: PhotoSlot[] = PROGRESSI_PHOTO_TYPES.map(type => ({
    type,
    label: PROGRESSI_PHOTO_LABELS[type],
    file: null,
    previewUrl: null
  }));
  saving = false;

  constructor(
    private router: Router,
    private data: ProgressiDataService,
    private auth: AuthService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  get canSave(): boolean {
    return this.slots.every(s => !!s.file);
  }

  onFileSelected(slot: PhotoSlot, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    slot.file = file;
    if (slot.previewUrl) URL.revokeObjectURL(slot.previewUrl);
    slot.previewUrl = URL.createObjectURL(file);
  }

  async save(): Promise<void> {
    if (!this.canSave || this.saving) return;
    this.saving = true;
    this.cdr.detectChanges();
    try {
      const date = todayLocalISO();
      const uid = this.auth.currentUser()!.uid;
      // L'ordine di slots segue PROGRESSI_PHOTO_TYPES ['fronte','retro','laterale']
      const [fronte, retro, laterale] = await Promise.all(
        this.slots.map(s => resizeImageFile(s.file!))
      );
      await this.data.save(uid, date, { fronte, retro, laterale });
      this.toast.success('Progresso salvato');
      this.router.navigate(['/misure/progressi']);
    } catch (e) {
      console.error('Errore salvataggio progressi:', e);
      this.toast.error('Errore nel salvataggio. Riprova.');
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }
}
