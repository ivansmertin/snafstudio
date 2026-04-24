document.addEventListener("DOMContentLoaded", () => {
    const siteConfig = window.SNAF_CONFIG || {
        consentStorageKey: "snafstudio-cookie-consent",
        analytics: {
            yandexMetrikaId: "",
            gaMeasurementId: "",
            yandexGoalName: "cta_click"
        }
    };
    const analyticsConfig = siteConfig.analytics || {};
    const consentStorageKey = siteConfig.consentStorageKey || "snafstudio-cookie-consent";
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktopMedia = window.matchMedia("(min-width: 921px)");
    const focusableSelector = [
        "a[href]",
        "button:not([disabled])",
        "input:not([disabled]):not([type='hidden'])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        "[tabindex]:not([tabindex='-1'])"
    ].join(", ");
    const isAppleDevice = (() => {
        const platform = navigator.userAgentData?.platform || navigator.platform || "";
        const userAgent = navigator.userAgent || "";
        return /Mac|iPad|iPhone|iPod/.test(platform) || /Macintosh|iPad|iPhone|iPod/.test(userAgent);
    })();

    const header = document.querySelector(".header");
    const burgerButton = document.querySelector(".burger-btn");
    const menuOverlay = document.querySelector(".menu-overlay");
    const navWrap = document.querySelector(".main-nav-wrap");
    const nav = document.querySelector(".main-nav");
    const navLinks = nav ? Array.from(nav.querySelectorAll(".nav-link")) : [];
    const carouselTrack = document.getElementById("benefitsCarousel");
    const prevBtn = document.querySelector(".prev-btn");
    const nextBtn = document.querySelector(".next-btn");
    const progressFill = document.querySelector(".carousel-progress-fill");
    const carouselStatus = document.getElementById("benefitsCarouselStatus");
    const cookieBanner = document.querySelector(".cookie-banner");

    let motionReduced = reducedMotionQuery.matches;
    let navHighlight = null;
    let activeNavLink = null;
    let previewNavLink = null;
    let analyticsInitialized = false;
    let revealObserver = null;
    let lastFocusedMenuTrigger = null;
    let lastCarouselAnnouncement = "";
    let scrollAnimationFrame = 0;

    const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
    const getScrollBehavior = () => (motionReduced ? "auto" : "smooth");
    const isMenuOpen = () => Boolean(navWrap?.classList.contains("is-open"));
    const getCookieConsent = () => {
        try {
            return window.localStorage.getItem(consentStorageKey) === "accepted";
        } catch {
            return false;
        }
    };

    const setCookieConsent = () => {
        try {
            window.localStorage.setItem(consentStorageKey, "accepted");
        } catch {
            // Ignore storage failures in restrictive browser modes.
        }
    };

    const hideCookieBanner = () => {
        if (!cookieBanner) return;
        cookieBanner.hidden = true;
        cookieBanner.classList.add("is-hidden");
    };

    const showCookieBanner = () => {
        if (!cookieBanner) return;
        cookieBanner.hidden = false;
        cookieBanner.classList.remove("is-hidden");
    };

    const trackPrimaryCtaClick = () => {
        const goalName = analyticsConfig.yandexGoalName || "cta_click";

        if (typeof window.ym === "function" && analyticsConfig.yandexMetrikaId) {
            window.ym(analyticsConfig.yandexMetrikaId, "reachGoal", goalName);
        }

        if (typeof window.gtag === "function" && analyticsConfig.gaMeasurementId) {
            window.gtag("event", goalName, {
                event_category: "engagement",
                event_label: "primary_cta"
            });
        }
    };

    const initAnalytics = () => {
        if (analyticsInitialized || !getCookieConsent()) return;

        const hasConfiguredAnalytics = Boolean(
            analyticsConfig.yandexMetrikaId || analyticsConfig.gaMeasurementId
        );

        if (!hasConfiguredAnalytics) return;

        document.querySelectorAll(".btn--primary:not(.cookie-banner__accept)").forEach((button) => {
            button.addEventListener("click", trackPrimaryCtaClick);
        });

        analyticsInitialized = true;
    };

    const initCookieBanner = () => {
        if (!cookieBanner) {
            initAnalytics();
            return;
        }

        const acceptButton = cookieBanner.querySelector(".cookie-banner__accept");

        if (getCookieConsent()) {
            hideCookieBanner();
            initAnalytics();
            return;
        }

        showCookieBanner();

        acceptButton?.addEventListener("click", () => {
            setCookieConsent();
            hideCookieBanner();
            initAnalytics();
        });
    };

    const setHeaderOffset = () => {
        const offset = (header?.offsetHeight || 80) + 12;
        document.documentElement.style.setProperty("--header-offset", `${offset}px`);
    };

    const getSamePageHash = (link) => {
        const href = link?.getAttribute("href");
        if (!href) return "";
        if (href.startsWith("#")) return href;

        try {
            const url = new URL(href, window.location.href);
            if (url.origin === window.location.origin && url.pathname === window.location.pathname) {
                return url.hash || "";
            }
        } catch {
            return "";
        }

        return "";
    };

    const getLinkHash = (linkOrHref) => {
        const href = typeof linkOrHref === "string"
            ? linkOrHref
            : linkOrHref?.getAttribute("href");

        if (!href) return "";
        if (href.startsWith("#")) return href;

        try {
            return new URL(href, window.location.href).hash || "";
        } catch {
            return "";
        }
    };

    const getElementForHash = (hash) => {
        if (!hash) return null;
        if (hash === "#top") {
            return document.getElementById("top") || document.body;
        }

        return document.getElementById(hash.replace("#", ""));
    };

    const scrollToPosition = (targetTop, { instant = false } = {}) => {
        const finalTop = Math.max(targetTop, 0);

        if (scrollAnimationFrame) {
            cancelAnimationFrame(scrollAnimationFrame);
            scrollAnimationFrame = 0;
        }

        if (instant || motionReduced) {
            window.scrollTo({ top: finalTop, behavior: "auto" });
            return Promise.resolve();
        }

        if (!isAppleDevice) {
            window.scrollTo({ top: finalTop, behavior: getScrollBehavior() });
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            const startTop = window.scrollY;
            const delta = finalTop - startTop;

            if (Math.abs(delta) < 2) {
                window.scrollTo({ top: finalTop, behavior: "auto" });
                resolve();
                return;
            }

            const duration = Math.min(720, Math.max(360, Math.abs(delta) * 0.55));
            let startTime = 0;

            const step = (currentTime) => {
                if (!startTime) {
                    startTime = currentTime;
                }

                const progress = Math.min((currentTime - startTime) / duration, 1);
                window.scrollTo(0, startTop + delta * easeOutExpo(progress));

                if (progress < 1) {
                    scrollAnimationFrame = requestAnimationFrame(step);
                    return;
                }

                scrollAnimationFrame = 0;
                resolve();
            };

            scrollAnimationFrame = requestAnimationFrame(step);
        });
    };

    const scrollToHash = (
        hash,
        { updateHistory = true, instant = false, focusTarget = false } = {}
    ) => {
        const target = getElementForHash(hash);
        if (!target) return false;

        const targetTop = hash === "#top"
            ? 0
            : target.getBoundingClientRect().top + window.scrollY - (header?.offsetHeight || 80) - 12;

        const scrollPromise = scrollToPosition(targetTop, { instant });

        if (updateHistory) {
            window.history.pushState(null, "", hash);
        }

        if (focusTarget && target instanceof HTMLElement) {
            scrollPromise.then(() => {
                target.focus({ preventScroll: true });
            });
        }

        return true;
    };

    const getNavLinkByHash = (hash = window.location.hash) => (
        navLinks.find((link) => getLinkHash(link) === hash) || null
    );

    const setMenuOverlayState = (open) => {
        if (!menuOverlay) return;
        menuOverlay.classList.toggle("is-visible", open);
        menuOverlay.setAttribute("aria-hidden", String(!open));
    };

    const updateMenuSemantics = (open) => {
        if (!navWrap) return;

        const shouldHide = !open && !desktopMedia.matches;
        navWrap.setAttribute("aria-hidden", String(shouldHide));

        if (open && !desktopMedia.matches) {
            navWrap.setAttribute("role", "dialog");
            navWrap.setAttribute("aria-modal", "true");
            navWrap.setAttribute("aria-label", "Мобильное меню");
            return;
        }

        navWrap.removeAttribute("role");
        navWrap.removeAttribute("aria-modal");
        navWrap.removeAttribute("aria-label");
    };

    const getFocusableElements = (root) => {
        if (!root) return [];

        return Array.from(root.querySelectorAll(focusableSelector)).filter((element) => {
            if (!(element instanceof HTMLElement)) return false;
            if (element.getAttribute("aria-hidden") === "true") return false;
            return element.getClientRects().length > 0;
        });
    };

    const getMenuFocusableElements = () => {
        const menuFocusables = getFocusableElements(navWrap);
        return [burgerButton, ...menuFocusables].filter(Boolean);
    };

    const focusFirstMenuItem = () => {
        const menuFocusables = getMenuFocusableElements();
        const target = menuFocusables[1] || menuFocusables[0];
        target?.focus();
    };

    const trapFocusInMenu = (event) => {
        if (event.key !== "Tab" || !isMenuOpen() || desktopMedia.matches) return;

        const menuFocusables = getMenuFocusableElements();
        if (!menuFocusables.length) return;

        const first = menuFocusables[0];
        const last = menuFocusables[menuFocusables.length - 1];

        if (!menuFocusables.includes(document.activeElement)) {
            event.preventDefault();
            first.focus();
            return;
        }

        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
            return;
        }

        if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    };

    const closeMenu = ({ restoreFocus = true } = {}) => {
        if (!burgerButton || !navWrap) return;
        burgerButton.classList.remove("is-active");
        burgerButton.setAttribute("aria-expanded", "false");
        burgerButton.setAttribute("aria-label", "Открыть меню");
        navWrap.classList.remove("is-open");
        document.body.classList.remove("menu-open");
        setMenuOverlayState(false);
        updateMenuSemantics(false);

        if (restoreFocus && !desktopMedia.matches) {
            const target = lastFocusedMenuTrigger || burgerButton;
            requestAnimationFrame(() => target?.focus());
        }
    };

    const openMenu = () => {
        if (!burgerButton || !navWrap) return;

        lastFocusedMenuTrigger = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : burgerButton;

        burgerButton.classList.add("is-active");
        burgerButton.setAttribute("aria-expanded", "true");
        burgerButton.setAttribute("aria-label", "Закрыть меню");
        navWrap.classList.add("is-open");
        document.body.classList.add("menu-open");
        setMenuOverlayState(true);
        updateMenuSemantics(true);

        if (!desktopMedia.matches) {
            requestAnimationFrame(() => {
                focusFirstMenuItem();
            });
        }
    };

    const toggleMenu = () => {
        if (isMenuOpen()) {
            closeMenu();
        } else {
            openMenu();
        }
    };

    const updateNavClasses = (currentLink, highlightedLink = currentLink) => {
        navLinks.forEach((link) => {
            const isCurrent = Boolean(currentLink && link === currentLink);
            const isHighlighted = Boolean(highlightedLink && link === highlightedLink);

            link.classList.toggle("is-current", isCurrent);
            link.classList.toggle("is-highlighted", isHighlighted);
            if (isCurrent) {
                link.setAttribute("aria-current", "location");
            } else {
                link.removeAttribute("aria-current");
            }
        });
    };

    const ensureNavHighlight = () => {
        if (!desktopMedia.matches || !nav) return null;
        if (!navHighlight) {
            navHighlight = document.createElement("span");
            navHighlight.className = "nav-highlight";
            nav.prepend(navHighlight);
        }
        nav.classList.add("has-highlight");
        return navHighlight;
    };

    const disableNavHighlight = () => {
        if (!nav) return;
        nav.classList.remove("has-highlight");
        if (navHighlight) {
            navHighlight.remove();
            navHighlight = null;
        }
    };

    const syncNavUi = (instant = false) => {
        const currentLink = activeNavLink;
        const highlightedLink = previewNavLink || currentLink;

        if (!currentLink && !highlightedLink) {
            disableNavHighlight();
            updateNavClasses(null, null);
            return;
        }

        if (!desktopMedia.matches) {
            previewNavLink = null;
            disableNavHighlight();
            updateNavClasses(currentLink, currentLink);
            return;
        }

        const targetLink = highlightedLink || currentLink;
        const pill = ensureNavHighlight();
        if (!pill) return;

        if (instant || motionReduced) {
            pill.classList.add("nav-highlight--no-transition");
        } else {
            pill.classList.remove("nav-highlight--no-transition");
        }

        const navRect = nav.getBoundingClientRect();
        const linkRect = targetLink.getBoundingClientRect();

        nav.style.setProperty("--pill-x", `${linkRect.left - navRect.left}px`);
        nav.style.setProperty("--pill-y", `${linkRect.top - navRect.top}px`);
        nav.style.setProperty("--pill-w", `${linkRect.width}px`);
        nav.style.setProperty("--pill-h", `${linkRect.height}px`);

        updateNavClasses(currentLink, targetLink);

        if (instant || motionReduced) {
            requestAnimationFrame(() => {
                pill.classList.remove("nav-highlight--no-transition");
            });
        }
    };

    const syncNavUiAfterLayout = (instant = true) => {
        requestAnimationFrame(() => {
            syncNavUi(instant);
        });
    };

    const setActiveNavLink = (link, instant = false) => {
        activeNavLink = link || null;
        syncNavUi(instant);
    };

    const setPreviewNavLink = (link, instant = false) => {
        if (!desktopMedia.matches || !link) return;
        previewNavLink = link;
        syncNavUi(instant);
    };

    const clearPreviewNavLink = (instant = false) => {
        previewNavLink = null;
        syncNavUi(instant);
    };

    const revealAllContent = () => {
        document.querySelectorAll(".reveal, .reveal-stagger").forEach((element) => {
            element.classList.add("is-revealed");
        });

        document.querySelectorAll(".counter").forEach((counter) => {
            counter.textContent = counter.dataset.target || counter.textContent;
        });
    };

    const initNav = () => {
        if (!navLinks.length) return;

        updateMenuSemantics(false);
        burgerButton?.addEventListener("click", toggleMenu);
        menuOverlay?.addEventListener("click", () => {
            closeMenu();
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && isMenuOpen()) {
                closeMenu();
                return;
            }

            trapFocusInMenu(event);
        });

        navLinks.forEach((link) => {
            link.addEventListener("mouseenter", () => {
                if (!desktopMedia.matches) return;
                setPreviewNavLink(link);
            });

            link.addEventListener("focus", () => {
                if (!desktopMedia.matches) return;
                setPreviewNavLink(link);
            });

            link.addEventListener("click", () => {
                setActiveNavLink(link, true);
                closeMenu({ restoreFocus: false });
            });
        });

        nav.addEventListener("mouseleave", () => {
            clearPreviewNavLink();
        });

        nav.addEventListener("focusout", (event) => {
            if (!nav.contains(event.relatedTarget)) {
                clearPreviewNavLink();
            }
        });

        const ready = document.fonts?.ready || Promise.resolve();
        ready.then(() => {
            syncNavUiAfterLayout(true);
            syncOpenFaqHeight();

            if (window.location.hash) {
                scrollToHash(window.location.hash, {
                    updateHistory: false,
                    instant: true
                });
            }
        });

        desktopMedia.addEventListener("change", (event) => {
            previewNavLink = null;

            if (event.matches) {
                closeMenu({ restoreFocus: false });
                syncNavUiAfterLayout(true);
                return;
            }

            updateMenuSemantics(false);
            disableNavHighlight();
            updateNavClasses(activeNavLink, activeNavLink);
        });

        window.addEventListener("resize", () => {
            setHeaderOffset();
            previewNavLink = null;
            if (desktopMedia.matches) closeMenu({ restoreFocus: false });
            syncNavUiAfterLayout(true);
            syncCarouselProgress();
            syncOpenFaqHeight();
        });

        window.addEventListener("orientationchange", () => {
            setHeaderOffset();
            previewNavLink = null;
            syncNavUiAfterLayout(true);
        });

        window.addEventListener("pageshow", () => {
            const hashLink = getNavLinkByHash();
            if (hashLink) {
                activeNavLink = hashLink;
            } else if (!document.getElementById("services")) {
                activeNavLink = null;
            }
            previewNavLink = null;
            syncNavUiAfterLayout(true);

            if (window.location.hash) {
                scrollToHash(window.location.hash, {
                    updateHistory: false,
                    instant: true
                });
            }
        });

        window.addEventListener("hashchange", () => {
            const hashLink = getNavLinkByHash();
            if (hashLink) {
                setActiveNavLink(hashLink, true);
            } else if (!document.getElementById("services")) {
                setActiveNavLink(null, true);
            } else {
                previewNavLink = null;
                syncNavUiAfterLayout(true);
            }

            if (window.location.hash) {
                scrollToHash(window.location.hash, {
                    updateHistory: false,
                    instant: true
                });
            }
        });
    };

    const initAnchorScroll = () => {
        document.addEventListener("click", (event) => {
            const link = event.target.closest("a[href]");
            if (!link || event.defaultPrevented) return;
            if (link.target === "_blank" || link.hasAttribute("download")) return;
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
                return;
            }

            const hash = getSamePageHash(link);
            if (!hash || !getElementForHash(hash)) return;

            event.preventDefault();
            scrollToHash(hash, {
                updateHistory: true,
                focusTarget: link.classList.contains("skip-link")
            });
        });
    };

    const initScrollSpy = () => {
        const sectionMap = new Map(
            navLinks
                .map((link) => {
                    const id = getLinkHash(link).replace("#", "");
                    const section = id ? document.getElementById(id) : null;
                    return [section, link];
                })
                .filter(([section]) => section)
        );

        const sections = Array.from(sectionMap.keys());
        if (!sections.length) return;

        const visible = new Map();

        const updateActiveSection = () => {
            if (!visible.size) return;

            const best = Array.from(visible.entries()).sort((a, b) => {
                const ratioDelta = b[1].ratio - a[1].ratio;
                if (Math.abs(ratioDelta) > 0.02) return ratioDelta;
                return a[1].top - b[1].top;
            })[0];

            if (!best) return;
            const link = sectionMap.get(best[0]);
            if (link) setActiveNavLink(link);
        };

        const setInitialActiveSection = () => {
            const hashLink = getNavLinkByHash();
            if (hashLink) {
                setActiveNavLink(hashLink, true);
                return;
            }

            const bestSection = [...sections].sort((a, b) => (
                Math.abs(a.getBoundingClientRect().top) - Math.abs(b.getBoundingClientRect().top)
            ))[0];

            if (!bestSection) return;
            const link = sectionMap.get(bestSection);
            if (link) setActiveNavLink(link, true);
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    visible.set(entry.target, {
                        ratio: entry.intersectionRatio,
                        top: Math.max(entry.boundingClientRect.top, 0)
                    });
                } else {
                    visible.delete(entry.target);
                }
            });

            updateActiveSection();
        }, {
            rootMargin: "-18% 0px -48% 0px",
            threshold: [0.2, 0.35, 0.5, 0.65]
        });

        sections.forEach((section) => observer.observe(section));
        setInitialActiveSection();
    };

    const initRevealAnimations = () => {
        if (revealObserver) {
            revealObserver.disconnect();
            revealObserver = null;
        }

        const revealTargets = document.querySelectorAll(".reveal, .reveal-stagger");

        if (motionReduced) {
            revealAllContent();
            return;
        }

        const animatedCounters = new WeakSet();

        revealObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;

                entry.target.classList.add("is-revealed");

                entry.target.querySelectorAll(".counter").forEach((counter) => {
                    if (animatedCounters.has(counter)) return;
                    animatedCounters.add(counter);

                    const target = Number(counter.dataset.target);
                    if (target <= 1) {
                        counter.textContent = target;
                        return;
                    }

                    let startTime = null;
                    const duration = 1800;

                    const update = (currentTime) => {
                        if (!startTime) startTime = currentTime;
                        const progress = Math.min((currentTime - startTime) / duration, 1);
                        counter.textContent = Math.floor(easeOutExpo(progress) * target);

                        if (progress < 1) {
                            requestAnimationFrame(update);
                        } else {
                            counter.textContent = target;
                        }
                    };

                    requestAnimationFrame(update);
                });

                revealObserver?.unobserve(entry.target);
            });
        }, { threshold: 0.16 });

        revealTargets.forEach((el) => revealObserver.observe(el));
    };

    const getCarouselScrollAmount = () => {
        const card = carouselTrack?.querySelector(".carousel-card");
        if (!card) return 0;
        const styles = window.getComputedStyle(carouselTrack);
        const gap = parseFloat(styles.gap) || 20;
        return card.getBoundingClientRect().width + gap;
    };

    const getCarouselCards = () => (
        carouselTrack ? Array.from(carouselTrack.querySelectorAll(".carousel-card")) : []
    );

    const getActiveCarouselIndex = () => {
        const cards = getCarouselCards();
        if (!cards.length || !carouselTrack) return 0;

        let activeIndex = 0;
        let smallestDistance = Number.POSITIVE_INFINITY;

        cards.forEach((card, index) => {
            const distance = Math.abs(card.offsetLeft - carouselTrack.scrollLeft);
            if (distance < smallestDistance) {
                smallestDistance = distance;
                activeIndex = index;
            }
        });

        return activeIndex;
    };

    const setControlDisabled = (button, disabled) => {
        if (!button) return;
        button.disabled = disabled;
        button.setAttribute("aria-disabled", String(disabled));
    };

    const announceCarouselPosition = () => {
        if (!carouselStatus || !carouselTrack) return;

        const cards = getCarouselCards();
        if (!cards.length) return;

        const activeIndex = getActiveCarouselIndex();
        const title = cards[activeIndex]?.querySelector(".card-title")?.textContent?.trim();
        const message = title
            ? `Карточка ${activeIndex + 1} из ${cards.length}: ${title}`
            : `Карточка ${activeIndex + 1} из ${cards.length}`;

        if (message !== lastCarouselAnnouncement) {
            carouselStatus.textContent = message;
            lastCarouselAnnouncement = message;
        }
    };

    const syncCarouselButtons = () => {
        if (!carouselTrack || !prevBtn || !nextBtn) return;

        const maxScroll = Math.max(carouselTrack.scrollWidth - carouselTrack.clientWidth, 0);
        const atStart = carouselTrack.scrollLeft <= 4;
        const atEnd = carouselTrack.scrollLeft >= maxScroll - 4;

        setControlDisabled(prevBtn, atStart);
        setControlDisabled(nextBtn, atEnd);
    };

    const syncCarouselA11y = () => {
        if (!carouselTrack) return;

        carouselTrack.setAttribute("tabindex", "0");

        const cards = getCarouselCards();
        cards.forEach((card, index) => {
            card.setAttribute("role", "group");
            card.setAttribute("aria-roledescription", "slide");
            card.setAttribute("aria-label", `${index + 1} из ${cards.length}`);
        });

        announceCarouselPosition();
        syncCarouselButtons();
    };

    const syncCarouselProgress = () => {
        if (!carouselTrack || !progressFill) return;

        const total = carouselTrack.scrollWidth;
        const visible = carouselTrack.clientWidth;
        const maxScroll = total - visible;

        const widthPercent = total > 0 ? Math.max((visible / total) * 100, 16) : 100;
        const leftPercent = maxScroll > 0
            ? ((100 - widthPercent) * carouselTrack.scrollLeft) / maxScroll
            : 0;

        progressFill.style.width = `${widthPercent}%`;
        progressFill.style.left = `${leftPercent}%`;
        syncCarouselButtons();
        announceCarouselPosition();
    };

    const initCarousel = () => {
        if (!carouselTrack || !prevBtn || !nextBtn) return;

        nextBtn.addEventListener("click", () => {
            carouselTrack.scrollBy({
                left: getCarouselScrollAmount(),
                behavior: getScrollBehavior()
            });
        });

        prevBtn.addEventListener("click", () => {
            carouselTrack.scrollBy({
                left: -getCarouselScrollAmount(),
                behavior: getScrollBehavior()
            });
        });

        carouselTrack.addEventListener("keydown", (event) => {
            if (event.key === "ArrowRight") {
                event.preventDefault();
                nextBtn.click();
                return;
            }

            if (event.key === "ArrowLeft") {
                event.preventDefault();
                prevBtn.click();
                return;
            }

            if (event.key === "Home") {
                event.preventDefault();
                carouselTrack.scrollTo({ left: 0, behavior: getScrollBehavior() });
                return;
            }

            if (event.key === "End") {
                event.preventDefault();
                carouselTrack.scrollTo({
                    left: carouselTrack.scrollWidth,
                    behavior: getScrollBehavior()
                });
            }
        });

        carouselTrack.addEventListener("scroll", syncCarouselProgress, { passive: true });
        syncCarouselA11y();
        syncCarouselProgress();
    };

    const syncOpenFaqHeight = () => {
        const openItem = document.querySelector(".faq-item.is-open");
        if (!openItem) return;
        const panel = openItem.querySelector(".faq-answer");
        if (panel) {
            panel.style.height = `${panel.scrollHeight}px`;
        }
    };

    const initFaq = () => {
        const items = Array.from(document.querySelectorAll(".faq-item"));
        if (!items.length) return;

        const applyState = (item, open) => {
            const button = item.querySelector(".faq-question");
            const panel = item.querySelector(".faq-answer");
            if (!button || !panel) return;

            item.classList.toggle("is-open", open);
            button.setAttribute("aria-expanded", String(open));
            panel.setAttribute("aria-hidden", String(!open));
            panel.style.height = open ? `${panel.scrollHeight}px` : "0px";
        };

        const openItem = items.find((item) => item.classList.contains("is-open")) || items[2] || null;

        items.forEach((item) => {
            applyState(item, item === openItem);
        });

        const buttons = items
            .map((item) => item.querySelector(".faq-question"))
            .filter(Boolean);

        buttons.forEach((button, index) => {
            if (button.dataset.faqKeyBound === "true") return;

            button.dataset.faqKeyBound = "true";
            button.addEventListener("keydown", (event) => {
                if (event.key === "ArrowDown") {
                    event.preventDefault();
                    buttons[(index + 1) % buttons.length].focus();
                    return;
                }

                if (event.key === "ArrowUp") {
                    event.preventDefault();
                    buttons[(index - 1 + buttons.length) % buttons.length].focus();
                    return;
                }

                if (event.key === "Home") {
                    event.preventDefault();
                    buttons[0].focus();
                    return;
                }

                if (event.key === "End") {
                    event.preventDefault();
                    buttons[buttons.length - 1].focus();
                }
            });
        });

        items.forEach((item) => {
            const button = item.querySelector(".faq-question");
            if (!button || button.dataset.faqBound === "true") return;

            button.dataset.faqBound = "true";

            button.addEventListener("click", () => {
                const alreadyOpen = item.classList.contains("is-open");

                items.forEach((currentItem) => applyState(currentItem, false));

                if (!alreadyOpen) {
                    applyState(item, true);
                }
            });
        });
    };

    const handleReducedMotionChange = (event) => {
        motionReduced = event.matches;

        if (motionReduced) {
            revealAllContent();
            revealObserver?.disconnect();
            revealObserver = null;
        } else {
            initRevealAnimations();
        }

        syncNavUiAfterLayout(true);
        syncOpenFaqHeight();
    };

    document.addEventListener("snaf:content-loaded", () => {
        requestAnimationFrame(() => {
            initFaq();
            syncCarouselA11y();
            syncCarouselProgress();
            syncOpenFaqHeight();

            if (motionReduced) {
                revealAllContent();
            }
        });
    });

    reducedMotionQuery.addEventListener("change", handleReducedMotionChange);

    setHeaderOffset();
    initCookieBanner();
    initNav();
    initAnchorScroll();
    initRevealAnimations();
    initScrollSpy();
    initCarousel();
    initFaq();
});
