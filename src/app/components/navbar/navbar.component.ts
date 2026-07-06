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
  @Input() showActions = false;

  @Output() backClick = new EventEmitter<void>();
  @Output() historyClick = new EventEmitter<void>();
  @Output() infoClick = new EventEmitter<void>();

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
