import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface ConfirmRequest {
  message: string;
  /** Testo del bottone di conferma. Default 'Elimina' (uso storico: quasi tutte
   *  le conferme nell'app sono eliminazioni). Per conferme non distruttive
   *  (es. "Continuare?") va passato un testo pertinente. */
  confirmLabel: string;
  /** Stile del bottone di conferma: rosso/pericolo per azioni distruttive
   *  (default), colore accento per conferme non distruttive. */
  dangerous: boolean;
  resolve: (result: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private requestSubject = new Subject<ConfirmRequest>();
  request$ = this.requestSubject.asObservable();

  confirm(message: string, opts?: { confirmLabel?: string; dangerous?: boolean }): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      this.requestSubject.next({
        message,
        confirmLabel: opts?.confirmLabel ?? 'Elimina',
        dangerous: opts?.dangerous ?? true,
        resolve
      });
    });
  }
}
