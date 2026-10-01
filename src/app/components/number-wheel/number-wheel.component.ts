import {
  AfterViewInit, ChangeDetectorRef, Component, ElementRef, EventEmitter,
  Input, OnChanges, Output, SimpleChanges, ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  WheelSpec, wheelValues, wheelIndexAt, wheelIndexOf, wheelOffsetOfIndex
} from '../../core/utils/wheel.util';

/** Altezza di una tacca, in px. Lo stesso numero sta nel foglio di stile
 *  (.wheel-wrap.corta .wheel-item): se i due divergono, la ruota sceglie un
 *  valore diverso da quello che mostra al centro. */
export const WHEEL_ITEM_H = 36;

/**
 * Una ruota di numeri che si puo' anche scrivere.
 *
 * Si scorre per i cambi piccoli - mezzo chilo, una ripetizione - e si tocca il
 * numero al centro per scriverlo, che e' la via rapida quando il salto e'
 * grosso: da 30 a 60 kg sono sessanta tacche, ma due cifre sulla tastiera.
 * E' anche il motivo per cui scrivere resta: senza, il passo fine renderebbe
 * scomodo tutto quello che non e' vicino.
 *
 * Un numero scritto fuori dalla griglia (32,3 con passo 0,5) non viene
 * arrotondato: entra nella ruota al posto suo. Arrotondarlo vorrebbe dire
 * cambiare un numero che qualcuno ha scritto apposta.
 */
@Component({
  selector: 'app-number-wheel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="wheel-wrap corta" [class.disabled]="disabled" [class.writing]="editing">
  <div class="wheel-band" aria-hidden="true">
    <span class="unit" *ngIf="unit && !editing">{{ unit }}</span>
  </div>

  <!-- Si scrive dentro la banda, al posto del numero: e' lo stesso punto in
       cui lo si legge, quindi non c'e' niente da cercare. -->
  <input *ngIf="editing" #field class="wheel-write" type="text" inputmode="decimal"
    [(ngModel)]="draft" (keydown.enter)="commit()" (blur)="commit()"
    [attr.aria-label]="label || 'Valore'">

  <div class="wheel" #track (scroll)="onScroll()"
    [attr.role]="'listbox'" [attr.aria-label]="label || null">
    <button type="button" class="wheel-item" *ngFor="let v of values; let i = index"
      [class.on]="i === index"
      [attr.aria-selected]="i === index ? 'true' : 'false'"
      [disabled]="disabled"
      (click)="onItem(i)">{{ show(v) }}</button>
  </div>
</div>`
})
export class NumberWheelComponent implements AfterViewInit, OnChanges {
  /** Il valore scelto. null quando non si e' ancora scelto niente. */
  @Input() value: number | null = null;
  /** Il valore del protocollo, mostrato finche' non si sceglie. */
  @Input() placeholder: number | null = null;
  @Input() min = 0;
  @Input() max = 200;
  @Input() step = 0.5;
  @Input() unit = '';
  @Input() disabled = false;
  @Input() label = '';

  @Output() valueChange = new EventEmitter<number>();

  @ViewChild('track') trackEl?: ElementRef<HTMLDivElement>;
  @ViewChild('field') fieldEl?: ElementRef<HTMLInputElement>;

  values: number[] = [];
  index = 0;
  editing = false;
  draft = '';

  private get spec(): WheelSpec {
    return { min: this.min, max: this.max, step: this.step };
  }

  /** Quello su cui la ruota sta ferma: il valore scelto, o il suggerito. */
  private get current(): number | null {
    return this.value ?? this.placeholder;
  }

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnChanges(ch: SimpleChanges): void {
    this.rebuild();
    if (ch['value'] || ch['placeholder']) this.centre('auto');
  }

  ngAfterViewInit(): void {
    // Al primo disegno si salta, non si scorre: un'animazione da un valore mai
    // mostrato sarebbe solo un tremolio.
    this.centre('auto');
  }

  /** Come si scrive un numero qui: virgola, e niente decimali inutili. */
  show(v: number): string {
    return v.toString().replace('.', ',');
  }

  onScroll(): void {
    const el = this.trackEl?.nativeElement;
    if (!el || this.editing) return;
    const i = wheelIndexAt(el.scrollTop, WHEEL_ITEM_H, this.values.length);
    if (i === this.index) return;
    this.index = i;
    this.valueChange.emit(this.values[i]);
  }

  /** Tocco su una tacca: quella al centro si scrive, le altre ci si portano. */
  onItem(i: number): void {
    if (this.disabled) return;
    if (i === this.index) { this.edit(); return; }
    this.index = i;
    this.valueChange.emit(this.values[i]);
    this.scrollTo(i, 'smooth');
  }

  edit(): void {
    if (this.disabled) return;
    this.editing = true;
    this.draft = this.current === null ? '' : this.show(this.current);
    this.cdr.detectChanges();
    this.fieldEl?.nativeElement.select();
  }

  /** Chiude la scrittura. Un numero fuori forbice si riporta dentro, uno
   *  illeggibile lascia le cose come stavano. */
  commit(): void {
    if (!this.editing) return;
    this.editing = false;

    const n = parseFloat(this.draft.replace(',', '.'));
    if (isFinite(n)) {
      const v = Math.min(this.max, Math.max(this.min, n));
      this.rebuild(v);
      this.index = wheelIndexOf(this.values, v);
      this.valueChange.emit(this.values[this.index]);
    }
    this.cdr.detectChanges();
    this.centre('auto');
  }

  private rebuild(extra?: number): void {
    this.values = wheelValues(this.spec, extra ?? this.current);
    const i = wheelIndexOf(this.values, this.current);
    this.index = i < 0 ? 0 : i;
  }

  private centre(behavior: ScrollBehavior): void {
    // Dopo un giro di disegno: prima le tacche non esistono ancora e lo
    // scorrimento finirebbe su un contenitore vuoto.
    setTimeout(() => this.scrollTo(this.index, behavior));
  }

  private scrollTo(i: number, behavior: ScrollBehavior): void {
    this.trackEl?.nativeElement.scrollTo({ top: wheelOffsetOfIndex(i, WHEEL_ITEM_H), behavior });
  }
}
