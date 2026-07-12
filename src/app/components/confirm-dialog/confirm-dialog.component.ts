import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ConfirmDialogService, ConfirmRequest } from '../../services/confirm-dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="confirmoverlay" [class.show]="visible" (click)="onOverlayClick($event)">
      <div class="confirmbox">
        <p class="confirmtext">{{ message }}</p>
        <div class="confirmbtns">
          <button class="confirmbtn cancel" (click)="answer(false)">Annulla</button>
          <button class="confirmbtn danger" (click)="answer(true)">Elimina</button>
        </div>
      </div>
    </div>
  `
})
export class ConfirmDialogComponent implements OnInit, OnDestroy {
  visible = false;
  message = '';
  private currentResolve: ((v: boolean) => void) | null = null;
  private queue: ConfirmRequest[] = [];
  private sub: Subscription | null = null;

  constructor(private svc: ConfirmDialogService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.sub = this.svc.request$.subscribe((req: ConfirmRequest) => {
      if (this.visible) {
        this.queue.push(req);
      } else {
        this.show(req);
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private show(req: ConfirmRequest): void {
    this.message = req.message;
    this.currentResolve = req.resolve;
    this.visible = true;
  }

  answer(result: boolean): void {
    this.visible = false;
    this.currentResolve?.(result);
    this.currentResolve = null;
    const next = this.queue.shift();
    if (next) {
      setTimeout(() => { this.show(next); this.cdr.detectChanges(); }, 250);
    }
  }

  onOverlayClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('confirmoverlay')) {
      this.answer(false);
    }
  }
}
