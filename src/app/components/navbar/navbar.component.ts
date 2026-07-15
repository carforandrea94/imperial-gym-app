import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.component.html'
})
export class NavbarComponent implements OnInit, OnDestroy {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() showBack = false;
  @Input() showHistory = false;
  @Input() showInfo = false;
  @Input() showAnalytics = false;
  @Input() showShoppingList = false;
  @Input() showViewToggle = false;
  @Input() viewMode: 'list' | 'slider' = 'list';
  @Input() showSaveWorkout = false;
  @Input() saveStatus: 'idle' | 'saving' | 'saved' | 'err' = 'idle';
  @Input() showSettings = false;
  @Input() showSaveEdit = false;
  @Input() saveEditSaving = false;
  @Input() showProtocolSave = false;
  @Input() protocolSaving = false;

  @Output() backClick = new EventEmitter<void>();
  @Output() historyClick = new EventEmitter<void>();
  @Output() infoClick = new EventEmitter<void>();
  @Output() analyticsClick = new EventEmitter<void>();
  @Output() shoppingListClick = new EventEmitter<void>();
  @Output() viewModeChange = new EventEmitter<'list' | 'slider'>();
  @Output() saveWorkoutClick = new EventEmitter<void>();
  @Output() settingsClick = new EventEmitter<void>();
  @Output() saveEditClick = new EventEmitter<void>();
  @Output() saveDraftClick = new EventEmitter<void>();
  @Output() saveActivateClick = new EventEmitter<void>();

  ngOnInit(): void {
    window.addEventListener('scroll', this.onScroll, { passive: true });
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onScroll);
  }

  private onScroll = (): void => {
    if (window.scrollY > 10) {
      document.body.classList.add('scrolled');
    } else {
      document.body.classList.remove('scrolled');
    }
  };
}
