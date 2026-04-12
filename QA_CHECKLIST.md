# Manual QA Checklist (Post-change)

Use this after each frontend patch to guard against regressions.

## 1) Global sanity
- [ ] `index.html` loads `styles/main.css` with no 404.
- [ ] `index.html` loads `js/main.js` with `defer` and no 404.
- [ ] No broken image links (check logo, portrait, icons, decorative graphics).
- [ ] Browser console has no errors.

## 2) Desktop layout (>= 769px)
- [ ] Sticky header stays visible on scroll and does not overlap content incorrectly.
- [ ] Navigation links highlight/active state behaves correctly while scrolling.
- [ ] Nav highlight pill animates on desktop hover/click.
- [ ] Hero, About, Benefits, FAQ, Footer spacing and alignment look unchanged.
- [ ] Benefits cards in resting state do not look like gray/tinted plates (no permanent card underlay).
- [ ] Hover lift on stats/cards/FAQ feels stable (no jitter or slow post-reveal hover response).

## 3) Mobile layout (< 769px)
- [ ] Burger button opens/closes menu.
- [ ] Menu open state locks body scroll and closes after nav link click.
- [ ] Mobile nav remains aligned and usable, opens below header shell, and has no horizontal overflow.
- [ ] No floating `.nav-highlight`/blue pill artifact appears in mobile/tablet menu.
- [ ] Mobile nav links are full-width, centered, and keep a stable in-link active state.
- [ ] No sticky hover states on touch for nav links, buttons, phone, social icons, footer socials, or slider controls.

## 4) Navigation and anchors
- [ ] Header links scroll to correct sections (`#services`, `#about`, `#value`, `#faq`).
- [ ] Footer/top links scroll correctly (`#top`).
- [ ] Scroll offset is correct (section headings not hidden under sticky header).

## 5) CTA and links
- [ ] Primary CTA buttons work (Telegram, phone links).
- [ ] External links with new tabs still open correctly where expected.

## 6) Interactive components
- [ ] Reveal/scroll animations trigger correctly.
- [ ] Counter animation in stats section reaches expected values.
- [ ] With reduced motion enabled, counters render final values immediately and transitions are effectively disabled.
- [ ] Benefits carousel prev/next buttons scroll cards as expected.
- [ ] Carousel progress indicator updates while scrolling.
- [ ] FAQ accordion opens/closes correctly; only one item remains open at a time; item 3 is open by default.

## 7) Asset/path checks
- [ ] About wave background is visible (path resolves from module CSS via `../images/wave.svg`).

## 8) Breakpoint regression check
- [ ] Layout remains stable at `1024px`, `768px`, `560px`, `428px`, and `390px` widths (desktop visuals unchanged at and above `769px`).
- [ ] No unintended typography/color/spacing/shadow changes.
- [ ] No clipping/overflow issues introduced.

## 9) Static deployment check
- [ ] Site works when opening `index.html` directly as static files (no build tooling required).
