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
    const motionReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const desktopMedia = window.matchMedia("(min-width: 921px)");

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
    const cookieBanner = document.querySelector(".cookie-banner");

    let navHighlight = null;
    let activeNavLink = null;
    let previewNavLink = null;
    let analyticsInitialized = false;

    const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
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

    const getNavLinkByHash = (hash = window.location.hash) => (
        navLinks.find((link) => getLinkHash(link) === hash) || null
    );

    const setMenuOverlayState = (open) => {
        if (!menuOverlay) return;
        menuOverlay.classList.toggle("is-visible", open);
        menuOverlay.setAttribute("aria-hidden", String(!open));
    };

    const closeMenu = () => {
        if (!burgerButton || !navWrap) return;
        burgerButton.classList.remove("is-active");
        burgerButton.setAttribute("aria-expanded", "false");
        burgerButton.setAttribute("aria-label", "Открыть меню");
        navWrap.classList.remove("is-open");
        document.body.classList.remove("menu-open");
        setMenuOverlayState(false);
    };

    const openMenu = () => {
        if (!burgerButton || !navWrap) return;
        burgerButton.classList.add("is-active");
        burgerButton.setAttribute("aria-expanded", "true");
        burgerButton.setAttribute("aria-label", "Закрыть меню");
        navWrap.classList.add("is-open");
        document.body.classList.add("menu-open");
        setMenuOverlayState(true);
    };

    const toggleMenu = () => {
        if (navWrap.classList.contains("is-open")) {
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

    const initNav = () => {
        if (!navLinks.length) return;

        burgerButton?.addEventListener("click", toggleMenu);
        menuOverlay?.addEventListener("click", closeMenu);

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                closeMenu();
            }
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
                closeMenu();
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
        });

        desktopMedia.addEventListener("change", (event) => {
            if (event.matches) {
                syncNavUiAfterLayout(true);
                return;
            }
            previewNavLink = null;
            disableNavHighlight();
            updateNavClasses(activeNavLink, activeNavLink);
            closeMenu();
        });

        window.addEventListener("resize", () => {
            setHeaderOffset();
            previewNavLink = null;
            if (desktopMedia.matches) closeMenu();
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
        });

        window.addEventListener("hashchange", () => {
            const hashLink = getNavLinkByHash();
            if (hashLink) {
                setActiveNavLink(hashLink, true);
                return;
            }
            if (!document.getElementById("services")) {
                setActiveNavLink(null, true);
                return;
            }
            previewNavLink = null;
            syncNavUiAfterLayout(true);
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
        const revealTargets = document.querySelectorAll(".reveal, .reveal-stagger");

        if (motionReduced) {
            revealTargets.forEach((el) => el.classList.add("is-revealed"));
            document.querySelectorAll(".counter").forEach((counter) => {
                counter.textContent = counter.dataset.target || counter.textContent;
            });
            return;
        }

        const animatedCounters = new WeakSet();

        const observer = new IntersectionObserver((entries) => {
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

                observer.unobserve(entry.target);
            });
        }, { threshold: 0.16 });

        revealTargets.forEach((el) => observer.observe(el));
    };

    const getCarouselScrollAmount = () => {
        const card = carouselTrack?.querySelector(".carousel-card");
        if (!card) return 0;
        const styles = window.getComputedStyle(carouselTrack);
        const gap = parseFloat(styles.gap) || 20;
        return card.getBoundingClientRect().width + gap;
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
    };

    const initCarousel = () => {
        if (!carouselTrack || !prevBtn || !nextBtn) return;

        nextBtn.addEventListener("click", () => {
            carouselTrack.scrollBy({
                left: getCarouselScrollAmount(),
                behavior: "smooth"
            });
        });

        prevBtn.addEventListener("click", () => {
            carouselTrack.scrollBy({
                left: -getCarouselScrollAmount(),
                behavior: "smooth"
            });
        });

        carouselTrack.addEventListener("scroll", syncCarouselProgress, { passive: true });
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

            item.classList.toggle("is-open", open);
            button.setAttribute("aria-expanded", String(open));
            panel.setAttribute("aria-hidden", String(!open));
            panel.style.height = open ? `${panel.scrollHeight}px` : "0px";
        };

        const openItem = items.find((item) => item.classList.contains("is-open")) || items[2] || null;

        items.forEach((item) => {
            applyState(item, item === openItem);
        });

        items.forEach((item) => {
            const button = item.querySelector(".faq-question");

            button.addEventListener("click", () => {
                const alreadyOpen = item.classList.contains("is-open");

                items.forEach((currentItem) => applyState(currentItem, false));

                if (!alreadyOpen) {
                    applyState(item, true);
                }
            });
        });
    };

    setHeaderOffset();
    initCookieBanner();
    initNav();
    initRevealAnimations();
    initScrollSpy();
    initCarousel();
    initFaq();
});
