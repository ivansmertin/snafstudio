# Current-State Specification

## Project summary
This repository contains a single-page static website for **SNAF STUDIO** (Russian-language marketing/personal studio landing page) focused on design, frontend implementation, and launch support.

## Current architecture summary
- **HTML:** One document (`index.html`) containing all sections and loading external CSS/JS assets.
- **CSS:** Legacy monolith (`styles.css`) is preserved, and modular styles are now loaded through `styles/main.css` (`@import`-based aggregator).
- **JavaScript:** Interactive logic is now externalized in `js/main.js` (no framework, vanilla DOM APIs).
- **Assets:** Local SVG/PNG files under `images/` referenced directly from HTML/CSS.
- **Runtime model:** Client-side only, no backend or build pipeline.

## Important constraints
- Existing visual appearance and interaction behavior are baseline and must not regress.
- Section IDs are used for anchor navigation and scrollspy; changing them is high risk.
- JavaScript depends on existing class names and DOM structure.
- CSS selector names and ordering are compatibility-sensitive.

## Deployment assumptions (observed/probable)
- Observed: all paths are relative and static-host friendly.
- Confirmed: site works as plain static files (no transpilation, no bundling).

## Known current files
- `index.html`
- `styles.css` (legacy/original stylesheet retained)
- `styles/main.css`
- `styles/tokens.css`
- `styles/base.css`
- `styles/utilities.css`
- `styles/header.css`
- `styles/sections.css`
- `styles/hero.css`
- `styles/about.css`
- `styles/benefits.css`
- `styles/faq.css`
- `styles/footer.css`
- `styles/motion.css`
- `styles/responsive.css`
- `js/main.js`
- `images/logo.svg`
- `images/ivan.png`
- `images/heart-icon.svg`
- `images/wave.svg`
- `images/vk.svg`
- `images/tg.svg`

## Current frontend stack
- Semantic HTML5
- Vanilla CSS with custom properties, media queries, transitions/animations, and CSS `@import`
- Hover-driven lift effects are guarded by fine-pointer hover media queries to avoid sticky states on touch devices
- Vanilla JavaScript (`js/main.js`) using DOM APIs and IntersectionObserver
- Header navigation uses a desktop-only animated highlight pill; mobile/tablet navigation uses per-link active backgrounds inside the dropdown panel
- Google Fonts (`Montserrat`) via external stylesheet link

## Known risks
- **High risk:** changing class names/IDs used by JS handlers.
- **High risk:** modifying sticky header offset logic and anchor scroll behavior.
- **Medium risk:** adjusting carousel width/gap logic can break controls/progress calculations.
- **Medium risk:** FAQ open/close animation depends on runtime height measurement.
- **Medium risk:** reveal/counter behavior depends on IntersectionObserver thresholds and reduced-motion handling.
- **Medium risk:** mobile/tablet menu panel is anchored to the header shell; changing offsets/width rules can reintroduce clipping or overflow on narrow screens.
- **Low risk:** `.surface-glow` hover/reveal transition timing depends on `styles/motion.css` post-reveal override targeting both direct and nested descendants.
