(function () {
    "use strict";

    var CHAT_CONFIG = (window.SNAF_CONFIG && window.SNAF_CONFIG.chat) || {};
    if (CHAT_CONFIG.enabled === false) {
        return;
    }

    var SESSION_STORAGE_KEY = "snaf-chat-session-id";
    var OFFSET_VAR_NAME = "--snaf-chat-offset";
    var REQUEST_TIMEOUT_MS = 12000;
    var LEAD_ACTION = "\u041e\u0441\u0442\u0430\u0432\u0438\u0442\u044c \u0437\u0430\u044f\u0432\u043a\u0443";
    var UI = {
        brand: "\u0421\u041d\u0410\u0424 \u0421\u0422\u0423\u0414\u0418\u042f",
        launcher: "\u0417\u0430\u0434\u0430\u0442\u044c \u0432\u043e\u043f\u0440\u043e\u0441",
        title: "\u0427\u0430\u0442-\u0431\u043e\u0442 \u043f\u043e \u0443\u0441\u043b\u0443\u0433\u0430\u043c",
        subtitle: "\u0411\u044b\u0441\u0442\u0440\u044b\u0439 FAQ \u0438 \u043f\u0435\u0440\u0435\u0434\u0430\u0447\u0430 \u0437\u0430\u044f\u0432\u043a\u0438 \u0432 \u0440\u0430\u0431\u043e\u0442\u0443",
        close: "\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u0447\u0430\u0442",
        bot: "\u0411\u043e\u0442",
        user: "\u0412\u044b",
        send: "\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c",
        sending: "\u041e\u0442\u043f\u0440\u0430\u0432\u043a\u0430...",
        composerPlaceholder: "\u041d\u0430\u043f\u0438\u0448\u0438\u0442\u0435 \u0432\u043e\u043f\u0440\u043e\u0441 \u043e \u043f\u0440\u043e\u0435\u043a\u0442\u0435",
        telegram: "\u041d\u0430\u043f\u0438\u0441\u0430\u0442\u044c \u0432 Telegram",
        leadTitle: "\u041e\u0441\u0442\u0430\u0432\u044c\u0442\u0435 \u0438\u043c\u044f, \u0441\u043f\u043e\u0441\u043e\u0431 \u0441\u0432\u044f\u0437\u0438 \u0438 \u0432\u043e\u043f\u0440\u043e\u0441. \u042f \u043f\u043e\u043b\u0443\u0447\u0443 \u0435\u0433\u043e \u0432 \u0430\u0434\u043c\u0438\u043d\u043a\u0435 \u0438 \u0432 Telegram.",
        leadName: "\u0412\u0430\u0448\u0435 \u0438\u043c\u044f",
        leadNamePlaceholder: "\u041d\u0430\u043f\u0440\u0438\u043c\u0435\u0440, \u0410\u043d\u043d\u0430",
        leadContactType: "\u041a\u0430\u043a \u0443\u0434\u043e\u0431\u043d\u0435\u0435 \u0441\u0432\u044f\u0437\u0430\u0442\u044c\u0441\u044f",
        leadQuestion: "\u0412\u0430\u0448 \u0432\u043e\u043f\u0440\u043e\u0441",
        leadQuestionPlaceholder: "\u041a\u0440\u0430\u0442\u043a\u043e \u043e\u043f\u0438\u0448\u0438\u0442\u0435 \u0437\u0430\u0434\u0430\u0447\u0443",
        consent: "\u0421\u043e\u0433\u043b\u0430\u0441\u0435\u043d \u043d\u0430 \u043e\u0431\u0440\u0430\u0431\u043e\u0442\u043a\u0443 \u043f\u0435\u0440\u0441\u043e\u043d\u0430\u043b\u044c\u043d\u044b\u0445 \u0434\u0430\u043d\u043d\u044b\u0445",
        consentLink: "\u043f\u043e\u043b\u0438\u0442\u0438\u043a\u043e\u0439 \u043a\u043e\u043d\u0444\u0438\u0434\u0435\u043d\u0446\u0438\u0430\u043b\u044c\u043d\u043e\u0441\u0442\u0438",
        back: "\u041d\u0430\u0437\u0430\u0434",
        submitLead: "\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u0437\u0430\u044f\u0432\u043a\u0443",
        requiredName: "\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u0438\u043c\u044f.",
        requiredContact: "\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u043a\u043e\u043d\u0442\u0430\u043a\u0442, \u043f\u043e \u043a\u043e\u0442\u043e\u0440\u043e\u043c\u0443 \u043c\u043e\u0436\u043d\u043e \u0441 \u0432\u0430\u043c\u0438 \u0441\u0432\u044f\u0437\u0430\u0442\u044c\u0441\u044f.",
        requiredQuestion: "\u041e\u043f\u0438\u0448\u0438\u0442\u0435 \u0432\u043e\u043f\u0440\u043e\u0441 \u0438\u043b\u0438 \u0437\u0430\u0434\u0430\u0447\u0443.",
        requiredConsent: "\u041d\u0443\u0436\u043d\u043e \u0441\u043e\u0433\u043b\u0430\u0441\u0438\u0435 \u043d\u0430 \u043e\u0431\u0440\u0430\u0431\u043e\u0442\u043a\u0443 \u0434\u0430\u043d\u043d\u044b\u0445.",
        timeoutError: "\u0412\u0440\u0435\u043c\u044f \u043e\u0436\u0438\u0434\u0430\u043d\u0438\u044f \u0438\u0441\u0442\u0435\u043a\u043b\u043e. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0435\u0449\u0451 \u0440\u0430\u0437.",
        fallbackReply: "\u0421\u0435\u0439\u0447\u0430\u0441 \u0447\u0430\u0442 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d. \u041d\u0430\u043f\u0438\u0448\u0438\u0442\u0435 \u043c\u043d\u0435 \u0432 Telegram, \u0438 \u044f \u043e\u0442\u0432\u0435\u0447\u0443 \u0432\u0440\u0443\u0447\u043d\u0443\u044e."
    };
    var CONTACT_OPTIONS = [
        {
            value: "telegram",
            label: "Telegram",
            placeholder: "@username"
        },
        {
            value: "phone",
            label: "\u0422\u0435\u043b\u0435\u0444\u043e\u043d",
            placeholder: "+7 999 123-45-67"
        },
        {
            value: "email",
            label: "Email",
            placeholder: "mail@example.com"
        }
    ];
    var apiBaseUrl = normalizeApiBase(CHAT_CONFIG.apiBaseUrl);
    var state = {
        isOpen: false,
        isPending: false,
        isLeadSubmitting: false,
        hasConversation: false,
        sessionId: readStoredSessionId(),
        lastQuestion: "",
        messages: [],
        leadOpen: false,
        leadError: "",
        leadForm: getDefaultLeadForm(),
        content: getDefaultContent()
    };
    var dom = {};

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }

    function init() {
        if (!document.body || document.querySelector(".chat-widget")) {
            return;
        }

        state.messages = buildInitialMessages(state.content);
        createWidget();
        attachEvents();
        applyContent(window.SNAF_CONTENT);
        syncCookieOffset();
        primeSessionOnIdle();
    }

    function getDefaultLeadForm() {
        return {
            name: "",
            contactType: "telegram",
            contactValue: "",
            question: "",
            consent: true,
            website: ""
        };
    }

    function getDefaultContent() {
        return {
            launcherLabel: UI.launcher,
            greeting: "\u041f\u0440\u0438\u0432\u0435\u0442! \u042f \u043f\u043e\u043c\u043e\u0433\u0443 \u0431\u044b\u0441\u0442\u0440\u043e \u0441\u043e\u0440\u0438\u0435\u043d\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c\u0441\u044f \u043f\u043e \u0443\u0441\u043b\u0443\u0433\u0430\u043c \u0421\u041d\u0410\u0424 \u0421\u0422\u0423\u0414\u0418\u0418.",
            intro: "\u041c\u043e\u0436\u043d\u043e \u0441\u043f\u0440\u043e\u0441\u0438\u0442\u044c \u043f\u0440\u043e \u0441\u0442\u043e\u0438\u043c\u043e\u0441\u0442\u044c, \u0441\u0440\u043e\u043a\u0438, \u0444\u043e\u0440\u043c\u0430\u0442 \u0440\u0430\u0431\u043e\u0442\u044b \u0438\u043b\u0438 \u0441\u0440\u0430\u0437\u0443 \u043e\u0441\u0442\u0430\u0432\u0438\u0442\u044c \u0437\u0430\u044f\u0432\u043a\u0443.",
            quickReplies: [
                "\u0421\u0442\u043e\u0438\u043c\u043e\u0441\u0442\u044c",
                "\u0421\u0440\u043e\u043a\u0438",
                LEAD_ACTION
            ],
            capturePrompt: UI.leadTitle,
            successMessage: "\u0421\u043f\u0430\u0441\u0438\u0431\u043e! \u0417\u0430\u044f\u0432\u043a\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0430. \u042f \u043f\u043e\u0441\u043c\u043e\u0442\u0440\u044e \u0432\u043e\u043f\u0440\u043e\u0441 \u0438 \u0432\u0435\u0440\u043d\u0443\u0441\u044c \u043a \u0432\u0430\u043c \u043f\u043e \u0443\u043a\u0430\u0437\u0430\u043d\u043d\u043e\u043c\u0443 \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u0443.",
            fallbackMessage: UI.fallbackReply
        };
    }

    function createWidget() {
        var widget = document.createElement("div");
        widget.className = "chat-widget";

        var launcher = document.createElement("button");
        launcher.className = "chat-widget__launcher";
        launcher.type = "button";
        launcher.setAttribute("aria-expanded", "false");
        launcher.setAttribute("aria-controls", "snaf-chat-panel");
        launcher.innerHTML =
            '<span class="chat-widget__launcher-icon" aria-hidden="true">' +
                '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
                    '<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>' +
                "</svg>" +
            "</span>" +
            '<span class="chat-widget__launcher-text"></span>';

        var panel = document.createElement("section");
        panel.className = "chat-widget__panel";
        panel.id = "snaf-chat-panel";
        panel.setAttribute("aria-label", UI.title);

        panel.innerHTML =
            '<div class="chat-widget__header">' +
                '<div class="chat-widget__header-copy">' +
                    '<div class="chat-widget__eyebrow">' + UI.brand + "</div>" +
                    '<h2 class="chat-widget__title">' + UI.title + "</h2>" +
                    '<p class="chat-widget__subtitle">' + UI.subtitle + "</p>" +
                "</div>" +
                '<button class="chat-widget__close" type="button" aria-label="' + UI.close + '">\u00d7</button>' +
            "</div>" +
            '<div class="chat-widget__body"></div>' +
            '<div class="chat-widget__composer">' +
                '<div class="chat-widget__actions"></div>' +
                '<div class="chat-widget__links"></div>' +
                '<div class="chat-widget__composer-row">' +
                    '<input class="chat-widget__field chat-widget__message-input" type="text" autocomplete="off">' +
                    '<button class="chat-widget__submit chat-widget__send" type="button"></button>' +
                "</div>" +
            "</div>";

        widget.appendChild(panel);
        widget.appendChild(launcher);
        document.body.appendChild(widget);

        dom.widget = widget;
        dom.launcher = launcher;
        dom.launcherText = launcher.querySelector(".chat-widget__launcher-text");
        dom.panel = panel;
        dom.close = panel.querySelector(".chat-widget__close");
        dom.body = panel.querySelector(".chat-widget__body");
        dom.composer = panel.querySelector(".chat-widget__composer");
        dom.actions = panel.querySelector(".chat-widget__actions");
        dom.links = panel.querySelector(".chat-widget__links");
        dom.input = panel.querySelector(".chat-widget__message-input");
        dom.send = panel.querySelector(".chat-widget__send");

        refreshStaticLabels();
        render();
    }

    function attachEvents() {
        dom.launcher.addEventListener("click", function () {
            setOpen(!state.isOpen);
        });
        dom.close.addEventListener("click", function () {
            setOpen(false);
        });
        dom.send.addEventListener("click", function () {
            handleComposerSubmit();
        });
        dom.input.addEventListener("keydown", function (event) {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleComposerSubmit();
            }
        });
        document.addEventListener("snaf:content-loaded", function (event) {
            applyContent(event && event.detail);
        });
        document.addEventListener("click", function (event) {
            var trigger = event.target && event.target.closest
                ? event.target.closest("[data-chat-trigger]")
                : null;

            if (!trigger) {
                return;
            }

            event.preventDefault();
            setOpen(true);
        });
        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && state.isOpen) {
                setOpen(false);
            }
        });
    }

    function applyContent(data) {
        state.content = normalizeContent(data && data.chatBot);
        if (!state.hasConversation) {
            state.messages = buildInitialMessages(state.content);
        }
        refreshStaticLabels();
        render();
    }

    function normalizeContent(chatBot) {
        var defaults = getDefaultContent();
        var telegramUrl = getTelegramUrl();
        return {
            launcherLabel: safeText(chatBot && chatBot.launcherLabel) || defaults.launcherLabel,
            greeting: safeText(chatBot && chatBot.greeting) || defaults.greeting,
            intro: safeText(chatBot && chatBot.intro) || defaults.intro,
            quickReplies: normalizeQuickReplies(chatBot && chatBot.quickReplies, defaults.quickReplies),
            capturePrompt: safeText(chatBot && chatBot.capturePrompt) || defaults.capturePrompt,
            successMessage: safeText(chatBot && chatBot.successMessage) || defaults.successMessage,
            fallbackMessage: safeText(chatBot && chatBot.fallbackMessage) || defaults.fallbackMessage,
            telegramUrl: telegramUrl
        };
    }

    function normalizeQuickReplies(list, fallback) {
        var source = Array.isArray(list) && list.length ? list : fallback;
        var result = [];
        source.forEach(function (item) {
            var value = safeText(item);
            if (value && result.indexOf(value) === -1) {
                result.push(value);
            }
        });
        if (result.indexOf(LEAD_ACTION) === -1) {
            result.push(LEAD_ACTION);
        }
        return getVisibleQuickReplies(result);
    }

    function getVisibleQuickReplies(replies) {
        var primary = [];
        var hasLead = false;
        replies.forEach(function (reply) {
            if (reply === LEAD_ACTION) {
                hasLead = true;
                return;
            }
            if (primary.length < 2) {
                primary.push(reply);
            }
        });
        if (hasLead) {
            primary.push(LEAD_ACTION);
        }
        return primary.slice(0, 3);
    }

    function refreshStaticLabels() {
        if (!dom.launcherText || !dom.input || !dom.send) {
            return;
        }
        dom.launcherText.textContent = state.content.launcherLabel || UI.launcher;
        dom.input.placeholder = UI.composerPlaceholder;
        dom.send.textContent = state.isPending ? UI.sending : UI.send;
        dom.send.disabled = state.isPending;
        dom.input.disabled = state.isPending;
    }

    function render() {
        renderMessages();
        renderActions();
        renderComposer();
        syncOpenState();
    }

    function renderMessages() {
        dom.body.replaceChildren();

        state.messages.forEach(function (message) {
            dom.body.appendChild(buildMessageNode(message));
        });

        if (state.leadOpen) {
            dom.body.appendChild(buildLeadCard());
        }

        requestAnimationFrame(scrollBodyToEnd);
    }

    function buildMessageNode(message) {
        var item = document.createElement("div");
        item.className = "chat-widget__message chat-widget__message--" + message.role;

        var bubble = document.createElement("div");
        bubble.className = "chat-widget__bubble";
        bubble.textContent = message.text;

        var meta = document.createElement("div");
        meta.className = "chat-widget__message-meta";
        meta.textContent = message.role === "user" ? UI.user : UI.bot;

        item.appendChild(bubble);
        item.appendChild(meta);
        return item;
    }

    function renderActions() {
        dom.actions.replaceChildren();
        dom.links.replaceChildren();

        if (!state.leadOpen) {
            state.content.quickReplies.forEach(function (label) {
                var button = document.createElement("button");
                button.className = "chat-widget__quick-reply";
                button.type = "button";
                button.textContent = label;
                button.addEventListener("click", function () {
                    if (label === LEAD_ACTION) {
                        openLeadForm();
                        return;
                    }
                    dom.input.value = label;
                    handleComposerSubmit();
                });
                dom.actions.appendChild(button);
            });
        }

        if (state.content.telegramUrl) {
            var link = document.createElement("a");
            link.className = "chat-widget__link";
            link.href = state.content.telegramUrl;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = UI.telegram;
            dom.links.appendChild(link);
        }
    }

    function renderComposer() {
        dom.composer.hidden = state.leadOpen;
        refreshStaticLabels();
    }

    function setOpen(nextOpen) {
        if (nextOpen && state.isOpen) {
            requestAnimationFrame(function () {
                if (state.leadOpen) {
                    var firstLeadField = dom.body.querySelector(".chat-widget__lead-input");
                    if (firstLeadField) {
                        firstLeadField.focus();
                        return;
                    }
                }
                dom.input.focus();
            });
            return;
        }

        state.isOpen = Boolean(nextOpen);
        syncOpenState();
        if (state.isOpen) {
            primeSessionOnIdle();
            requestAnimationFrame(function () {
                if (state.leadOpen) {
                    var firstLeadField = dom.body.querySelector(".chat-widget__lead-input");
                    if (firstLeadField) {
                        firstLeadField.focus();
                        return;
                    }
                }
                dom.input.focus();
            });
        }
    }

    function syncOpenState() {
        if (!dom.widget || !dom.launcher) {
            return;
        }
        dom.widget.classList.toggle("is-open", state.isOpen);
        dom.launcher.setAttribute("aria-expanded", state.isOpen ? "true" : "false");
    }

    function handleComposerSubmit() {
        var text = safeText(dom.input.value);
        if (!text || state.isPending) {
            return;
        }
        sendUserMessage(text);
    }

    async function sendUserMessage(text) {
        state.isPending = true;
        state.hasConversation = true;
        state.lastQuestion = text;
        dom.input.value = "";
        state.messages.push({ role: "user", text: text });
        render();

        try {
            var sessionId = await ensureSession();
            var response = await apiRequest("/api/chat/message", {
                sessionId: sessionId,
                message: text
            });
            var reply = safeText(response && response.reply) || state.content.fallbackMessage;
            state.messages.push({ role: "bot", text: reply });
        } catch {
            state.messages.push({ role: "bot", text: state.content.fallbackMessage });
        } finally {
            state.isPending = false;
            render();
        }
    }

    function openLeadForm() {
        state.leadOpen = true;
        state.leadError = "";
        if (!state.leadForm.question) {
            state.leadForm.question = state.lastQuestion;
        }
        state.hasConversation = true;
        render();
    }

    function closeLeadForm() {
        state.leadOpen = false;
        state.leadError = "";
        render();
    }

    function buildLeadCard() {
        var card = document.createElement("form");
        card.className = "chat-widget__lead-card";

        var title = document.createElement("div");
        title.className = "chat-widget__lead-title";
        title.textContent = state.content.capturePrompt;
        card.appendChild(title);

        card.appendChild(buildFieldGroup(UI.leadName, buildTextInput("name", state.leadForm.name, UI.leadNamePlaceholder, "chat-widget__lead-input")));
        card.appendChild(buildFieldGroup(UI.leadContactType, buildContactOptions()));
        card.appendChild(buildFieldGroup(getContactLabel(), buildTextInput("contactValue", state.leadForm.contactValue, getContactPlaceholder())));
        card.appendChild(buildFieldGroup(UI.leadQuestion, buildTextarea("question", state.leadForm.question, UI.leadQuestionPlaceholder)));

        var honeypot = document.createElement("input");
        honeypot.type = "text";
        honeypot.name = "website";
        honeypot.value = state.leadForm.website;
        honeypot.autocomplete = "off";
        honeypot.tabIndex = -1;
        honeypot.hidden = true;
        card.appendChild(honeypot);

        var consentLabel = document.createElement("label");
        consentLabel.className = "chat-widget__consent";
        consentLabel.innerHTML =
            '<input type="checkbox" name="consent"' + (state.leadForm.consent ? " checked" : "") + ">" +
            "<span>" + UI.consent + ' <a href="privacy.html" target="_blank" rel="noopener noreferrer">' + UI.consentLink + "</a>.</span>";
        card.appendChild(consentLabel);

        if (state.leadError) {
            var errorNode = document.createElement("div");
            errorNode.className = "chat-widget__error";
            errorNode.textContent = state.leadError;
            card.appendChild(errorNode);
        }

        var actions = document.createElement("div");
        actions.className = "chat-widget__form-actions";

        var back = document.createElement("button");
        back.className = "chat-widget__back";
        back.type = "button";
        back.textContent = UI.back;
        back.addEventListener("click", closeLeadForm);

        var submit = document.createElement("button");
        submit.className = "chat-widget__submit";
        submit.type = "submit";
        submit.disabled = state.isLeadSubmitting;
        submit.textContent = state.isLeadSubmitting ? UI.sending : UI.submitLead;

        actions.appendChild(back);
        actions.appendChild(submit);
        card.appendChild(actions);

        card.addEventListener("input", handleLeadFormInput);
        card.addEventListener("change", handleLeadFormInput);
        card.addEventListener("submit", function (event) {
            event.preventDefault();
            submitLead();
        });

        return card;
    }

    function buildFieldGroup(label, control) {
        var group = document.createElement("div");
        group.className = "chat-widget__field-group";

        var fieldLabel = document.createElement("label");
        fieldLabel.className = "chat-widget__field-label";
        fieldLabel.textContent = label;

        group.appendChild(fieldLabel);
        group.appendChild(control);
        return group;
    }

    function buildTextInput(name, value, placeholder, extraClass) {
        var input = document.createElement("input");
        input.className = "chat-widget__field" + (extraClass ? " " + extraClass : "");
        input.type = "text";
        input.name = name;
        input.value = value || "";
        input.placeholder = placeholder || "";
        return input;
    }

    function buildTextarea(name, value, placeholder) {
        var textarea = document.createElement("textarea");
        textarea.className = "chat-widget__textarea";
        textarea.name = name;
        textarea.placeholder = placeholder || "";
        textarea.value = value || "";
        return textarea;
    }

    function buildContactOptions() {
        var wrapper = document.createElement("div");
        wrapper.className = "chat-widget__contact-options";

        CONTACT_OPTIONS.forEach(function (option) {
            var label = document.createElement("label");
            label.className = "chat-widget__contact-option";
            label.innerHTML =
                '<input type="radio" name="contactType" value="' + option.value + '"' + (state.leadForm.contactType === option.value ? " checked" : "") + ">" +
                "<span>" + option.label + "</span>";
            wrapper.appendChild(label);
        });

        return wrapper;
    }

    function handleLeadFormInput(event) {
        var target = event.target;
        if (!target || !target.name) {
            return;
        }
        if (target.type === "checkbox") {
            state.leadForm[target.name] = Boolean(target.checked);
        } else {
            state.leadForm[target.name] = target.value;
        }
        state.leadError = "";

        if (target.name === "contactType") {
            renderMessages();
        }
    }

    async function submitLead() {
        if (state.isLeadSubmitting) {
            return;
        }

        var error = validateLeadForm();
        if (error) {
            state.leadError = error;
            renderMessages();
            return;
        }

        state.isLeadSubmitting = true;
        renderMessages();

        try {
            var sessionId = await ensureSession();
            var response = await apiRequest("/api/chat/lead", {
                sessionId: sessionId,
                name: safeText(state.leadForm.name),
                contactType: state.leadForm.contactType,
                contactValue: safeText(state.leadForm.contactValue),
                question: safeText(state.leadForm.question),
                consent: Boolean(state.leadForm.consent),
                website: safeText(state.leadForm.website),
                sourcePage: window.location.pathname + window.location.search,
                referrer: document.referrer || "",
                sourceChannel: "site"
            });

            state.messages.push({
                role: "bot",
                text: safeText(response && response.message) || state.content.successMessage
            });
            state.leadForm = getDefaultLeadForm();
            state.leadOpen = false;
            state.leadError = "";
            render();
        } catch {
            state.leadError = state.content.fallbackMessage;
            renderMessages();
        } finally {
            state.isLeadSubmitting = false;
            renderMessages();
        }
    }

    function validateLeadForm() {
        if (!safeText(state.leadForm.name)) {
            return UI.requiredName;
        }
        if (!safeText(state.leadForm.contactValue)) {
            return UI.requiredContact;
        }
        if (!safeText(state.leadForm.question)) {
            return UI.requiredQuestion;
        }
        if (!state.leadForm.consent) {
            return UI.requiredConsent;
        }
        return "";
    }

    async function ensureSession() {
        if (state.sessionId) {
            return state.sessionId;
        }
        if (!apiBaseUrl) {
            throw new Error("missing api base");
        }
        var response = await apiRequest("/api/chat/session", {
            sourcePage: window.location.pathname + window.location.search,
            landingUrl: window.location.href,
            referrer: document.referrer || "",
            userAgent: window.navigator.userAgent
        });
        state.sessionId = safeText(response && response.sessionId);
        if (state.sessionId) {
            sessionStorage.setItem(SESSION_STORAGE_KEY, state.sessionId);
        }
        return state.sessionId;
    }

    function primeSessionOnIdle() {
        if (!apiBaseUrl || state.sessionId) {
            return;
        }
        var runner = function () {
            ensureSession().catch(function () {
                return null;
            });
        };
        if (typeof window.requestIdleCallback === "function") {
            window.requestIdleCallback(runner, { timeout: 1500 });
        } else {
            window.setTimeout(runner, 300);
        }
    }

    async function apiRequest(path, payload) {
        if (!apiBaseUrl) {
            throw new Error("missing api base");
        }

        var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        var timerId = controller ? window.setTimeout(function () {
            controller.abort();
        }, REQUEST_TIMEOUT_MS) : 0;

        try {
            var response = await fetch(apiBaseUrl + path, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload || {}),
                signal: controller ? controller.signal : undefined
            });
            var data = await response.json().catch(function () {
                return {};
            });
            if (!response.ok) {
                throw new Error(safeText(data && data.error) || UI.timeoutError);
            }
            return data;
        } catch (error) {
            if (error && error.name === "AbortError") {
                throw new Error(UI.timeoutError);
            }
            throw error;
        } finally {
            if (timerId) {
                window.clearTimeout(timerId);
            }
        }
    }

    function buildInitialMessages(content) {
        return [
            { role: "bot", text: content.greeting },
            { role: "bot", text: content.intro }
        ];
    }

    function getTelegramUrl() {
        return (
            safeText(window.SNAF_CONTENT && window.SNAF_CONTENT.contact && window.SNAF_CONTENT.contact.telegram) ||
            "https://t.me/smrtnivn"
        );
    }

    function getContactLabel() {
        var option = CONTACT_OPTIONS.find(function (item) {
            return item.value === state.leadForm.contactType;
        });
        return option ? option.label : UI.leadContactType;
    }

    function getContactPlaceholder() {
        var option = CONTACT_OPTIONS.find(function (item) {
            return item.value === state.leadForm.contactType;
        });
        return option ? option.placeholder : "";
    }

    function scrollBodyToEnd() {
        if (dom.body) {
            dom.body.scrollTop = dom.body.scrollHeight;
        }
    }

    function readStoredSessionId() {
        try {
            return safeText(sessionStorage.getItem(SESSION_STORAGE_KEY));
        } catch {
            return "";
        }
    }

    function safeText(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function normalizeApiBase(value) {
        var text = safeText(value);
        return text ? text.replace(/\/+$/, "") : "";
    }

    function syncCookieOffset() {
        var banner = document.querySelector(".cookie-banner");
        if (!banner) {
            document.documentElement.style.setProperty(OFFSET_VAR_NAME, "0px");
            return;
        }

        var update = function () {
            var isHidden = banner.hidden || window.getComputedStyle(banner).display === "none";
            var offset = isHidden ? 0 : Math.ceil(banner.getBoundingClientRect().height) + 12;
            document.documentElement.style.setProperty(OFFSET_VAR_NAME, offset + "px");
        };

        update();
        window.addEventListener("resize", update, { passive: true });

        if (typeof MutationObserver === "function") {
            new MutationObserver(update).observe(banner, {
                attributes: true,
                attributeFilter: ["hidden", "class", "style"]
            });
        }

        if (typeof ResizeObserver === "function") {
            new ResizeObserver(update).observe(banner);
        }
    }
})();
