document.addEventListener("DOMContentLoaded", () => {
    const motionReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const desktopMedia = window.matchMedia("(min-width: 769px)");

    const header = document.querySelector(".header");
    const burgerButton = document.querySelector(".burger-btn");
    const navWrap = document.querySelector(".main-nav-wrap");
    const nav = document.querySelector(".main-nav");
    const navLinks = Array.from(nav.querySelectorAll(".nav-link"));
    const carouselTrack = document.getElementById("benefitsCarousel");
    const prevBtn = document.querySelector(".prev-btn");
    const nextBtn = document.querySelector(".next-btn");
    const progressFill = document.querySelector(".carousel-progress-fill");

    let navHighlight = null;
    let currentNavLink = navLinks[0] || null;
    let hoverNavLink = null;

    const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

    const setHeaderOffset = () => {
        const offset = (header?.offsetHeight || 80) + 12;
        document.documentElement.style.setProperty("--header-offset", `${offset}px`);
    };

    const closeMenu = () => {
        if (!burgerButton || !navWrap) return;
        burgerButton.classList.remove("is-active");
        burgerButton.setAttribute("aria-expanded", "false");
        navWrap.classList.remove("is-open");
        document.body.classList.remove("menu-open");
    };

    const openMenu = () => {
        if (!burgerButton || !navWrap) return;
        burgerButton.classList.add("is-active");
        burgerButton.setAttribute("aria-expanded", "true");
        navWrap.classList.add("is-open");
        document.body.classList.add("menu-open");
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
            const isCurrent = link === currentLink;
            const isHighlighted = link === highlightedLink;

            link.classList.toggle("is-current", isCurrent);
            link.classList.toggle("is-highlighted", isHighlighted);
            link.setAttribute("aria-current", isCurrent ? "page" : "false");
        });
    };

    const ensureNavHighlight = () => {
        if (!desktopMedia.matches) return null;
        if (!navHighlight) {
            navHighlight = document.createElement("span");
            navHighlight.className = "nav-highlight";
            nav.prepend(navHighlight);
        }
        nav.classList.add("has-highlight");
        return navHighlight;
    };

    const disableMobileHighlight = () => {
        hoverNavLink = null;
        nav.classList.remove("has-highlight");
        if (navHighlight) {
            navHighlight.remove();
            navHighlight = null;
        }
        updateNavClasses(currentNavLink, currentNavLink);
    };

    const moveNavHighlight = (targetLink, instant = false) => {
        if (!targetLink) return;

        if (!desktopMedia.matches) {
            disableMobileHighlight();
            return;
        }

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

        updateNavClasses(currentNavLink, targetLink);

        if (instant || motionReduced) {
            requestAnimationFrame(() => {
                pill.classList.remove("nav-highlight--no-transition");
            });
        }
    };

    const setCurrentNavLink = (link, instant = false) => {
        if (!link) return;
        currentNavLink = link;
        if (!hoverNavLink) {
            moveNavHighlight(link, instant);
        } else {
            updateNavClasses(currentNavLink, hoverNavLink);
        }
    };

    const initNav = () => {
        if (!navLinks.length) return;

        burgerButton?.addEventListener("click", toggleMenu);

        navLinks.forEach((link) => {
            link.addEventListener("mouseenter", () => {
                if (!desktopMedia.matches) return;
                hoverNavLink = link;
                moveNavHighlight(link);
            });

            link.addEventListener("focus", () => {
                if (!desktopMedia.matches) return;
                hoverNavLink = link;
                moveNavHighlight(link);
            });

            link.addEventListener("click", () => {
                setCurrentNavLink(link, true);
                closeMenu();
            });
        });

        nav.addEventListener("mouseleave", () => {
            hoverNavLink = null;
            moveNavHighlight(currentNavLink);
        });

        nav.addEventListener("focusout", (event) => {
            if (!nav.contains(event.relatedTarget)) {
                hoverNavLink = null;
                moveNavHighlight(currentNavLink);
            }
        });

        const ready = document.fonts?.ready || Promise.resolve();
        ready.then(() => {
            setCurrentNavLink(currentNavLink, true);
        });

        desktopMedia.addEventListener("change", (event) => {
            if (event.matches) {
                moveNavHighlight(currentNavLink, true);
                return;
            }
            disableMobileHighlight();
            closeMenu();
        });

        window.addEventListener("resize", () => {
            setHeaderOffset();
            if (desktopMedia.matches) {
                closeMenu();
            }
            moveNavHighlight(currentNavLink, true);
            syncCarouselProgress();
            syncOpenFaqHeight();
        });
    };

    const initScrollSpy = () => {
        const sectionMap = new Map(
            navLinks
                .map((link) => {
                    const id = link.getAttribute("href")?.replace("#", "");
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
            if (link) setCurrentNavLink(link);
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
    initNav();
    initRevealAnimations();
    initScrollSpy();
    initCarousel();
    initFaq();
});
