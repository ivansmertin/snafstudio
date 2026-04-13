(function () {
    "use strict";

    var siteConfig = window.SNAF_CONFIG || {};
    var chatConfig = siteConfig.chat || {};
    var isEnabled = chatConfig.enabled !== false;
    var apiBaseUrl = trimTrailingSlash(chatConfig.apiBaseUrl || "");
    var contentPath = "data/content.json";
    var widget = null;
    var launcher = null;
    var panel = null;
    var bodyEl = null;
    var composerEl = null;
    var observer = null;

    var state = {
        isOpen: false,
        loading: false,
        sessionId: null,
        messages: [],
        suggestions: [],
        hasInteraction: false,
        apiConfigured: Boolean(apiBaseUrl),
        leadMode: false,
        leadError: "",
        content: {
            contact: {
                telegram: "https://t.me/smrtnivn"
            },
            chatBot: {
                launcherLabel: "Задать вопрос",
                greeting: "Привет! Я помогу быстро сориентироваться по услугам СНАФ СТУДИИ.",
                intro: "Можно спросить про стоимость, сроки, формат работы или сразу оставить заявку.",
                quickReplies: ["Стоимость", "Сроки", "Что вы делаете?", "Оставить заявку"],
                capturePrompt: "Если хотите, я передам ваш вопрос в заявки. Оставьте имя и удобный контакт, и я свяжусь с вами.",
                successMessage: "Спасибо! Заявка сохранена. Я посмотрю вопрос и вернусь к вам по указанному контакту.",
                fallbackMessage: "Сейчас чат недоступен. Напишите мне в Telegram, и я отвечу вручную."
            }
        },
        leadForm: {
            name: "",
            contactType: "telegram",
            contactValue: "",
            question: "",
            consent: false
        }
    };

    function trimTrailingSlash(value) {
        return value.replace(/\/+$/, "");
    }

    function init() {
        if (!isEnabled || !document.body) return;
        createWidget();
        seedMessages(true);
        bindGlobalEvents();
        loadSiteContent();
        syncCookieOffset();
        render();
    }

    function createWidget() {
        widget = document.createElement("div");
        widget.className = "chat-widget";
        widget.innerHTML =
            '<button class="chat-widget__launcher" type="button" aria-expanded="false" aria-controls="snaf-chat-panel">' +
                '<span class="chat-widget__launcher-icon" aria-hidden="true">' +
                    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">' +
                        '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>' +
                    "</svg>" +
                "</span>" +
                '<span class="chat-widget__launcher-text">Задать вопрос</span>' +
            "</button>" +
            '<section class="chat-widget__panel" id="snaf-chat-panel" aria-label="Чат-бот СНАФ СТУДИИ">' +
                '<div class="chat-widget__header">' +
                    '<div class="chat-widget__header-copy">' +
                        '<div class="chat-widget__eyebrow">СНАФ СТУДИЯ</div>' +
                        '<h2 class="chat-widget__title">Чат-бот по услугам</h2>' +
                        '<p class="chat-widget__subtitle">Быстрый FAQ и передача заявки в работу</p>' +
                    "</div>" +
                    '<button class="chat-widget__close" type="button" aria-label="Закрыть чат">&times;</button>' +
                "</div>" +
                '<div class="chat-widget__body" aria-live="polite"></div>' +
                '<div class="chat-widget__composer"></div>' +
            "</section>";

        document.body.appendChild(widget);
        launcher = widget.querySelector(".chat-widget__launcher");
        panel = widget.querySelector(".chat-widget__panel");
        bodyEl = widget.querySelector(".chat-widget__body");
        composerEl = widget.querySelector(".chat-widget__composer");

        launcher.addEventListener("click", toggleWidget);
        widget.querySelector(".chat-widget__close").addEventListener("click", closeWidget);
    }

    function bindGlobalEvents() {
        document.addEventListener("snaf:content-loaded", function (event) {
            if (event && event.detail) {
                applyContent(event.detail);
            }
        });

        window.addEventListener("resize", syncCookieOffset);

        var banner = document.querySelector(".cookie-banner");
        if (banner && "MutationObserver" in window) {
            observer = new MutationObserver(syncCookieOffset);
            observer.observe(banner, {
                attributes: true,
                attributeFilter: ["hidden", "class", "style"]
            });
        }
    }

    function loadSiteContent() {
        if (window.SNAF_CONTENT) {
            applyContent(window.SNAF_CONTENT);
            return;
        }

        fetch(contentPath)
            .then(function (response) {
                if (!response.ok) throw new Error("Failed to load content");
                return response.json();
            })
            .then(function (data) {
                applyContent(data);
            })
            .catch(function () {
                render();
            });
    }

    function applyContent(data) {
        state.content = normalizeContent(data);
        if (!state.hasInteraction) {
            seedMessages(true);
        }
        render();
    }

    function normalizeContent(data) {
        var next = data || {};
        if (!next.contact) next.contact = {};
        if (!next.chatBot) next.chatBot = {};

        if (!next.contact.telegram) {
            next.contact.telegram = "https://t.me/smrtnivn";
        }

        next.chatBot.launcherLabel = next.chatBot.launcherLabel || "Задать вопрос";
        next.chatBot.greeting = next.chatBot.greeting || "Привет! Я помогу быстро сориентироваться по услугам СНАФ СТУДИИ.";
        next.chatBot.intro = next.chatBot.intro || "Можно спросить про стоимость, сроки, формат работы или сразу оставить заявку.";
        next.chatBot.quickReplies = Array.isArray(next.chatBot.quickReplies) && next.chatBot.quickReplies.length
            ? next.chatBot.quickReplies
            : ["Стоимость", "Сроки", "Что вы делаете?", "Оставить заявку"];
        next.chatBot.capturePrompt = next.chatBot.capturePrompt || "Оставьте имя и удобный контакт, и я передам ваш вопрос в работу.";
        next.chatBot.successMessage = next.chatBot.successMessage || "Спасибо! Заявка сохранена.";
        next.chatBot.fallbackMessage = next.chatBot.fallbackMessage || "Сейчас чат недоступен. Напишите мне в Telegram.";
        return next;
    }

    function seedMessages(forceReset) {
        if (!forceReset && state.messages.length) return;
        state.messages = [
            { role: "bot", text: state.content.chatBot.greeting },
            { role: "bot", text: state.content.chatBot.intro }
        ];
        state.suggestions = state.apiConfigured ? state.content.chatBot.quickReplies.slice() : [];
        state.leadMode = false;
        state.leadError = "";
    }

    function toggleWidget() {
        if (state.isOpen) {
            closeWidget();
        } else {
            openWidget();
        }
    }

    function openWidget() {
        state.isOpen = true;
        widget.classList.add("is-open");
        launcher.setAttribute("aria-expanded", "true");
        render();
        focusPrimaryControl();
    }

    function closeWidget() {
        state.isOpen = false;
        widget.classList.remove("is-open");
        launcher.setAttribute("aria-expanded", "false");
    }

    function focusPrimaryControl() {
        if (!widget) return;
        window.setTimeout(function () {
            var target = widget.querySelector("#chat-lead-name, .chat-widget__field, .chat-widget__textarea, .chat-widget__quick-reply, .chat-widget__link");
            if (target) target.focus();
        }, 60);
    }

    function render() {
        if (!widget) return;
        renderLauncher();
        renderMessages();
        renderComposer();
    }

    function renderLauncher() {
        var launcherText = widget.querySelector(".chat-widget__launcher-text");
        if (launcherText) {
            launcherText.textContent = state.content.chatBot.launcherLabel;
        }
    }

    function renderMessages() {
        bodyEl.innerHTML = "";

        state.messages.forEach(function (message) {
            var wrap = document.createElement("article");
            wrap.className = "chat-widget__message chat-widget__message--" + message.role;

            var bubble = document.createElement("div");
            bubble.className = "chat-widget__bubble";
            bubble.textContent = message.text;
            wrap.appendChild(bubble);

            var meta = document.createElement("div");
            meta.className = "chat-widget__message-meta";
            meta.textContent = message.role === "bot" ? "Бот" : "Вы";
            wrap.appendChild(meta);

            bodyEl.appendChild(wrap);
        });

        if (state.leadMode) {
            bodyEl.appendChild(buildLeadCard());
        }

        bodyEl.scrollTop = bodyEl.scrollHeight;
    }

    function renderComposer() {
        if (!composerEl) return;

        if (state.leadMode) {
            composerEl.innerHTML = "";
            return;
        }

        var inputDisabled = !state.apiConfigured || state.loading;
        var statusBlock = "";
        if (!state.apiConfigured) {
            statusBlock =
                '<div class="chat-widget__status">' +
                    '<strong>Backend пока не подключён.</strong> Заполните <code>chat.apiBaseUrl</code> или используйте Telegram.' +
                "</div>";
        }

        composerEl.innerHTML =
            statusBlock +
            '<div class="chat-widget__actions" id="chat-widget-actions"></div>' +
            '<div class="chat-widget__composer-row">' +
                '<input class="chat-widget__field" id="chat-widget-input" type="text" placeholder="' + escapeAttr(getInputPlaceholder()) + '"' + (inputDisabled ? " disabled" : "") + ">" +
                '<button class="chat-widget__submit" id="chat-widget-send" type="button"' + (inputDisabled ? " disabled" : "") + ">" +
                    (state.loading ? "Отправка..." : "Отправить") +
                "</button>" +
            "</div>" +
            '<p class="chat-widget__composer-hint">Бот отвечает по содержанию сайта и может передать вопрос в заявки.</p>';

        var actionsEl = composerEl.querySelector("#chat-widget-actions");
        populateActions(actionsEl);

        var input = composerEl.querySelector("#chat-widget-input");
        var sendButton = composerEl.querySelector("#chat-widget-send");
        if (input) {
            input.addEventListener("keydown", function (event) {
                if (event.key === "Enter") {
                    event.preventDefault();
                    submitMessage(input.value);
                }
            });
        }
        if (sendButton) {
            sendButton.addEventListener("click", function () {
                submitMessage(input ? input.value : "");
            });
        }
    }

    function populateActions(container) {
        if (!container) return;
        container.innerHTML = "";

        var actions = state.suggestions.slice();
        if (!state.apiConfigured) {
            actions = [];
        }

        actions.forEach(function (label) {
            var button = document.createElement("button");
            button.className = "chat-widget__quick-reply";
            button.type = "button";
            button.textContent = label;
            button.addEventListener("click", function () {
                if (label === "Оставить заявку") {
                    openLeadMode();
                } else {
                    submitMessage(label);
                }
            });
            container.appendChild(button);
        });

        if (state.content.contact && state.content.contact.telegram) {
            var telegramLink = document.createElement("a");
            telegramLink.className = "chat-widget__link";
            telegramLink.href = state.content.contact.telegram;
            telegramLink.target = "_blank";
            telegramLink.rel = "noopener noreferrer";
            telegramLink.textContent = "Написать в Telegram";
            container.appendChild(telegramLink);
        }
    }

    function buildLeadCard() {
        var wrap = document.createElement("section");
        wrap.className = "chat-widget__lead-card";
        wrap.innerHTML =
            '<div class="chat-widget__lead-title">Передать вопрос в заявки</div>' +
            '<p class="chat-widget__lead-note">Оставьте имя, способ связи и вопрос. Я получу его в админке и в Telegram.</p>' +
            '<label class="chat-widget__field-group">' +
                '<span class="chat-widget__field-label">Ваше имя</span>' +
                '<input class="chat-widget__field" id="chat-lead-name" type="text" value="' + escapeAttr(state.leadForm.name) + '" placeholder="Например, Анна">' +
            "</label>" +
            '<div class="chat-widget__field-group">' +
                '<span class="chat-widget__field-label">Как удобнее связаться</span>' +
                '<div class="chat-widget__contact-options">' +
                    buildContactOption("telegram", "Telegram") +
                    buildContactOption("phone", "Телефон") +
                    buildContactOption("email", "Email") +
                "</div>" +
            "</div>" +
            '<label class="chat-widget__field-group">' +
                '<span class="chat-widget__field-label">' + escapeHtml(getContactLabel()) + "</span>" +
                '<input class="chat-widget__field" id="chat-lead-contact" type="text" value="' + escapeAttr(state.leadForm.contactValue) + '" placeholder="' + escapeAttr(getContactPlaceholder()) + '">' +
            "</label>" +
            '<label class="chat-widget__field-group">' +
                '<span class="chat-widget__field-label">Коротко о задаче</span>' +
                '<textarea class="chat-widget__textarea" id="chat-lead-question" placeholder="Опишите сайт, задачу или вопрос">' + escapeHtml(state.leadForm.question) + "</textarea>" +
            "</label>" +
            '<label class="chat-widget__consent">' +
                '<input id="chat-lead-consent" type="checkbox"' + (state.leadForm.consent ? " checked" : "") + ">" +
                '<span>Согласен(а) на обработку персональных данных по <a href="privacy.html" target="_blank" rel="noopener noreferrer">политике конфиденциальности</a>.</span>' +
            "</label>" +
            (state.leadError ? '<div class="chat-widget__error">' + escapeHtml(state.leadError) + "</div>" : "") +
            '<div class="chat-widget__form-actions">' +
                '<button class="chat-widget__back" id="chat-lead-back" type="button">Вернуться к чату</button>' +
                '<button class="chat-widget__submit" id="chat-lead-submit" type="button"' + (state.loading ? " disabled" : "") + ">" +
                    (state.loading ? "Отправка..." : "Отправить заявку") +
                "</button>" +
            "</div>";

        bindLeadCard(wrap);
        return wrap;
    }

    function buildContactOption(value, label) {
        return '<label class="chat-widget__contact-option">' +
            '<input type="radio" name="chat-contact-type" value="' + value + '"' + (state.leadForm.contactType === value ? " checked" : "") + ">" +
            "<span>" + label + "</span>" +
        "</label>";
    }

    function bindLeadCard(scope) {
        var nameInput = scope.querySelector("#chat-lead-name");
        var contactInput = scope.querySelector("#chat-lead-contact");
        var questionInput = scope.querySelector("#chat-lead-question");
        var consentInput = scope.querySelector("#chat-lead-consent");
        var submitButton = scope.querySelector("#chat-lead-submit");
        var backButton = scope.querySelector("#chat-lead-back");

        scope.querySelectorAll('input[name="chat-contact-type"]').forEach(function (input) {
            input.addEventListener("change", function () {
                state.leadForm.contactType = input.value;
                render();
            });
        });

        if (nameInput) {
            nameInput.addEventListener("input", function () {
                state.leadForm.name = nameInput.value;
            });
        }

        if (contactInput) {
            contactInput.addEventListener("input", function () {
                state.leadForm.contactValue = contactInput.value;
            });
        }

        if (questionInput) {
            questionInput.addEventListener("input", function () {
                state.leadForm.question = questionInput.value;
            });
        }

        if (consentInput) {
            consentInput.addEventListener("change", function () {
                state.leadForm.consent = consentInput.checked;
            });
        }

        if (submitButton) {
            submitButton.addEventListener("click", submitLead);
        }

        if (backButton) {
            backButton.addEventListener("click", function () {
                state.leadMode = false;
                state.leadError = "";
                render();
            });
        }
    }

    function submitMessage(rawValue) {
        var message = (rawValue || "").trim();
        if (!message || state.loading) return;

        state.hasInteraction = true;
        if (!state.leadForm.question) {
            state.leadForm.question = message;
        }

        addMessage("user", message);

        if (!state.apiConfigured) {
            showFallbackMessage();
            return;
        }

        state.loading = true;
        renderComposer();

        createSession()
            .then(function () {
                return fetch(buildApiUrl("/api/chat/message"), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        sessionId: state.sessionId,
                        message: message,
                        sourcePage: window.location.pathname + window.location.search,
                        referrer: document.referrer || ""
                    })
                });
            })
            .then(function (response) {
                if (!response.ok) {
                    return response.json().then(function (payload) {
                        throw new Error(payload && payload.error ? payload.error : "Request failed");
                    }).catch(function () {
                        throw new Error("Request failed");
                    });
                }
                return response.json();
            })
            .then(function (payload) {
                addMessage("bot", payload.reply || "Спасибо! Я передам вопрос дальше.");
                state.suggestions = payload.showLeadCta ? ["Оставить заявку"] : [];
                if (payload.nextStep === "capture_lead") {
                    openLeadMode();
                } else {
                    render();
                }
            })
            .catch(function () {
                showFallbackMessage();
            })
            .finally(function () {
                state.loading = false;
                renderComposer();
                var input = composerEl && composerEl.querySelector("#chat-widget-input");
                if (input) {
                    input.value = "";
                }
            });
    }

    function createSession() {
        if (state.sessionId) {
            return Promise.resolve(state.sessionId);
        }

        return fetch(buildApiUrl("/api/chat/session"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                sourcePage: window.location.pathname + window.location.search,
                referrer: document.referrer || "",
                userAgent: navigator.userAgent
            })
        })
            .then(function (response) {
                if (!response.ok) throw new Error("Failed to create session");
                return response.json();
            })
            .then(function (payload) {
                state.sessionId = payload.sessionId;
                return state.sessionId;
            });
    }

    function openLeadMode() {
        state.hasInteraction = true;
        state.leadMode = true;
        state.leadError = "";

        if (!hasCapturePromptMessage()) {
            addMessage("bot", state.content.chatBot.capturePrompt);
        }

        render();
        focusPrimaryControl();
    }

    function hasCapturePromptMessage() {
        return state.messages.some(function (message) {
            return message.role === "bot" && message.text === state.content.chatBot.capturePrompt;
        });
    }

    function submitLead() {
        if (state.loading) return;

        state.leadError = validateLead();
        if (state.leadError) {
            render();
            return;
        }

        if (!state.apiConfigured) {
            state.leadError = "Backend ещё не подключён. Пока используйте Telegram.";
            render();
            return;
        }

        state.loading = true;
        render();

        createSession()
            .then(function () {
                return fetch(buildApiUrl("/api/chat/lead"), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        sessionId: state.sessionId,
                        name: state.leadForm.name.trim(),
                        contactType: state.leadForm.contactType,
                        contactValue: state.leadForm.contactValue.trim(),
                        question: state.leadForm.question.trim(),
                        consent: state.leadForm.consent,
                        sourcePage: window.location.pathname + window.location.search,
                        referrer: document.referrer || ""
                    })
                });
            })
            .then(function (response) {
                if (!response.ok) {
                    return response.json().then(function (payload) {
                        throw new Error(payload && payload.error ? payload.error : "Lead submit failed");
                    }).catch(function () {
                        throw new Error("Lead submit failed");
                    });
                }
                return response.json();
            })
            .then(function () {
                state.leadMode = false;
                state.leadError = "";
                state.suggestions = state.apiConfigured ? state.content.chatBot.quickReplies.slice() : [];
                addMessage("bot", state.content.chatBot.successMessage);
                state.leadForm = {
                    name: "",
                    contactType: "telegram",
                    contactValue: "",
                    question: "",
                    consent: false
                };
                render();
            })
            .catch(function () {
                state.leadError = "Не удалось отправить заявку. Попробуйте ещё раз или напишите в Telegram.";
                render();
            })
            .finally(function () {
                state.loading = false;
                render();
            });
    }

    function validateLead() {
        if (!state.leadForm.name.trim()) return "Укажите имя.";
        if (!state.leadForm.contactValue.trim()) return "Укажите контакт для связи.";
        if (!state.leadForm.question.trim()) return "Опишите вопрос или задачу.";
        if (!state.leadForm.consent) return "Нужно согласие на обработку персональных данных.";
        return "";
    }

    function showFallbackMessage() {
        addMessage("bot", state.content.chatBot.fallbackMessage);
        state.suggestions = [];
        render();
    }

    function addMessage(role, text) {
        state.messages.push({
            role: role,
            text: text
        });
        renderMessages();
    }

    function getInputPlaceholder() {
        if (!state.apiConfigured) {
            return "Подключите backend API или используйте Telegram";
        }
        return "Напишите вопрос о проекте";
    }

    function getContactLabel() {
        if (state.leadForm.contactType === "phone") return "Телефон";
        if (state.leadForm.contactType === "email") return "Email";
        return "Telegram";
    }

    function getContactPlaceholder() {
        if (state.leadForm.contactType === "phone") return "+7 999 123 45 67";
        if (state.leadForm.contactType === "email") return "you@example.com";
        return "@username";
    }

    function buildApiUrl(path) {
        return apiBaseUrl + path;
    }

    function syncCookieOffset() {
        var banner = document.querySelector(".cookie-banner");
        var offset = 0;
        if (banner && !banner.hidden && !banner.classList.contains("is-hidden")) {
            offset = banner.offsetHeight + 16;
        }
        document.documentElement.style.setProperty("--snaf-chat-offset", offset + "px");
    }

    function escapeHtml(value) {
        var div = document.createElement("div");
        div.textContent = value || "";
        return div.innerHTML;
    }

    function escapeAttr(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
