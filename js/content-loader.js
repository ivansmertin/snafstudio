/**
 * Content Loader — loads site content from data/content.json
 * and populates the DOM. Hardcoded HTML remains as SEO fallback.
 */
(function () {
    "use strict";

    var CONTENT_PATH = "data/content.json";
    var PREVIEW_KEY = "snaf-admin-preview";

    function isPreviewMode() {
        try {
            return new URL(window.location.href).searchParams.get("preview") === "1";
        } catch {
            return false;
        }
    }

    function ensurePreviewIndicator() {
        if (!document.body || document.querySelector(".preview-indicator")) return;

        document.body.classList.add("is-preview-mode");

        var indicator = document.createElement("div");
        indicator.className = "preview-indicator";
        indicator.setAttribute("role", "status");
        indicator.textContent = "Режим предпросмотра";
        document.body.appendChild(indicator);
    }

    function getNestedValue(obj, path) {
        return path.split(".").reduce(function (o, key) {
            return o && o[key] !== undefined ? o[key] : undefined;
        }, obj);
    }

    function applySimpleFields(data) {
        var elements = document.querySelectorAll("[data-content]");
        elements.forEach(function (el) {
            var value = getNestedValue(data, el.getAttribute("data-content"));
            if (value === undefined) return;
            if (typeof value !== "string") return;
            if (value.indexOf("<") !== -1) {
                el.innerHTML = value;
            } else {
                el.textContent = value;
            }
        });
    }

    function applyHrefFields(data) {
        var elements = document.querySelectorAll("[data-href]");
        elements.forEach(function (el) {
            var value = getNestedValue(data, el.getAttribute("data-href"));
            if (value === undefined) return;
            var prefix = el.getAttribute("data-href-prefix") || "";
            if (typeof value !== "string") return;
            if (prefix && value.indexOf(prefix) !== 0) {
                value = prefix + value;
            }
            el.setAttribute("href", value);
        });
    }

    function buildHeroPoints(data) {
        var container = document.querySelector("[data-content-list='hero-points']");
        if (!container || !data.hero || !data.hero.points) return;
        container.innerHTML = "";
        data.hero.points.forEach(function (point) {
            var span = document.createElement("span");
            span.className = "hero-point";
            span.textContent = point;
            container.appendChild(span);
        });
    }

    function buildBenefitsCarousel(data) {
        var container = document.querySelector("[data-content-list='benefits']");
        if (!container || !data.benefits || !data.benefits.items) return;
        container.innerHTML = "";
        data.benefits.items.forEach(function (item, index) {
            var article = document.createElement("article");
            article.className = "carousel-card surface-glow";
            article.setAttribute("role", "group");
            article.setAttribute("aria-roledescription", "slide");
            article.setAttribute("aria-label", (index + 1) + " из " + data.benefits.items.length);
            article.innerHTML =
                '<h3 class="card-title">' + escapeHtml(item.title) + "</h3>" +
                '<p class="card-text">' + escapeHtml(item.text) + "</p>";
            container.appendChild(article);
        });
    }

    function buildProcessSteps(data) {
        var container = document.querySelector("[data-content-list='process']");
        if (!container || !data.process || !data.process.steps) return;
        container.innerHTML = "";
        data.process.steps.forEach(function (step) {
            var article = document.createElement("article");
            article.className = "process-step surface-glow";
            if (step.accent) article.className += " process-step--accent";
            article.innerHTML =
                '<div class="process-step-number">' + escapeHtml(step.number) + "</div>" +
                '<h3 class="process-step-title">' + escapeHtml(step.title) + "</h3>" +
                '<p class="process-step-desc">' + escapeHtml(step.description) + "</p>";
            container.appendChild(article);
        });
    }

    function buildPricingCards(data) {
        var container = document.querySelector("[data-content-list='pricing']");
        if (!container || !data.pricing || !data.pricing.plans) return;
        var telegramLink = (data.contact && data.contact.telegram) || "https://t.me/smrtnivn";
        container.innerHTML = "";
        data.pricing.plans.forEach(function (plan) {
            var article = document.createElement("article");
            article.className = "pricing-card surface-glow";
            if (plan.accent) article.className += " pricing-card--accent";
            var featuresHtml = plan.features.map(function (f) {
                return "<li>" + escapeHtml(f) + "</li>";
            }).join("");
            var btnClass = plan.ctaStyle === "primary" ? "btn btn--primary" : "btn btn--outline";
            article.innerHTML =
                '<div class="pricing-card-header">' +
                    "<h3>" + escapeHtml(plan.name) + "</h3>" +
                    '<span class="pricing-range">' + escapeHtml(plan.range) + "</span>" +
                "</div>" +
                '<div class="pricing-price">' + escapeHtml(plan.price) + "</div>" +
                '<ul class="pricing-list">' + featuresHtml + "</ul>" +
                '<a href="' + escapeHtml(telegramLink) + '" class="' + btnClass + '" target="_blank" rel="noopener noreferrer">' +
                    escapeHtml(plan.ctaLabel) +
                "</a>";
            container.appendChild(article);
        });
    }

    function buildFaqItems(data) {
        var container = document.querySelector("[data-content-list='faq']");
        if (!container || !data.faq || !data.faq.items) return;
        var defaultOpen = data.faq.defaultOpen !== undefined ? data.faq.defaultOpen : 2;
        container.innerHTML = "";
        data.faq.items.forEach(function (item, i) {
            var isOpen = i === defaultOpen;
            var article = document.createElement("article");
            article.className = "faq-item surface-glow";
            if (isOpen) article.className += " is-open";
            var panelId = "faq-panel-" + (i + 1);
            var buttonId = "faq-button-" + (i + 1);
            article.innerHTML =
                '<h3 class="faq-question-heading">' +
                    '<button class="faq-question" type="button" aria-expanded="' + isOpen + '" aria-controls="' + panelId + '" id="' + buttonId + '">' +
                        '<span class="faq-question-text">' + escapeHtml(item.question) + "</span>" +
                        '<span class="faq-toggle" aria-hidden="true"></span>' +
                    "</button>" +
                "</h3>" +
                '<div class="faq-answer" id="' + panelId + '" role="region" aria-labelledby="' + buttonId + '" aria-hidden="' + !isOpen + '">' +
                    "<p>" + escapeHtml(item.answer) + "</p>" +
                "</div>";
            container.appendChild(article);
        });
    }

    function buildTechBadges(data) {
        var container = document.querySelector("[data-content-list='tech-stack']");
        if (!container || !data.about || !data.about.stats) return;
        var techStat = data.about.stats.find(function (s) { return s.type === "tech"; });
        if (!techStat || !techStat.badges) return;
        container.innerHTML = "";
        techStat.badges.forEach(function (badge) {
            var span = document.createElement("span");
            span.className = "tech-badge";
            span.textContent = badge;
            container.appendChild(span);
        });
    }

    function buildBusinessSchema(data) {
        var pricing = (data.pricing && data.pricing.plans) || [];
        var contact = data.contact || {};

        return {
            "@context": "https://schema.org",
            "@type": "ProfessionalService",
            "@id": "https://snafstudio.ru/#organization",
            name: "СНАФ СТУДИЯ",
            url: "https://snafstudio.ru/",
            logo: "https://snafstudio.ru/images/logo.svg",
            image: "https://snafstudio.ru/images/og-cover.png?v=2",
            description: data.hero && data.hero.subtitle
                ? data.hero.subtitle
                : "Дизайн и создание современных лендингов и сайтов.",
            priceRange: "от 2 000 ₽",
            email: contact.email ? "mailto:" + contact.email : "mailto:mail@snafstudio.ru",
            currenciesAccepted: "RUB",
            areaServed: {
                "@type": "Country",
                name: "Россия"
            },
            founder: {
                "@type": "Person",
                name: data.about && data.about.name ? data.about.name : "Иван Смертин"
            },
            sameAs: [contact.telegram, contact.vk].filter(Boolean),
            hasOfferCatalog: {
                "@type": "OfferCatalog",
                name: "Услуги SNAF STUDIO",
                itemListElement: pricing.map(function (plan) {
                    var numericPrice = String(plan.price || "").replace(/[^\d]/g, "") || "2000";
                    return {
                        "@type": "Offer",
                        name: plan.name,
                        priceCurrency: "RUB",
                        price: numericPrice,
                        priceSpecification: {
                            "@type": "PriceSpecification",
                            priceCurrency: "RUB",
                            minPrice: numericPrice,
                            price: numericPrice
                        },
                        description: (plan.features || []).join(", ")
                    };
                })
            }
        };
    }

    function buildFaqSchema(data) {
        var items = (data.faq && data.faq.items) || [];
        return {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: items.map(function (item) {
                return {
                    "@type": "Question",
                    name: item.question,
                    acceptedAnswer: {
                        "@type": "Answer",
                        text: item.answer
                    }
                };
            })
        };
    }

    function updateStructuredData(data) {
        var businessSchema = document.getElementById("business-schema");
        var faqSchema = document.getElementById("faq-schema");

        if (businessSchema) {
            businessSchema.textContent = JSON.stringify(buildBusinessSchema(data), null, 4);
        }

        if (faqSchema) {
            faqSchema.textContent = JSON.stringify(buildFaqSchema(data), null, 4);
        }
    }

    function escapeHtml(str) {
        if (!str) return "";
        var div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    function applyContent(data) {
        window.SNAF_CONTENT = data;
        applySimpleFields(data);
        applyHrefFields(data);
        buildHeroPoints(data);
        buildBenefitsCarousel(data);
        buildProcessSteps(data);
        buildPricingCards(data);
        buildFaqItems(data);
        buildTechBadges(data);
        updateStructuredData(data);
        document.dispatchEvent(new CustomEvent("snaf:content-loaded", {
            detail: data
        }));
    }

    function loadContent() {
        var previewMode = isPreviewMode();

        if (previewMode) {
            ensurePreviewIndicator();
        }

        // Check for admin preview data first
        if (previewMode) {
            try {
                var preview = window.localStorage.getItem(PREVIEW_KEY);
                if (preview) {
                    var previewData = JSON.parse(preview);
                    window.localStorage.removeItem(PREVIEW_KEY);
                    applyContent(previewData);
                    return;
                }
            } catch {
                // Ignore parse errors
            }
        }

        // Fetch from JSON file
        fetch(CONTENT_PATH)
            .then(function (response) {
                if (!response.ok) throw new Error("Failed to load content");
                return response.json();
            })
            .then(function (data) {
                applyContent(data);
            })
            .catch(function () {
                // Fallback: hardcoded HTML stays as-is
            });
    }

    // Run when DOM is ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", loadContent);
    } else {
        loadContent();
    }
})();
