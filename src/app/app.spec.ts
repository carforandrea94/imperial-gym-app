import { TestBed } from '@angular/core/testing';
import { provideServiceWorker } from '@angular/service-worker';
import { App } from './app';

function stubMatchMedia(matchesLight: boolean = false): void {
  (window as any).matchMedia = (query: string) => ({
    matches: query === '(prefers-color-scheme: light)' ? matchesLight : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

describe('App', () => {
  beforeEach(async () => {
    stubMatchMedia();
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideServiceWorker('ngsw-worker.js', { enabled: false })]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the router outlet', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });
});
