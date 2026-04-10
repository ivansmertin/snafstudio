# Project Map

## Current file tree
```text
.
├── AGENTS.md
├── PROJECT_MAP.md
├── QA_CHECKLIST.md
├── SPEC.md
├── index.html
├── js/
│   └── main.js
├── styles.css
├── styles/
│   ├── about.css
│   ├── base.css
│   ├── benefits.css
│   ├── faq.css
│   ├── footer.css
│   ├── header.css
│   ├── hero.css
│   ├── main.css
│   ├── motion.css
│   ├── responsive.css
│   ├── sections.css
│   ├── tokens.css
│   └── utilities.css
└── images/
    ├── heart-icon.svg
    ├── ivan.png
    ├── logo.svg
    ├── tg.svg
    ├── vk.svg
    └── wave.svg
```

## File responsibilities
- `index.html` — Entire page markup and static asset links (`styles/main.css`, `js/main.js`).
- `styles.css` — Preserved legacy monolithic stylesheet (kept for compatibility/history).
- `styles/main.css` — CSS aggregator with ordered `@import` statements only.
- `styles/tokens.css` — CSS custom properties (`:root`).
- `styles/base.css` — Reset/base rules, body, image, container, anchor offset primitives.
- `styles/utilities.css` — Shared button and glow utility rules.
- `styles/header.css` — Header, nav, burger, contacts, social icon rules.
- `styles/sections.css` — Shared section paddings and common section headings.
- `styles/hero.css` — Hero-specific layout and component styling.
- `styles/about.css` — About/author/stats styles; `.floating-accent` motion is intentionally disabled to avoid transform conflicts with hover lift.
- `styles/benefits.css` — Carousel controls/cards/progress styles (benefits cards are transparent at rest with no permanent card shadow).
- `styles/faq.css` — FAQ accordion and bottom CTA styles.
- `styles/footer.css` — Footer layout, links, socials, metadata styles.
- `styles/motion.css` — Reveal motion classes and reduced-motion overrides.
- `styles/responsive.css` — Width breakpoint media queries (`1100px`, `768px`, `560px`, `430px`) plus touch hover cleanup overrides.
- `js/main.js` — All interactive behavior (menu, nav highlight/scrollspy, reveal/counters, carousel, FAQ).
- `images/*` — Static brand/decorative/portrait assets.

## Key page sections in `index.html`
1. **Sticky header** (`#top`) with logo, desktop nav, mobile burger menu, contacts, and social links.
2. **Hero / Services** (`#services`) with value proposition and primary CTA.
3. **About / Author** (`#about`) with portrait and stats cards/counters.
4. **Benefits / Value** (`#value`) with horizontal carousel and progress indicator.
5. **FAQ** (`#faq`) accordion-style questions/answers plus bottom CTA block.
6. **Footer** with contacts, legal links placeholders, social links, and copyright.

## JavaScript behavior map (`js/main.js`)
- Header offset sync for anchor scrolling.
- Mobile burger menu open/close state and body scroll lock.
- Nav highlight pill + hover/focus/current state handling (desktop), with explicit mobile/tablet highlight disable guard.
- Scrollspy via IntersectionObserver.
- Reveal/stagger animations + animated counters.
- Benefits carousel controls and progress bar sync.
- FAQ accordion with ARIA state + animated panel heights.

## CSS module load order (`styles/main.css`)
1. `tokens.css`
2. `base.css`
3. `utilities.css`
4. `header.css`
5. `sections.css`
6. `hero.css`
7. `about.css`
8. `benefits.css`
9. `faq.css`
10. `footer.css`
11. `motion.css`
12. `responsive.css`
