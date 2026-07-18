# Rest-timer modal → bottom sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the "Recupero" (rest-timer settings) modal in `scheda-detail` from a centered dialog into a bottom sheet that slides up from the bottom edge of the screen and covers the tabbar, without touching the CSS classes shared with `ConfirmDialogComponent`.

**Architecture:** Introduce new, dedicated CSS classes (`.resttimer-sheet-overlay`, `.resttimer-sheet`) that mirror the structure of the existing `.confirmoverlay`/`.confirmbox` pair but anchor to the bottom of the viewport and animate with a `transform: translateY(...)` slide, following the same pattern already used by the always-mounted `.resttimer` widget (`src/app/components/rest-timer/rest-timer.component.ts`). The modal's inner content, template bindings, and public methods are unchanged — only container class names, one internal method body, and the CSS are touched.

**Tech Stack:** Angular 21 standalone component (`SchedaDetailComponent`), plain CSS in `src/styles.css`, no new dependencies.

## Global Constraints

- Do NOT modify `.confirmoverlay`, `.confirmbox`, `.confirmbox::before`, `.confirmbox > *`, `.confirmtext`, `.confirmbtns`, `.confirmbtn` (base) rules — these are shared with `ConfirmDialogComponent` (`src/app/components/confirm-dialog/confirm-dialog.component.ts`) and must render identically before and after this change.
- The rest-timer sheet must cover the tabbar and reach the true bottom edge of the screen (approved Option B) — top corners only rounded (~24px), bottom padding accounts for `var(--safe-b)`.
- Slide animation must mirror the existing `.resttimer` widget pattern: `transform: translateY(...)` + `transition: transform .45s var(--spring), opacity .3s ease`, starting from fully off-screen (`translateY(100%)`, since unlike `.resttimer` this sheet is not "already peeking" above the tabbar).
- The new sheet's glass/chrome refraction (`::before` backdrop-filter) must be added additively to the existing shared selector group at `src/styles.css:467-479`, and the corresponding accessibility fallbacks at `src/styles.css:527-534` (`prefers-reduced-transparency`) and `src/styles.css:535-538` (`prefers-reduced-motion`) must also list the new selector, since those fallbacks exist specifically to disable the effect this task adds elsewhere.
- No changes to `rest-stepper`, `rest-stepbtn`, `rest-value`, `rest-defaultbtn`, `restmodal-title`, `confirmtext`, `confirmbtns`, `confirmbtn` (including `.confirmbtn.cancel`, `.confirmbtn.danger`, `.confirmbtn.restsave`) rules — these already render correctly and are reused as-is inside the new sheet container.
- Inner modal content (title, stepper, default button, Annulla/Salva buttons) and all existing methods (`adjustRestModalValue`, `resetRestModalToDefault`, `saveRestModal`, `parseRecSecondsPublic`, `formatRest`) are unchanged.

---

## Background: why one small TS change is required

The current template guards the modal body with `*ngIf="restModalVm"`, and `closeRestModal()` (in `scheda-detail.component.ts:324-327`) nulls `restModalVm` synchronously when closing:

```ts
closeRestModal(): void {
  this.restModalOpen = false;
  this.restModalVm = null;
}
```

`*ngIf` removes the element from the DOM the instant the bound expression becomes falsy — there is no time for a CSS `transition` to play, so nulling `restModalVm` on close would make the sheet disappear instantly instead of sliding down.

The codebase already solves exactly this problem for the `.resttimer` widget (`src/app/components/rest-timer/rest-timer.component.ts:10`): that element has **no** `*ngIf` at all — it stays permanently mounted and is shown/hidden purely via a `[class.show]` binding, so the CSS transition always has an element to animate.

This plan applies the same fix: stop nulling `restModalVm` in `closeRestModal()`. The `*ngIf="restModalVm"` guard remains in the template (it still correctly hides the sheet before the very first open, when `restModalVm` is genuinely `null` at field-declaration time), but after the first open it stays truthy forever, so the sheet element remains mounted and its `.show` class transition can animate both in and out. This does not change any user-visible behavior of the data itself — the stale `restModalVm` is never displayed while `restModalOpen` is `false` because the overlay's `display: none` (governed by `.show`) hides it.

## File Structure

- `src/app/pages/scheda-detail/scheda-detail.component.ts` — one-line removal in `closeRestModal()`; one string literal change in `onRestOverlayClick()`.
- `src/app/pages/scheda-detail/scheda-detail.component.html` — rename the modal's two outer container classes and add a grabber handle element (lines 131-149).
- `src/styles.css` — new rules for `.resttimer-sheet-overlay` / `.resttimer-sheet` / `.resttimer-sheet.show` / `.resttimer-sheet .grabber`; additive extension of the three existing shared selector groups (chrome refraction, reduced-transparency fallback, reduced-motion fallback).

---

### Task 1: Convert the rest-timer modal into a bottom sheet

**Files:**
- Modify: `src/app/pages/scheda-detail/scheda-detail.component.ts:324-333`
- Modify: `src/app/pages/scheda-detail/scheda-detail.component.html:131-149`
- Modify: `src/styles.css:467-479` (chrome refraction selector), `src/styles.css:527-538` (accessibility fallbacks), and a new rule block added after the existing `/* ===== CONFIRM DIALOG ===== */` section (around line 439-440)

**Interfaces:**
- Consumes: existing public methods `onRestOverlayClick(event)`, `closeRestModal()`, `adjustRestModalValue(delta)`, `resetRestModalToDefault()`, `saveRestModal()`, `formatRest(seconds)`, `parseRecSecondsPublic()`, and fields `restModalOpen: boolean`, `restModalVm: ExerciseVM | null`, `restModalValue: number` — none of their signatures change.
- Produces: nothing consumed by other tasks (this is the only task in the plan).

- [ ] **Step 1: Update `closeRestModal()` to keep the sheet mounted for the closing animation**

In `src/app/pages/scheda-detail/scheda-detail.component.ts`, find:

```ts
  closeRestModal(): void {
    this.restModalOpen = false;
    this.restModalVm = null;
  }
```

Replace with:

```ts
  closeRestModal(): void {
    this.restModalOpen = false;
  }
```

- [ ] **Step 2: Update `onRestOverlayClick()` to check the new overlay class name**

In the same file, find:

```ts
  onRestOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('confirmoverlay')) {
      this.closeRestModal();
    }
  }
```

Replace with:

```ts
  onRestOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('resttimer-sheet-overlay')) {
      this.closeRestModal();
    }
  }
```

- [ ] **Step 3: Rename the modal's container classes in the template and add the grabber handle**

In `src/app/pages/scheda-detail/scheda-detail.component.html`, find (lines 131-149):

```html
<div class="confirmoverlay" [class.show]="restModalOpen" (click)="onRestOverlayClick($event)">
  <div class="confirmbox restbox" *ngIf="restModalVm">
    <p class="confirmtext restmodal-title">
      Recupero — {{ restModalVm.ex.name }}
    </p>
    <div class="rest-stepper">
      <button class="rest-stepbtn" (click)="adjustRestModalValue(-15)">–15</button>
      <div class="rest-value">{{ formatRest(restModalValue) }}</div>
      <button class="rest-stepbtn" (click)="adjustRestModalValue(15)">+15</button>
    </div>
    <button class="rest-defaultbtn" (click)="resetRestModalToDefault()">
      Usa il default del protocollo ({{ formatRest(parseRecSecondsPublic()) }})
    </button>
    <div class="confirmbtns">
      <button class="confirmbtn cancel" (click)="closeRestModal()">Annulla</button>
      <button class="confirmbtn danger restsave" (click)="saveRestModal()">Salva</button>
    </div>
  </div>
</div>
```

Replace with:

```html
<div class="resttimer-sheet-overlay" [class.show]="restModalOpen" (click)="onRestOverlayClick($event)">
  <div class="resttimer-sheet" [class.show]="restModalOpen" *ngIf="restModalVm">
    <div class="grabber"></div>
    <p class="confirmtext restmodal-title">
      Recupero — {{ restModalVm.ex.name }}
    </p>
    <div class="rest-stepper">
      <button class="rest-stepbtn" (click)="adjustRestModalValue(-15)">–15</button>
      <div class="rest-value">{{ formatRest(restModalValue) }}</div>
      <button class="rest-stepbtn" (click)="adjustRestModalValue(15)">+15</button>
    </div>
    <button class="rest-defaultbtn" (click)="resetRestModalToDefault()">
      Usa il default del protocollo ({{ formatRest(parseRecSecondsPublic()) }})
    </button>
    <div class="confirmbtns">
      <button class="confirmbtn cancel" (click)="closeRestModal()">Annulla</button>
      <button class="confirmbtn danger restsave" (click)="saveRestModal()">Salva</button>
    </div>
  </div>
</div>
```

Note: `[class.show]="restModalOpen"` is now bound on **both** the overlay (controls backdrop visibility via `display`) and the sheet itself (controls the slide transform) — matching the two-part show/hide used elsewhere is not needed here since both elements share the same boolean, but each needs its own `.show` rule (overlay uses `display`, sheet uses `transform`/`opacity`), so both need the class.

- [ ] **Step 4: Add the new bottom-sheet CSS rules**

In `src/styles.css`, after the existing `/* ===== CONFIRM DIALOG ===== */` block (after line 439, `.confirmbtn.danger{...}`, and before `/* ===== UTILS ===== */`), add:

```css
/* ===== REST TIMER — BOTTOM SHEET ===== */
.resttimer-sheet-overlay{position:fixed;inset:0;z-index:100;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.55);}
.resttimer-sheet-overlay.show{display:flex;}
.resttimer-sheet{position:relative;width:100%;max-width:608px;margin:0 auto;border-top-left-radius:24px;border-top-right-radius:24px;padding:10px 20px calc(var(--safe-b) + 16px);background:var(--content-glass-bg);backdrop-filter:blur(16px) saturate(135%);-webkit-backdrop-filter:blur(16px) saturate(135%);border:1px solid var(--content-glass-border);border-bottom:none;box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 -20px 50px rgba(0,0,0,.5);transform:translateY(100%);opacity:0;pointer-events:none;transition:transform .45s var(--spring),opacity .3s ease;}
.resttimer-sheet.show{transform:translateY(0);opacity:1;pointer-events:auto;}
.resttimer-sheet > *{position:relative;z-index:1;}
.resttimer-sheet .grabber{width:36px;height:4px;border-radius:2px;background:var(--content-glass-border);margin:0 auto 14px;}
```

This block deliberately reuses `.confirmtext`, `.confirmbtns`, `.confirmbtn`, `.restmodal-title`, `.rest-stepper`, `.rest-stepbtn`, `.rest-value`, `.rest-defaultbtn` unchanged from the existing `CONFIRM DIALOG` / rest-modal-content rules already defined earlier in the file (around lines 190-197 and 435-439) — none of those are touched.

- [ ] **Step 5: Extend the shared chrome-refraction selector additively**

In `src/styles.css`, find (around line 467-479):

```css
.tabbar::before,
.resttimer::before,
.rocker::before,
.confirmbox::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: inherit;
  pointer-events: none;
  backdrop-filter: blur(1px) saturate(110%);
  -webkit-backdrop-filter: blur(1px) saturate(110%);
}
```

Replace with:

```css
.tabbar::before,
.resttimer::before,
.rocker::before,
.confirmbox::before,
.resttimer-sheet::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: inherit;
  pointer-events: none;
  backdrop-filter: blur(1px) saturate(110%);
  -webkit-backdrop-filter: blur(1px) saturate(110%);
}
```

- [ ] **Step 6: Extend the accessibility fallbacks to match**

In `src/styles.css`, find (around line 527-534):

```css
@media (prefers-reduced-transparency: reduce) {
  .tabbar::before, .resttimer::before,
  .rocker::before, .confirmbox::before,
  .tabbar::after, .resttimer::after, .rocker::after,
  .daycard::after, .ex::after, .meal::after, .infocard::after, .weekpicker::after {
    display: none;
  }
}
```

Replace with:

```css
@media (prefers-reduced-transparency: reduce) {
  .tabbar::before, .resttimer::before,
  .rocker::before, .confirmbox::before, .resttimer-sheet::before,
  .tabbar::after, .resttimer::after, .rocker::after,
  .daycard::after, .ex::after, .meal::after, .infocard::after, .weekpicker::after {
    display: none;
  }
}
```

Then find (around line 535-538):

```css
@media (prefers-reduced-motion: reduce) {
  .tabbar::before, .resttimer::before,
  .rocker::before, .confirmbox::before { filter: none; -webkit-filter: none; }
}
```

Replace with:

```css
@media (prefers-reduced-motion: reduce) {
  .tabbar::before, .resttimer::before,
  .rocker::before, .confirmbox::before, .resttimer-sheet::before { filter: none; -webkit-filter: none; }
}
```

- [ ] **Step 7: Verify the app still builds and the existing test suite passes**

Run:

```bash
npx ng build
```

Expected: build succeeds with no new errors or warnings referencing `scheda-detail` or `styles.css`.

Run:

```bash
npx ng test --watch=false
```

Expected: all existing tests still pass (no test exists today for `scheda-detail` or the rest-timer modal specifically, so no test count should change — this run is a regression check).

- [ ] **Step 8: Manual visual verification (record as a checklist in the PR, cannot be automated in this environment)**

Confirm by running the app (`npx ng serve`) and opening a workout day's exercise detail:
- Tapping the rest-timer chip opens a sheet that slides up from the bottom, covering the tabbar, with rounded top corners and a grabber handle.
- The stepper (−15/+15), the "Usa il default del protocollo" button, and Annulla/Salva behave exactly as before.
- Tapping Annulla or the dark backdrop slides the sheet back down before it disappears (no instant pop).
- Tapping Salva closes the sheet the same way and persists the new value (pre-existing `saveRestModal()` behavior, unchanged).
- Open a delete confirmation elsewhere in the app (e.g., history-detail "Elimina") and confirm `ConfirmDialogComponent` still renders as a centered dialog, completely unaffected.

- [ ] **Step 9: Commit**

```bash
git add src/app/pages/scheda-detail/scheda-detail.component.ts \
        src/app/pages/scheda-detail/scheda-detail.component.html \
        src/styles.css
git commit -m "Trasforma il modal Recupero in bottom sheet"
```

---

## Self-Review Notes

- **Spec coverage:** dedicated classes (Steps 3-4) ✅, bottom anchoring covering tabbar / Option B (Step 4, `align-items:flex-end`, no bottom radius, no `bottom` gap) ✅, top-only rounded corners 24px (Step 4) ✅, safe-area bottom padding (Step 4, `calc(var(--safe-b) + 16px)`) ✅, grabber handle (Steps 3-4) ✅, slide animation mirroring `.resttimer` (Step 4, `translateY`/`var(--spring)`) ✅, backdrop-click-to-close preserved (Steps 1-2, 3) ✅, additive chrome-refraction + fallbacks (Steps 5-6) ✅, `.confirmoverlay`/`.confirmbox`/`.restbox` untouched (confirmed no edits to those rules anywhere in this plan) ✅.
- **Placeholder scan:** no TBD/TODO; every step shows exact before/after code.
- **Type consistency:** no new methods or types introduced; the one changed method (`closeRestModal`) and one changed string literal (`onRestOverlayClick`) are shown with exact before/after bodies.
- **Scope:** single cohesive task — template, one TS behavioral fix required for the approved animation to function, and CSS all land together since none of them is independently useful or testable alone.
