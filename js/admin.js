/**
 * Admin Panel — manages site content via GitHub Contents API
 * and lead inbox via the optional backend service.
 */
(function () {
    "use strict";

    var GITHUB_API_BASE = "https://api.github.com";
    var PREVIEW_KEY = "snaf-admin-preview";
    var BACKEND_REQUEST_TIMEOUT = 10000;
    var CHAT_DEFAULTS = {
        launcherLabel: "Задать вопрос",
        greeting: "Привет! Я помогу быстро сориентироваться по услугам СНАФ СТУДИИ.",
        intro: "Можно спросить про стоимость, сроки, формат работы или сразу оставить заявку.",
        quickReplies: ["Стоимость", "Сроки", "Что вы делаете?", "Оставить заявку"],
        capturePrompt: "Если хотите, я передам ваш вопрос в заявки. Оставьте имя и удобный контакт, и я свяжусь с вами.",
        successMessage: "Спасибо! Заявка сохранена. Я посмотрю вопрос и вернусь к вам по указанному контакту.",
        fallbackMessage: "Сейчас чат недоступен. Напишите мне в Telegram, и я отвечу вручную."
    };

    var config = window.SNAF_CONFIG || {};
    var adminConfig = config.admin || {};
    var chatConfig = config.chat || {};
    var repoOwner = adminConfig.repoOwner || "";
    var repoName = adminConfig.repoName || "";
    var contentPath = adminConfig.contentPath || "data/content.json";
    var backendBaseUrl = trimTrailingSlash(chatConfig.apiBaseUrl || "");
    var preferredLeadId = getLeadIdFromUrl();

    var state = {
        token: null,
        username: null,
        content: null,
        fileSha: null,
        activeSection: "mail",
        dirty: false,
        backend: {
            enabled: Boolean(backendBaseUrl),
            authed: false,
            loading: false,
            dashboardLoading: false,
            filter: "new",
            query: "",
            priority: "all",
            sourceChannel: "all",
            dateFrom: "",
            dateTo: "",
            assignedTo: "",
            hasReminder: "all",
            sort: "newest",
            items: [],
            dashboard: null,
            counts: { all: 0 },
            activeLeadId: null,
            activeLead: null,
            preferredLeadId: preferredLeadId,
            statusText: backendBaseUrl ? "Backend ещё не авторизован" : "Подключение к backend не настроено",
            statusType: backendBaseUrl ? "warn" : "error"
        }
    };

    var authScreen = document.getElementById("auth-screen");
    var dashboard = document.getElementById("admin-dashboard");
    var loginBtn = document.getElementById("login-btn");
    var tokenInput = document.getElementById("pat-input");
    var repoOwnerInput = document.getElementById("repo-owner");
    var repoNameInput = document.getElementById("repo-name");
    var authError = document.getElementById("auth-error");
    var usernameDisplay = document.getElementById("admin-username");
    var logoutBtn = document.getElementById("logout-btn");
    var sidebarLinks = document.querySelectorAll(".sidebar-link[data-section]");
    var sectionEditors = document.querySelectorAll(".section-editor");
    var previewBtn = document.getElementById("preview-btn");
    var publishBtn = document.getElementById("publish-btn");
    var toastEl = document.getElementById("admin-toast");
    var sidebarToggle = document.getElementById("sidebar-toggle");
    var sidebar = document.querySelector(".admin-sidebar");
    var sidebarOverlay = document.getElementById("sidebar-overlay");
    var inboxStatus = document.getElementById("inbox-status");
    var inboxRefreshBtn = document.getElementById("inbox-refresh-btn");
    var crmKpis = document.getElementById("crm-kpis");
    var crmSourceBreakdown = document.getElementById("crm-source-breakdown");
    var inboxList = document.getElementById("inbox-list");
    var inboxDetail = document.getElementById("inbox-detail");
    var inboxFilterButtons = document.querySelectorAll("[data-inbox-filter]");
    var inboxSearchInput = document.getElementById("inbox-search-input");
    var inboxPriorityFilter = document.getElementById("inbox-priority-filter");
    var inboxSourceFilter = document.getElementById("inbox-source-filter");
    var inboxSortSelect = document.getElementById("inbox-sort-select");
    var inboxDateFrom = document.getElementById("inbox-date-from");
    var inboxDateTo = document.getElementById("inbox-date-to");
    var inboxAssignedFilter = document.getElementById("inbox-assigned-filter");
    var inboxReminderFilter = document.getElementById("inbox-reminder-filter");
    var inboxApplyFiltersBtn = document.getElementById("inbox-apply-filters");
    var inboxResetFiltersBtn = document.getElementById("inbox-reset-filters");
    var inboxResultsMeta = document.getElementById("inbox-results-meta");

    function init() {
        if (repoOwnerInput && repoOwner) repoOwnerInput.value = repoOwner;
        if (repoNameInput && repoName) repoNameInput.value = repoName;
        syncFilterInputs();

        var savedToken = sessionStorage.getItem("snaf-admin-token");
        var savedUser = sessionStorage.getItem("snaf-admin-user");
        var savedOwner = sessionStorage.getItem("snaf-admin-owner");
        var savedRepo = sessionStorage.getItem("snaf-admin-repo");

        if (savedToken && savedUser) {
            state.token = savedToken;
            state.username = savedUser;
            if (savedOwner) {
                repoOwner = savedOwner;
                if (repoOwnerInput) repoOwnerInput.value = savedOwner;
            }
            if (savedRepo) {
                repoName = savedRepo;
                if (repoNameInput) repoNameInput.value = savedRepo;
            }
            showDashboard();
            loadContent();
            authenticateBackend(savedToken);
        }

        bindEvents();
        renderInbox();
    }

    function bindEvents() {
        if (loginBtn) loginBtn.addEventListener("click", handleLogin);
        if (tokenInput) {
            tokenInput.addEventListener("keydown", function (event) {
                if (event.key === "Enter") handleLogin();
            });
        }
        if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);
        if (previewBtn) previewBtn.addEventListener("click", handlePreview);
        if (publishBtn) publishBtn.addEventListener("click", handlePublish);
        if (sidebarToggle) sidebarToggle.addEventListener("click", toggleSidebar);
        if (sidebarOverlay) sidebarOverlay.addEventListener("click", closeSidebar);
        if (inboxRefreshBtn) inboxRefreshBtn.addEventListener("click", function () {
            loadDashboard();
            loadInbox();
        });

        sidebarLinks.forEach(function (link) {
            link.addEventListener("click", function () {
                switchSection(link.getAttribute("data-section"));
                closeSidebar();
            });
        });

        inboxFilterButtons.forEach(function (button) {
            button.addEventListener("click", function () {
                state.backend.filter = button.getAttribute("data-inbox-filter");
                renderInboxFilters();
                loadInbox();
            });
        });

        if (inboxApplyFiltersBtn) inboxApplyFiltersBtn.addEventListener("click", applyInboxFilters);
        if (inboxResetFiltersBtn) inboxResetFiltersBtn.addEventListener("click", resetInboxFilters);

        [inboxSearchInput, inboxPriorityFilter, inboxSourceFilter, inboxSortSelect, inboxDateFrom, inboxDateTo, inboxAssignedFilter, inboxReminderFilter].forEach(function (element) {
            if (!element) return;
            element.addEventListener("keydown", function (event) {
                if (event.key === "Enter") {
                    event.preventDefault();
                    applyInboxFilters();
                }
            });
        });
    }

    function handleLogin() {
        var token = tokenInput.value.trim();
        var owner = repoOwnerInput ? repoOwnerInput.value.trim() : repoOwner;
        var repo = repoNameInput ? repoNameInput.value.trim() : repoName;

        if (!token || !owner || !repo) {
            showAuthError("Заполните все поля");
            return;
        }

        if (authError) authError.hidden = true;
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<span class="spinner"></span> Проверка...';

        fetch(GITHUB_API_BASE + "/user", {
            headers: {
                Authorization: "token " + token
            }
        })
            .then(function (response) {
                if (!response.ok) throw new Error("Invalid token");
                return response.json();
            })
            .then(function (user) {
                state.token = token;
                state.username = user.login;
                repoOwner = owner;
                repoName = repo;

                sessionStorage.setItem("snaf-admin-token", token);
                sessionStorage.setItem("snaf-admin-user", user.login);
                sessionStorage.setItem("snaf-admin-owner", owner);
                sessionStorage.setItem("snaf-admin-repo", repo);

                showDashboard();
                loadContent();
                authenticateBackend(token);
            })
            .catch(function () {
                showAuthError("Неверный токен или нет доступа");
            })
            .finally(function () {
                loginBtn.disabled = false;
                loginBtn.textContent = "Войти";
            });
    }

    function handleLogout() {
        sessionStorage.removeItem("snaf-admin-token");
        sessionStorage.removeItem("snaf-admin-user");
        sessionStorage.removeItem("snaf-admin-owner");
        sessionStorage.removeItem("snaf-admin-repo");

        if (state.backend.enabled) {
            backendFetch("/api/admin/logout", {
                method: "POST"
            }).catch(function () {
                return null;
            });
        }

        state.token = null;
        state.username = null;
        state.content = null;
        state.fileSha = null;
        state.dirty = false;
        state.backend.authed = false;
        state.backend.items = [];
        state.backend.dashboard = null;
        state.backend.counts = { all: 0 };
        state.backend.activeLeadId = null;
        state.backend.activeLead = null;
        state.backend.filter = "new";
        state.backend.query = "";
        state.backend.priority = "all";
        state.backend.sourceChannel = "all";
        state.backend.dateFrom = "";
        state.backend.dateTo = "";
        state.backend.assignedTo = "";
        state.backend.hasReminder = "all";
        state.backend.sort = "newest";
        state.backend.preferredLeadId = "";
        state.backend.statusText = state.backend.enabled ? "Backend ещё не авторизован" : "Подключение к backend не настроено";
        state.backend.statusType = state.backend.enabled ? "warn" : "error";

        authScreen.hidden = false;
        dashboard.hidden = true;
        syncFilterInputs();
        renderInbox();
    }

    function showAuthError(message) {
        if (!authError) return;
        authError.textContent = message;
        authError.hidden = false;
    }

    function showDashboard() {
        authScreen.hidden = true;
        dashboard.hidden = false;
        if (usernameDisplay) usernameDisplay.textContent = state.username || "admin";
    }

    function loadContent() {
        if (!state.token) return Promise.resolve();

        return fetch(buildGithubContentsUrl(), {
            headers: {
                Authorization: "token " + state.token
            }
        })
            .then(function (response) {
                if (!response.ok) throw new Error("Failed to load content");
                return response.json();
            })
            .then(function (file) {
                state.fileSha = file.sha;
                state.content = normalizeContentData(parseGithubContent(file.content));
                populateEditors();
                showToast("Контент загружен", "success");
            })
            .catch(function (error) {
                showToast("Ошибка загрузки: " + error.message, "error");
            });
    }

    function populateEditors() {
        if (!state.content) return;

        document.querySelectorAll("[data-field]").forEach(function (input) {
            var value = getNestedValue(state.content, input.getAttribute("data-field"));
            if (value !== undefined) input.value = value;
        });

        buildListEditor("benefits-list", state.content.benefits.items || [], buildBenefitItem);
        buildListEditor("process-list", state.content.process.steps || [], buildProcessItem);
        buildListEditor("pricing-list", state.content.pricing.plans || [], buildPricingItem);
        buildListEditor("faq-list", state.content.faq.items || [], buildFaqItem);
        buildListEditor("tech-list", getTechBadges(state.content), buildTechItem);
        buildListEditor("chatbot-quick-replies-list", (state.content.chatBot.quickReplies || []).map(function (label) {
            return { label: label };
        }), buildQuickReplyItem);

        state.dirty = false;
        if (publishBtn) publishBtn.disabled = true;
        trackChanges();
    }

    function trackChanges() {
        document.querySelectorAll("[data-field], .list-editor-container input, .list-editor-container textarea, .list-editor-container select").forEach(function (element) {
            element.removeEventListener("input", markDirty);
            element.removeEventListener("change", markDirty);
            element.addEventListener("input", markDirty);
            element.addEventListener("change", markDirty);
        });
    }

    function markDirty() {
        state.dirty = true;
        if (publishBtn) publishBtn.disabled = false;
    }

    function buildListEditor(containerId, items, itemBuilder) {
        var container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = "";
        items.forEach(function (item, index) {
            container.appendChild(itemBuilder(item, index, containerId));
        });

        var addButton = document.createElement("button");
        addButton.type = "button";
        addButton.className = "admin-btn admin-btn--outline admin-btn--sm";
        addButton.textContent = "+ Добавить";
        addButton.addEventListener("click", function () {
            var newItem = itemBuilder(getDefaultItem(containerId), container.querySelectorAll(".list-editor-item").length, containerId);
            container.insertBefore(newItem, addButton);
            trackChanges();
            markDirty();
        });
        container.appendChild(addButton);
    }

    function getDefaultItem(containerId) {
        var defaults = {
            "benefits-list": { title: "", text: "" },
            "process-list": { number: "00", title: "", description: "", accent: false },
            "pricing-list": { name: "", range: "", price: "", features: [], accent: false, ctaLabel: "Обсудить проект", ctaStyle: "outline" },
            "faq-list": { question: "", answer: "" },
            "tech-list": { badge: "" },
            "chatbot-quick-replies-list": { label: "" }
        };
        return defaults[containerId] || {};
    }

    function wrapListItem(content, index, containerId) {
        var element = document.createElement("div");
        element.className = "list-editor-item";
        element.innerHTML =
            '<div class="item-header">' +
                '<span class="item-number">#' + (index + 1) + "</span>" +
                '<div class="item-actions">' +
                    '<button class="item-action-btn" type="button" data-action="up" title="Вверх">&#8593;</button>' +
                    '<button class="item-action-btn" type="button" data-action="down" title="Вниз">&#8595;</button>' +
                    '<button class="item-action-btn item-action-btn--delete" type="button" data-action="delete" title="Удалить">&#10005;</button>' +
                "</div>" +
            "</div>";
        element.appendChild(content);

        element.querySelectorAll("[data-action]").forEach(function (button) {
            button.addEventListener("click", function () {
                var action = button.getAttribute("data-action");
                var container = document.getElementById(containerId);
                var items = Array.from(container.querySelectorAll(".list-editor-item"));
                var currentIndex = items.indexOf(element);

                if (action === "delete") {
                    element.remove();
                } else if (action === "up" && currentIndex > 0) {
                    container.insertBefore(element, items[currentIndex - 1]);
                } else if (action === "down" && currentIndex < items.length - 1) {
                    container.insertBefore(items[currentIndex + 1], element);
                }

                renumberItems(containerId);
                trackChanges();
                markDirty();
            });
        });

        return element;
    }

    function renumberItems(containerId) {
        var container = document.getElementById(containerId);
        if (!container) return;
        container.querySelectorAll(".list-editor-item .item-number").forEach(function (element, index) {
            element.textContent = "#" + (index + 1);
        });
    }

    function buildBenefitItem(item, index, containerId) {
        var content = document.createElement("div");
        content.innerHTML =
            '<div class="form-group"><label>Заголовок</label><input class="form-input" data-list-field="title" value="' + escapeAttr(item.title) + '"></div>' +
            '<div class="form-group"><label>Текст</label><textarea class="form-input" data-list-field="text">' + escapeHtml(item.text) + "</textarea></div>";
        return wrapListItem(content, index, containerId);
    }

    function buildProcessItem(item, index, containerId) {
        var content = document.createElement("div");
        content.innerHTML =
            '<div class="form-group"><label>Номер</label><input class="form-input" data-list-field="number" value="' + escapeAttr(item.number) + '"></div>' +
            '<div class="form-group"><label>Заголовок</label><input class="form-input" data-list-field="title" value="' + escapeAttr(item.title) + '"></div>' +
            '<div class="form-group"><label>Описание</label><textarea class="form-input" data-list-field="description">' + escapeHtml(item.description) + "</textarea></div>" +
            '<div class="form-group"><label><input type="checkbox" data-list-field="accent"' + (item.accent ? " checked" : "") + '> Акцентный</label></div>';
        return wrapListItem(content, index, containerId);
    }

    function buildPricingItem(item, index, containerId) {
        var features = Array.isArray(item.features) ? item.features.join("\n") : "";
        var content = document.createElement("div");
        content.innerHTML =
            '<div class="form-group"><label>Название</label><input class="form-input" data-list-field="name" value="' + escapeAttr(item.name) + '"></div>' +
            '<div class="form-group"><label>Диапазон</label><input class="form-input" data-list-field="range" value="' + escapeAttr(item.range) + '"></div>' +
            '<div class="form-group"><label>Цена</label><input class="form-input" data-list-field="price" value="' + escapeAttr(item.price) + '"></div>' +
            '<div class="form-group"><label>Особенности (каждая с новой строки)</label><textarea class="form-input" data-list-field="features">' + escapeHtml(features) + "</textarea></div>" +
            '<div class="form-group"><label>Текст кнопки</label><input class="form-input" data-list-field="ctaLabel" value="' + escapeAttr(item.ctaLabel || "Обсудить проект") + '"></div>' +
            '<div class="form-group"><label><input type="checkbox" data-list-field="accent"' + (item.accent ? " checked" : "") + '> Акцентный тариф</label></div>';
        return wrapListItem(content, index, containerId);
    }

    function buildFaqItem(item, index, containerId) {
        var content = document.createElement("div");
        content.innerHTML =
            '<div class="form-group"><label>Вопрос</label><input class="form-input" data-list-field="question" value="' + escapeAttr(item.question) + '"></div>' +
            '<div class="form-group"><label>Ответ</label><textarea class="form-input" data-list-field="answer">' + escapeHtml(item.answer) + "</textarea></div>";
        return wrapListItem(content, index, containerId);
    }

    function buildTechItem(item, index, containerId) {
        var content = document.createElement("div");
        content.innerHTML =
            '<div class="form-group"><label>Технология</label><input class="form-input" data-list-field="badge" value="' + escapeAttr(item.badge) + '"></div>';
        return wrapListItem(content, index, containerId);
    }

    function buildQuickReplyItem(item, index, containerId) {
        var content = document.createElement("div");
        content.innerHTML =
            '<div class="form-group"><label>Быстрый ответ</label><input class="form-input" data-list-field="label" value="' + escapeAttr(item.label) + '"></div>';
        return wrapListItem(content, index, containerId);
    }

    function handlePreview() {
        if (!state.content) return;
        try {
            localStorage.setItem(PREVIEW_KEY, JSON.stringify(collectContent()));
        } catch (error) {
            showToast("Не удалось сохранить превью", "error");
            return;
        }
        window.open("index.html?preview=1", "_blank");
    }

    function handlePublish() {
        if (!state.token || !state.fileSha || !state.content) return;

        var data = collectContent();
        var json = JSON.stringify(data, null, 2);
        var encoded = btoa(unescape(encodeURIComponent(json)));

        publishBtn.disabled = true;
        publishBtn.innerHTML = '<span class="spinner"></span> Сохранение...';

        fetch(buildGithubContentsUrl(), {
            method: "PUT",
            headers: {
                Authorization: "token " + state.token,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: "Update site content via admin panel",
                content: encoded,
                sha: state.fileSha
            })
        })
            .then(function (response) {
                if (!response.ok) {
                    return response.json().then(function (payload) {
                        throw new Error(payload.message || "Publish failed");
                    });
                }
                return response.json();
            })
            .then(function (result) {
                state.fileSha = result.content.sha;
                state.content = normalizeContentData(data);
                state.dirty = false;
                publishBtn.disabled = true;
                showToast("Опубликовано! GitHub Pages обновится через 1–2 минуты.", "success");
            })
            .catch(function (error) {
                showToast("Ошибка публикации: " + error.message, "error");
            })
            .finally(function () {
                publishBtn.textContent = "Сохранить и опубликовать";
            });
    }

    function collectContent() {
        var data = JSON.parse(JSON.stringify(state.content));

        document.querySelectorAll("[data-field]").forEach(function (input) {
            setNestedValue(data, input.getAttribute("data-field"), input.value);
        });

        if (data.contact) {
            delete data.contact.phone;
            delete data.contact.phoneHref;
        }

        data.benefits.items = collectListItems("benefits-list", ["title", "text"]);
        data.process.steps = collectListItems("process-list", ["number", "title", "description"], ["accent"]);
        data.pricing.plans = collectPricingItems();
        data.faq.items = collectListItems("faq-list", ["question", "answer"]);

        var techStat = (data.about.stats || []).find(function (item) {
            return item.type === "tech";
        });
        if (techStat) {
            techStat.badges = collectListItems("tech-list", ["badge"]).map(function (item) {
                return item.badge;
            }).filter(Boolean);
        }

        data.chatBot.quickReplies = collectListItems("chatbot-quick-replies-list", ["label"])
            .map(function (item) { return item.label.trim(); })
            .filter(Boolean);

        if (!data.footer) data.footer = {};
        if (data.contact && data.contact.email) {
            data.footer.email = data.contact.email;
        }

        if (!data.meta) data.meta = {};
        data.meta.lastModified = new Date().toISOString();
        data.meta.modifiedBy = state.username;

        return normalizeContentData(data);
    }

    function collectListItems(containerId, textFields, boolFields) {
        var container = document.getElementById(containerId);
        if (!container) return [];

        var items = [];
        container.querySelectorAll(".list-editor-item").forEach(function (element) {
            var item = {};

            (textFields || []).forEach(function (field) {
                var input = element.querySelector('[data-list-field="' + field + '"]');
                if (input) item[field] = input.value;
            });

            (boolFields || []).forEach(function (field) {
                var input = element.querySelector('[data-list-field="' + field + '"]');
                if (input) item[field] = input.checked;
            });

            items.push(item);
        });

        return items;
    }

    function collectPricingItems() {
        var container = document.getElementById("pricing-list");
        if (!container) return [];

        var items = [];
        container.querySelectorAll(".list-editor-item").forEach(function (element) {
            var item = {};
            ["name", "range", "price", "ctaLabel"].forEach(function (field) {
                var input = element.querySelector('[data-list-field="' + field + '"]');
                item[field] = input ? input.value : "";
            });

            var featuresInput = element.querySelector('[data-list-field="features"]');
            var accentInput = element.querySelector('[data-list-field="accent"]');

            item.features = featuresInput
                ? featuresInput.value.split("\n").map(function (line) { return line.trim(); }).filter(Boolean)
                : [];
            item.accent = accentInput ? accentInput.checked : false;
            item.ctaStyle = item.accent ? "primary" : "outline";

            items.push(item);
        });

        return items;
    }

    function switchSection(sectionId) {
        state.activeSection = sectionId;

        sidebarLinks.forEach(function (link) {
            link.classList.toggle("is-active", link.getAttribute("data-section") === sectionId);
        });

        sectionEditors.forEach(function (editor) {
            editor.classList.toggle("is-visible", editor.getAttribute("data-editor") === sectionId);
        });

        if (sectionId === "inbox") {
            renderInbox();
            if (state.backend.enabled && state.backend.authed) {
                loadDashboard();
                loadInbox();
            }
        }
    }

    function toggleSidebar() {
        if (!sidebar) return;
        sidebar.classList.toggle("is-open");
        if (sidebarOverlay) sidebarOverlay.classList.toggle("is-visible");
    }

    function closeSidebar() {
        if (!sidebar) return;
        sidebar.classList.remove("is-open");
        if (sidebarOverlay) sidebarOverlay.classList.remove("is-visible");
    }

    function syncFilterInputs() {
        if (inboxSearchInput) inboxSearchInput.value = state.backend.query;
        if (inboxPriorityFilter) inboxPriorityFilter.value = state.backend.priority;
        if (inboxSourceFilter) inboxSourceFilter.value = state.backend.sourceChannel === "all" ? "" : state.backend.sourceChannel;
        if (inboxSortSelect) inboxSortSelect.value = state.backend.sort;
        if (inboxDateFrom) inboxDateFrom.value = state.backend.dateFrom;
        if (inboxDateTo) inboxDateTo.value = state.backend.dateTo;
        if (inboxAssignedFilter) inboxAssignedFilter.value = state.backend.assignedTo;
        if (inboxReminderFilter) inboxReminderFilter.value = state.backend.hasReminder;
    }

    function applyInboxFilters() {
        state.backend.query = inboxSearchInput ? inboxSearchInput.value.trim() : "";
        state.backend.priority = inboxPriorityFilter ? inboxPriorityFilter.value : "all";
        state.backend.sourceChannel = inboxSourceFilter && inboxSourceFilter.value.trim() ? inboxSourceFilter.value.trim().toLowerCase() : "all";
        state.backend.sort = inboxSortSelect ? inboxSortSelect.value : "newest";
        state.backend.dateFrom = inboxDateFrom ? inboxDateFrom.value : "";
        state.backend.dateTo = inboxDateTo ? inboxDateTo.value : "";
        state.backend.assignedTo = inboxAssignedFilter ? inboxAssignedFilter.value.trim() : "";
        state.backend.hasReminder = inboxReminderFilter ? inboxReminderFilter.value : "all";
        loadInbox();
    }

    function resetInboxFilters() {
        state.backend.query = "";
        state.backend.priority = "all";
        state.backend.sourceChannel = "all";
        state.backend.sort = "newest";
        state.backend.dateFrom = "";
        state.backend.dateTo = "";
        state.backend.assignedTo = "";
        state.backend.hasReminder = "all";
        syncFilterInputs();
        loadInbox();
    }

    function authenticateBackend(token) {
        if (!state.backend.enabled) {
            renderInbox();
            return Promise.resolve(false);
        }

        setBackendStatus("Проверяю доступ к backend…", "warn");
        return backendFetch("/api/admin/auth/github", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                token: token
            })
        })
            .then(function () {
                state.backend.authed = true;
                setBackendStatus("Mini-CRM подключена", "ok");
                return Promise.all([loadDashboard(), loadInbox()]);
            })
            .catch(function (error) {
                state.backend.authed = false;
                state.backend.items = [];
                state.backend.dashboard = null;
                state.backend.activeLead = null;
                state.backend.activeLeadId = null;
                setBackendStatus(error.message || "Не удалось авторизовать backend", "error");
                renderInbox();
                return false;
            });
    }

    function loadDashboard() {
        if (!state.backend.enabled || !state.backend.authed) {
            renderInbox();
            return Promise.resolve();
        }

        state.backend.dashboardLoading = true;
        renderInbox();

        return backendFetch("/api/admin/dashboard")
            .then(function (payload) {
                state.backend.dashboard = payload || null;
                setBackendStatus("Mini-CRM connected", "ok");
                renderInbox();
            })
            .catch(function (error) {
                showToast(error.message || "Не удалось загрузить KPI", "error");
            })
            .finally(function () {
                state.backend.dashboardLoading = false;
                renderInbox();
            });
    }

    function loadInbox() {
        if (!state.backend.enabled) {
            renderInbox();
            return Promise.resolve();
        }

        if (!state.backend.authed) {
            renderInbox();
            return Promise.resolve();
        }

        state.backend.loading = true;
        renderInbox();

        return backendFetch("/api/admin/inbox" + buildInboxQueryString())
            .then(function (payload) {
                state.backend.items = payload.items || [];
                state.backend.counts = payload.counts || { all: state.backend.items.length };
                setBackendStatus("Mini-CRM connected", "ok");

                if (!state.backend.items.length) {
                    state.backend.activeLeadId = null;
                    state.backend.activeLead = null;
                    syncLeadUrl("");
                    renderInbox();
                    return null;
                }

                var nextActiveLeadId = state.backend.activeLeadId;
                var preferredItem = state.backend.preferredLeadId && state.backend.items.find(function (item) {
                    return item.id === state.backend.preferredLeadId;
                });

                if (preferredItem) {
                    nextActiveLeadId = preferredItem.id;
                    state.backend.preferredLeadId = null;
                } else if (!nextActiveLeadId || !state.backend.items.some(function (item) { return item.id === nextActiveLeadId; })) {
                    nextActiveLeadId = state.backend.items[0].id;
                }

                state.backend.activeLeadId = nextActiveLeadId;
                renderInbox();
                return loadLeadDetail(nextActiveLeadId);
            })
            .catch(function (error) {
                setBackendStatus(error.message || "Не удалось загрузить заявки", "error");
                renderInbox();
            })
            .finally(function () {
                state.backend.loading = false;
                renderInbox();
            });
    }

    function loadLeadDetail(leadId) {
        if (!leadId || !state.backend.authed) return Promise.resolve();

        state.backend.activeLeadId = leadId;
        syncLeadUrl(leadId);
        renderInbox();

        return backendFetch("/api/admin/inbox/" + encodeURIComponent(leadId))
            .then(function (payload) {
                state.backend.activeLead = payload.item || null;
                renderInbox();
            })
            .catch(function (error) {
                showToast(error.message || "Не удалось загрузить карточку заявки", "error");
            });
    }

    function updateLead(patch) {
        if (!state.backend.activeLeadId) return;

        return backendFetch("/api/admin/inbox/" + encodeURIComponent(state.backend.activeLeadId), {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(patch)
        })
            .then(function (payload) {
                var updatedItem = payload.item || null;
                state.backend.activeLead = updatedItem;
                state.backend.items = state.backend.items.map(function (item) {
                    return updatedItem && item.id === updatedItem.id ? updatedItem : item;
                });
                showToast("Карточка лида обновлена", "success");
                renderInbox();
                return Promise.all([loadDashboard(), loadInbox()]);
            })
            .catch(function (error) {
                showToast(error.message || "Не удалось обновить заявку", "error");
            });
    }

    function renderInbox() {
        renderInboxStatus();
        renderCrmDashboard();
        renderInboxFilters();
        renderInboxResultsMeta();
        renderInboxList();
        renderInboxDetail();
    }

    function renderInboxStatus() {
        if (!inboxStatus) return;
        inboxStatus.textContent = state.backend.statusText;
        inboxStatus.className = "inbox-status inbox-status--" + state.backend.statusType;
    }

    function renderCrmDashboard() {
        if (crmKpis) {
            if (!state.backend.enabled) {
                crmKpis.innerHTML = buildKpiGridPlaceholder("KPI появятся после подключения backend.");
            } else if (!state.backend.authed) {
                crmKpis.innerHTML = buildKpiGridPlaceholder("Авторизуйтесь, чтобы увидеть KPI и воронку.");
            } else if (state.backend.dashboardLoading && !state.backend.dashboard) {
                crmKpis.innerHTML = buildKpiGridPlaceholder("Загружаю KPI…");
            } else {
                crmKpis.innerHTML = [
                    buildKpiCard("Закрытые", getDashboardValue("closed")),
                    buildKpiCard("Спам", getDashboardValue("spam")),
                    buildKpiCard("Новые сегодня", getDashboardValue("newToday")),
                    buildKpiCard("Новые за неделю", getDashboardValue("newThisWeek")),
                    buildKpiCard("Просроченные follow-up", getDashboardValue("overdueFollowUps")),
                    buildKpiCard("В работе", getDashboardValue("inProgress")),
                    buildKpiCard("Высокий приоритет", getDashboardValue("highPriorityOpen")),
                    buildKpiCard("Средний первый ответ", formatResponseTime(getDashboardValue("avgFirstResponseMinutes")))
                ].join("");
            }
        }

        if (crmSourceBreakdown) {
            if (!state.backend.dashboard || !state.backend.dashboard.sourceBreakdown || !state.backend.dashboard.sourceBreakdown.length) {
                crmSourceBreakdown.innerHTML = '<div class="crm-source-chip">Источники появятся после первых заявок</div>';
            } else {
                crmSourceBreakdown.innerHTML = state.backend.dashboard.sourceBreakdown.map(function (row) {
                    return '<div class="crm-source-chip"><span>' + escapeHtml(row.sourceChannel || "unknown") + '</span><strong>' + escapeHtml(String(row.total)) + "</strong></div>";
                }).join("");
            }
        }
    }

    function renderInboxFilters() {
        inboxFilterButtons.forEach(function (button) {
            var filter = button.getAttribute("data-inbox-filter");
            button.classList.toggle("is-active", filter === state.backend.filter);
            button.textContent = getInboxFilterLabel(filter);
        });
        syncFilterInputs();
    }

    function renderInboxResultsMeta() {
        if (!inboxResultsMeta) return;

        var parts = [];
        if (state.backend.query) parts.push('поиск: "' + state.backend.query + '"');
        if (state.backend.priority !== "all") parts.push("приоритет: " + getPriorityLabel(state.backend.priority));
        if (state.backend.sourceChannel !== "all") parts.push("источник: " + state.backend.sourceChannel);
        if (state.backend.assignedTo) parts.push("ответственный: " + state.backend.assignedTo);
        if (state.backend.hasReminder !== "all") parts.push("напоминания: " + getReminderLabel(state.backend.hasReminder));
        if (state.backend.dateFrom || state.backend.dateTo) parts.push("период: " + (state.backend.dateFrom || "…") + " - " + (state.backend.dateTo || "…"));

        inboxResultsMeta.textContent = parts.length
            ? "Активные фильтры: " + parts.join(" · ")
            : "Показываются все заявки в выбранном статусе.";
    }

    function renderInboxList() {
        if (!inboxList) return;

        if (!state.backend.enabled) {
            inboxList.innerHTML = '<div class="inbox-empty">Укажите <code>chat.apiBaseUrl</code> в конфиге сайта, чтобы раздел «Заявки» начал работать.</div>';
            return;
        }

        if (!state.backend.authed) {
            inboxList.innerHTML = '<div class="inbox-empty">Backend доступен только после успешной авторизации через GitHub PAT и проверки allowlist на сервере.</div>';
            return;
        }

        if (state.backend.loading && !state.backend.items.length) {
            inboxList.innerHTML = '<div class="inbox-empty">Загружаю лиды и фильтры…</div>';
            return;
        }

        if (!state.backend.items.length) {
            inboxList.innerHTML = '<div class="inbox-empty">По текущим фильтрам пока нет заявок.</div>';
            return;
        }

        inboxList.innerHTML = state.backend.items.map(function (item) {
            var followUpText = getFollowUpBadgeText(item);
            return (
                '<button class="inbox-item inbox-item--priority-' + escapeAttr(item.priority || "normal") + (item.id === state.backend.activeLeadId ? " is-active" : "") + '" type="button" data-lead-id="' + escapeAttr(item.id) + '">' +
                    '<div class="inbox-item-top">' +
                        '<div class="inbox-item-name">' + escapeHtml(item.visitorName || "Без имени") + "</div>" +
                        '<div class="inbox-item-badges">' +
                            '<span class="inbox-badge inbox-badge--' + escapeAttr(item.status) + '">' + escapeHtml(getStatusLabel(item.status)) + "</span>" +
                            '<span class="inbox-badge inbox-badge--priority inbox-badge--priority-' + escapeAttr(item.priority || "normal") + '">' + escapeHtml(getPriorityLabel(item.priority)) + "</span>" +
                        "</div>" +
                    "</div>" +
                    '<div class="inbox-item-question">' + escapeHtml(item.firstQuestion || "Вопрос не указан") + "</div>" +
                    '<div class="inbox-item-meta">' + escapeHtml(formatDate(item.createdAt)) + " · " + escapeHtml(formatContactSummary(item)) + "</div>" +
                    '<div class="inbox-item-meta">' + escapeHtml("Источник: " + (item.sourceChannel || "unknown")) + (item.assignedTo ? " · " + escapeHtml("Ответственный: " + item.assignedTo) : "") + "</div>" +
                    (followUpText ? '<div class="inbox-item-follow-up">' + escapeHtml(followUpText) + "</div>" : "") +
                "</button>"
            );
        }).join("");

        inboxList.querySelectorAll("[data-lead-id]").forEach(function (button) {
            button.addEventListener("click", function () {
                loadLeadDetail(button.getAttribute("data-lead-id"));
            });
        });
    }

    function renderInboxDetail() {
        if (!inboxDetail) return;

        if (!state.backend.enabled) {
            inboxDetail.innerHTML = '<div class="inbox-empty">После подключения backend здесь будет карточка обращения, CRM-поля и таймлайн работы по лиду.</div>';
            return;
        }

        if (!state.backend.authed) {
            inboxDetail.innerHTML = '<div class="inbox-empty">Авторизуйтесь и убедитесь, что ваш GitHub-логин добавлен в allowlist backend-сервиса.</div>';
            return;
        }

        if (!state.backend.activeLead) {
            inboxDetail.innerHTML = '<div class="inbox-empty">Выберите заявку слева, чтобы открыть карточку, next step и историю действий.</div>';
            return;
        }

        var lead = state.backend.activeLead;
        var followUpValue = formatDateTimeLocalValue(lead.nextFollowUpAt);
        var lastContactValue = formatDateTimeLocalValue(lead.lastContactAt);
        inboxDetail.innerHTML =
            '<div class="inbox-detail-card">' +
                '<div class="inbox-detail-title">' +
                    '<div>' +
                        "<h3>" + escapeHtml(lead.visitorName || "Без имени") + "</h3>" +
                        '<div class="inbox-item-meta">' + escapeHtml(formatDate(lead.createdAt)) + "</div>" +
                    "</div>" +
                    '<div class="inbox-item-badges">' +
                        '<span class="inbox-badge inbox-badge--' + escapeAttr(lead.status) + '">' + escapeHtml(getStatusLabel(lead.status)) + "</span>" +
                        '<span class="inbox-badge inbox-badge--priority inbox-badge--priority-' + escapeAttr(lead.priority || "normal") + '">' + escapeHtml(getPriorityLabel(lead.priority)) + "</span>" +
                    "</div>" +
                "</div>" +
                '<div class="inbox-detail-grid">' +
                    buildMetaBlock("Контакт", lead.contactValue || "Не указан") +
                    buildMetaBlock("Тип контакта", getContactTypeLabel(lead.contactType)) +
                    buildMetaBlock("Страница", lead.sourcePage || "/") +
                    buildMetaBlock("Матчинг", getMatchTypeLabel(lead.matchType)) +
                    buildMetaBlock("Источник", lead.sourceChannel || "unknown") +
                    buildMetaBlock("UTM", formatUtmSummary(lead)) +
                    buildMetaBlock("Ответственный", lead.assignedTo || "Не назначен") +
                    buildMetaBlock("Контактов", String(lead.contactAttempts || 0)) +
                "</div>" +
            "</div>" +
            '<div class="inbox-detail-card">' +
                '<div class="inbox-detail-title"><h3>Следующее действие</h3></div>' +
                '<div class="inbox-next-step">' + escapeHtml(getNextStepText(lead)) + "</div>" +
                '<div class="inbox-item-meta">' + escapeHtml(getFollowUpBadgeText(lead) || "Follow-up не назначен") + "</div>" +
            "</div>" +
            '<div class="inbox-detail-card">' +
                '<div class="inbox-detail-title"><h3>Быстрые действия</h3></div>' +
                '<div class="inbox-actions">' +
                    buildLeadContactLink(lead) +
                    '<button class="admin-btn admin-btn--outline admin-btn--sm" type="button" data-lead-set-status="in_progress">В работу</button>' +
                    '<button class="admin-btn admin-btn--outline admin-btn--sm" type="button" data-lead-set-status="closed">Закрыть</button>' +
                    '<button class="admin-btn admin-btn--outline admin-btn--sm" type="button" data-lead-set-status="spam">Спам</button>' +
                    '<button class="admin-btn admin-btn--outline admin-btn--sm" type="button" id="copy-contact-btn">Скопировать контакт</button>' +
                    '<button class="admin-btn admin-btn--outline admin-btn--sm" type="button" id="assign-to-me-btn">Назначить меня</button>' +
                    '<button class="admin-btn admin-btn--outline admin-btn--sm" type="button" id="mark-contact-btn">Отметить контакт</button>' +
                    '<button class="admin-btn admin-btn--outline admin-btn--sm" type="button" id="set-followup-tomorrow-btn">Follow-up на завтра</button>' +
                "</div>" +
            "</div>" +
            '<div class="inbox-detail-card">' +
                '<div class="inbox-detail-title"><h3>CRM-поля</h3></div>' +
                '<div class="inbox-detail-grid inbox-detail-grid--form">' +
                    '<div class="form-group"><label>Ответственный</label><input class="form-input" id="lead-assigned-input" value="' + escapeAttr(lead.assignedTo || "") + '"></div>' +
                    '<div class="form-group"><label>Приоритет</label><select class="form-input" id="lead-priority-input">' + buildPriorityOptions(lead.priority) + "</select></div>" +
                    '<div class="form-group"><label>Источник</label><input class="form-input" id="lead-source-input" value="' + escapeAttr(lead.sourceChannel || "") + '"></div>' +
                    '<div class="form-group"><label>Follow-up</label><input class="form-input" id="lead-followup-input" type="datetime-local" value="' + escapeAttr(followUpValue) + '"></div>' +
                    '<div class="form-group"><label>Контактов</label><input class="form-input" id="lead-contact-attempts-input" type="number" min="0" step="1" value="' + escapeAttr(String(lead.contactAttempts || 0)) + '"></div>' +
                    '<div class="form-group"><label>Последний контакт</label><input class="form-input" id="lead-last-contact-input" type="datetime-local" value="' + escapeAttr(lastContactValue) + '"></div>' +
                '</div>' +
                '<div class="form-group"><label>Причина закрытия</label><input class="form-input" id="lead-closed-reason-input" value="' + escapeAttr(lead.closedReason || "") + '" placeholder="Например, неактуально / нет ответа"></div>' +
                '<div class="form-group"><label>Внутренняя заметка</label><textarea class="form-input inbox-note" id="lead-note-input">' + escapeHtml(lead.internalNote || "") + "</textarea></div>" +
                '<div class="inbox-actions"><button class="admin-btn admin-btn--primary admin-btn--sm" type="button" id="save-crm-btn">Сохранить поля</button></div>' +
            "</div>" +
            '<div class="inbox-detail-card">' +
                '<div class="inbox-detail-title"><h3>Переписка</h3></div>' +
                '<div class="inbox-transcript">' + renderTranscript(lead.transcript) + "</div>" +
            "</div>" +
            '<div class="inbox-detail-card">' +
                '<div class="inbox-detail-title"><h3>Таймлайн</h3></div>' +
                '<div class="inbox-events">' + renderLeadEvents(lead.events) + "</div>" +
            "</div>";

        bindLeadDetailActions(lead);
    }

    function renderTranscript(transcript) {
        if (!Array.isArray(transcript) || !transcript.length) {
            return '<div class="inbox-empty">В истории переписки пока ничего нет.</div>';
        }

        return transcript.map(function (entry) {
            return (
                '<div class="inbox-transcript-message inbox-transcript-message--' + escapeAttr(getTranscriptRole(entry)) + '">' +
                    '<div class="inbox-transcript-role">' + escapeHtml(getTranscriptRoleLabel(entry)) + "</div>" +
                    '<div class="inbox-transcript-text">' + escapeHtml(formatTranscriptText(entry)) + "</div>" +
                "</div>"
            );
        }).join("");
    }

    function copyLeadContact() {
        if (!state.backend.activeLead || !state.backend.activeLead.contactValue) {
            showToast("Контакт не указан", "error");
            return;
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(state.backend.activeLead.contactValue)
                .then(function () {
                    showToast("Контакт скопирован", "success");
                })
                .catch(function () {
                    showToast("Не удалось скопировать контакт", "error");
                });
            return;
        }

        showToast("Буфер обмена недоступен в этом браузере", "error");
    }

    function backendFetch(path, options) {
        if (!state.backend.enabled) {
            return Promise.reject(new Error("Backend не подключён"));
        }

        var requestOptions = options || {};
        var controller = "AbortController" in window ? new AbortController() : null;
        var timer = null;

        if (controller) {
            timer = window.setTimeout(function () {
                controller.abort();
            }, BACKEND_REQUEST_TIMEOUT);
        }

        return fetch(buildBackendUrl(path), {
            method: requestOptions.method || "GET",
            headers: Object.assign({}, requestOptions.headers || {}),
            body: requestOptions.body,
            credentials: "include",
            signal: controller ? controller.signal : undefined
        })
            .then(function (response) {
                if (!response.ok) {
                    return response.json().catch(function () {
                        return null;
                    }).then(function (payload) {
                        throw new Error(payload && payload.error ? payload.error : "Backend request failed");
                    });
                }
                return response.json();
            })
            .catch(function (error) {
                if (error && error.name === "AbortError") {
                    throw new Error("Backend отвечает слишком долго");
                }
                throw error;
            })
            .finally(function () {
                if (timer) window.clearTimeout(timer);
            });
    }

    function buildGithubContentsUrl() {
        return GITHUB_API_BASE + "/repos/" + repoOwner + "/" + repoName + "/contents/" + contentPath;
    }

    function buildBackendUrl(path) {
        return backendBaseUrl + (path.charAt(0) === "/" ? path : "/" + path);
    }

    function buildInboxQueryString() {
        var params = new URLSearchParams();
        params.set("status", state.backend.filter);
        params.set("sort", state.backend.sort);

        if (state.backend.query) params.set("q", state.backend.query);
        if (state.backend.priority && state.backend.priority !== "all") params.set("priority", state.backend.priority);
        if (state.backend.sourceChannel && state.backend.sourceChannel !== "all") params.set("sourceChannel", state.backend.sourceChannel);
        if (state.backend.dateFrom) params.set("dateFrom", state.backend.dateFrom);
        if (state.backend.dateTo) params.set("dateTo", state.backend.dateTo);
        if (state.backend.assignedTo) params.set("assignedTo", state.backend.assignedTo);
        if (state.backend.hasReminder && state.backend.hasReminder !== "all") params.set("hasReminder", state.backend.hasReminder);

        return "?" + params.toString();
    }

    function syncLeadUrl(leadId) {
        if (!window.history || !window.history.replaceState) return;

        var url = new URL(window.location.href);
        if (leadId) {
            url.searchParams.set("lead", leadId);
        } else {
            url.searchParams.delete("lead");
        }
        window.history.replaceState({}, "", url.toString());
    }

    function bindLeadDetailActions(lead) {
        inboxDetail.querySelectorAll("[data-lead-set-status]").forEach(function (button) {
            button.addEventListener("click", function () {
                var status = button.getAttribute("data-lead-set-status");
                var closedReasonInput = inboxDetail.querySelector("#lead-closed-reason-input");
                updateLead({
                    status: status,
                    closedReason: closedReasonInput ? closedReasonInput.value.trim() : lead.closedReason || ""
                });
            });
        });

        var copyButton = inboxDetail.querySelector("#copy-contact-btn");
        if (copyButton) copyButton.addEventListener("click", copyLeadContact);

        var assignButton = inboxDetail.querySelector("#assign-to-me-btn");
        if (assignButton) {
            assignButton.addEventListener("click", function () {
                updateLead({
                    assignedTo: state.username || ""
                });
            });
        }

        var markContactButton = inboxDetail.querySelector("#mark-contact-btn");
        if (markContactButton) {
            markContactButton.addEventListener("click", function () {
                updateLead({
                    status: lead.status === "new" ? "in_progress" : lead.status,
                    contactAttempts: Number(lead.contactAttempts || 0) + 1,
                    lastContactAt: new Date().toISOString()
                });
            });
        }

        var followUpTomorrowButton = inboxDetail.querySelector("#set-followup-tomorrow-btn");
        if (followUpTomorrowButton) {
            followUpTomorrowButton.addEventListener("click", function () {
                updateLead({
                    nextFollowUpAt: getTomorrowFollowUpIso()
                });
            });
        }

        var saveCrmButton = inboxDetail.querySelector("#save-crm-btn");
        if (saveCrmButton) {
            saveCrmButton.addEventListener("click", function () {
                var assignedInput = inboxDetail.querySelector("#lead-assigned-input");
                var priorityInput = inboxDetail.querySelector("#lead-priority-input");
                var sourceInput = inboxDetail.querySelector("#lead-source-input");
                var followupInput = inboxDetail.querySelector("#lead-followup-input");
                var contactAttemptsInput = inboxDetail.querySelector("#lead-contact-attempts-input");
                var lastContactInput = inboxDetail.querySelector("#lead-last-contact-input");
                var closedReasonInput = inboxDetail.querySelector("#lead-closed-reason-input");
                var noteInput = inboxDetail.querySelector("#lead-note-input");
                updateLead({
                    assignedTo: assignedInput ? assignedInput.value.trim() : "",
                    priority: priorityInput ? priorityInput.value : "normal",
                    sourceChannel: sourceInput ? sourceInput.value.trim().toLowerCase() : "",
                    nextFollowUpAt: followupInput && followupInput.value ? new Date(followupInput.value).toISOString() : "",
                    contactAttempts: contactAttemptsInput ? Number(contactAttemptsInput.value || 0) : 0,
                    lastContactAt: lastContactInput && lastContactInput.value ? new Date(lastContactInput.value).toISOString() : "",
                    closedReason: closedReasonInput ? closedReasonInput.value.trim() : "",
                    internalNote: noteInput ? noteInput.value : ""
                });
            });
        }
    }

    function setBackendStatus(text, type) {
        state.backend.statusText = text;
        state.backend.statusType = type;
        renderInboxStatus();
    }

    function parseGithubContent(base64Content) {
        var decoded = atob(String(base64Content || "").replace(/\n/g, ""));
        var bytes = new Uint8Array(decoded.length);
        for (var index = 0; index < decoded.length; index += 1) {
            bytes[index] = decoded.charCodeAt(index);
        }
        return JSON.parse(new TextDecoder("utf-8").decode(bytes));
    }

    function normalizeContentData(data) {
        var normalized = data || {};

        if (!normalized.meta) normalized.meta = {};
        if (!normalized.contact) normalized.contact = { email: "", telegram: "", vk: "" };
        if (!normalized.hero) normalized.hero = {};
        if (!normalized.about) normalized.about = { stats: [] };
        if (!Array.isArray(normalized.about.stats)) normalized.about.stats = [];
        if (!normalized.benefits) normalized.benefits = { items: [] };
        if (!Array.isArray(normalized.benefits.items)) normalized.benefits.items = [];
        if (!normalized.process) normalized.process = { steps: [] };
        if (!Array.isArray(normalized.process.steps)) normalized.process.steps = [];
        if (!normalized.pricing) normalized.pricing = { plans: [] };
        if (!Array.isArray(normalized.pricing.plans)) normalized.pricing.plans = [];
        if (!normalized.faq) normalized.faq = { items: [], defaultOpen: 2 };
        if (!Array.isArray(normalized.faq.items)) normalized.faq.items = [];
        if (!normalized.chatBot) normalized.chatBot = {};
        if (!Array.isArray(normalized.chatBot.quickReplies)) normalized.chatBot.quickReplies = CHAT_DEFAULTS.quickReplies.slice();
        Object.keys(CHAT_DEFAULTS).forEach(function (key) {
            if (normalized.chatBot[key] === undefined || normalized.chatBot[key] === null || normalized.chatBot[key] === "") {
                normalized.chatBot[key] = Array.isArray(CHAT_DEFAULTS[key]) ? CHAT_DEFAULTS[key].slice() : CHAT_DEFAULTS[key];
            }
        });
        if (!normalized.cta) normalized.cta = {};
        if (!normalized.footer) normalized.footer = {};
        if (normalized.contact.email) normalized.footer.email = normalized.contact.email;

        return normalized;
    }

    function getTechBadges(data) {
        var tech = (data.about.stats || []).find(function (item) {
            return item.type === "tech";
        });
        return tech && Array.isArray(tech.badges)
            ? tech.badges.map(function (badge) { return { badge: badge }; })
            : [];
    }

    function getLeadIdFromUrl() {
        try {
            return new URL(window.location.href).searchParams.get("lead") || "";
        } catch (error) {
            return "";
        }
    }

    function buildKpiGridPlaceholder(message) {
        return '<div class="crm-kpi-card crm-kpi-card--placeholder"><span class="crm-kpi-label">' + escapeHtml(message) + "</span></div>";
    }

    function buildKpiCard(label, value) {
        return '<div class="crm-kpi-card"><span class="crm-kpi-label">' + escapeHtml(label) + '</span><strong class="crm-kpi-value">' + escapeHtml(String(value)) + "</strong></div>";
    }

    function getDashboardValue(key) {
        if (!state.backend.dashboard || state.backend.dashboard[key] === undefined || state.backend.dashboard[key] === null) {
            return "—";
        }
        return state.backend.dashboard[key];
    }

    function formatResponseTime(value) {
        if (value === "—") return value;
        if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
        return Number(value) + " мин";
    }

    function getInboxFilterLabel(filter) {
        var labels = {
            new: "Новые",
            in_progress: "В работе",
            closed: "Закрытые",
            spam: "Спам",
            all: "Все"
        };
        var count = state.backend.counts[filter];
        return labels[filter] + (count !== undefined ? " (" + count + ")" : "");
    }

    function getPriorityLabel(priority) {
        var labels = {
            low: "Низкий",
            normal: "Обычный",
            high: "Высокий",
            urgent: "Срочный"
        };
        return labels[priority] || "Обычный";
    }

    function getReminderLabel(value) {
        var labels = {
            with_reminder: "есть follow-up",
            overdue: "просроченные",
            none: "без follow-up"
        };
        return labels[value] || value || "все";
    }

    function getStatusLabel(status) {
        var labels = {
            new: "Новая",
            in_progress: "В работе",
            closed: "Закрыта",
            spam: "Спам"
        };
        return labels[status] || status || "—";
    }

    function getMatchTypeLabel(matchType) {
        var labels = {
            faq: "FAQ",
            pricing: "Стоимость",
            fallback: "Fallback",
            handoff: "Передача человеку"
        };
        return labels[matchType] || "—";
    }

    function getContactTypeLabel(type) {
        var labels = {
            telegram: "Telegram",
            phone: "Телефон",
            email: "Email"
        };
        return labels[type] || "—";
    }

    function formatContactSummary(item) {
        return getContactTypeLabel(item.contactType) + ": " + (item.contactValue || "не указан");
    }

    function formatDate(dateString) {
        if (!dateString) return "—";
        try {
            return new Intl.DateTimeFormat("ru-RU", {
                dateStyle: "medium",
                timeStyle: "short"
            }).format(new Date(dateString));
        } catch (error) {
            return dateString;
        }
    }

    function buildMetaBlock(label, value) {
        return (
            '<div>' +
                '<div class="inbox-meta-label">' + escapeHtml(label) + "</div>" +
                '<div class="inbox-meta-value">' + escapeHtml(value || "—") + "</div>" +
            "</div>"
        );
    }

    function buildLeadContactLink(lead) {
        if (lead.contactType === "phone" && lead.contactValue) {
            return '<a class="admin-btn admin-btn--outline admin-btn--sm" href="' + escapeAttr(normalizePhoneHref(lead.contactValue)) + '">Перезвонить</a>';
        }
        if (lead.contactType === "email" && lead.contactValue) {
            return '<a class="admin-btn admin-btn--outline admin-btn--sm" href="mailto:' + escapeAttr(lead.contactValue) + '">Написать email</a>';
        }
        if (lead.contactType === "telegram" && lead.contactValue) {
            return '<a class="admin-btn admin-btn--outline admin-btn--sm" href="' + escapeAttr(normalizeTelegramHref(lead.contactValue)) + '" target="_blank" rel="noopener noreferrer">Написать в Telegram</a>';
        }
        return "";
    }

    function buildPriorityOptions(selected) {
        return ["urgent", "high", "normal", "low"].map(function (priority) {
            return '<option value="' + priority + '"' + (priority === (selected || "normal") ? " selected" : "") + '>' + getPriorityLabel(priority) + "</option>";
        }).join("");
    }

    function renderLeadEvents(events) {
        if (!Array.isArray(events) || !events.length) {
            return '<div class="inbox-empty">События появятся после первых действий по лиду.</div>';
        }

        return events.map(function (event) {
            return (
                '<div class="inbox-event">' +
                    '<div class="inbox-event-top">' +
                        '<strong>' + escapeHtml(event.summary || event.type) + "</strong>" +
                        '<span>' + escapeHtml(formatDate(event.createdAt)) + "</span>" +
                    "</div>" +
                    '<div class="inbox-item-meta">' + escapeHtml("Автор: " + (event.actor || "system")) + "</div>" +
                "</div>"
            );
        }).join("");
    }

    function formatUtmSummary(lead) {
        var parts = [lead.utmSource, lead.utmMedium, lead.utmCampaign].filter(Boolean);
        return parts.length ? parts.join(" / ") : "—";
    }

    function getNextStepText(lead) {
        if (lead.status === "new") return "Оценить лид, назначить ответственного и сделать первый контакт.";
        if (lead.status === "in_progress") return lead.nextFollowUpAt ? "Проверить follow-up и обновить статус после контакта." : "Зафиксировать следующий контакт или закрыть лид.";
        if (lead.status === "closed") return lead.closedReason ? "Лид закрыт: " + lead.closedReason : "Лид закрыт. При необходимости можно переоткрыть вручную.";
        return "Лид помечен как спам.";
    }

    function getFollowUpBadgeText(item) {
        if (!item || !item.nextFollowUpAt) return "";

        var timestamp = new Date(item.nextFollowUpAt).getTime();
        if (Number.isNaN(timestamp)) return "Follow-up: " + item.nextFollowUpAt;
        if (timestamp < Date.now() && item.status !== "closed" && item.status !== "spam") {
            return "Просрочен follow-up: " + formatDate(item.nextFollowUpAt);
        }
        return "Follow-up: " + formatDate(item.nextFollowUpAt);
    }

    function formatDateTimeLocalValue(dateString) {
        if (!dateString) return "";
        var date = new Date(dateString);
        if (Number.isNaN(date.getTime())) return "";
        var pad = function (value) { return String(value).padStart(2, "0"); };
        return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) + "T" + pad(date.getHours()) + ":" + pad(date.getMinutes());
    }

    function getTomorrowFollowUpIso() {
        var next = new Date();
        next.setDate(next.getDate() + 1);
        next.setHours(10, 0, 0, 0);
        return next.toISOString();
    }

    function normalizePhoneHref(value) {
        var digits = String(value || "").replace(/[^\d+]/g, "");
        return digits.indexOf("tel:") === 0 ? digits : "tel:" + digits;
    }

    function normalizeTelegramHref(value) {
        var trimmed = String(value || "").trim();
        if (!trimmed) return "#";
        if (trimmed.indexOf("http://") === 0 || trimmed.indexOf("https://") === 0) return trimmed;
        if (trimmed.charAt(0) === "@") return "https://t.me/" + trimmed.slice(1);
        return "https://t.me/" + trimmed.replace(/^t\.me\//, "");
    }

    function getTranscriptRole(entry) {
        if (!entry || !entry.role) return "system";
        if (entry.role === "user" || entry.role === "bot") return entry.role;
        return "system";
    }

    function getTranscriptRoleLabel(entry) {
        var role = getTranscriptRole(entry);
        if (role === "user") return "Пользователь";
        if (role === "bot") return "Бот";
        return "Система";
    }

    function formatTranscriptText(entry) {
        if (!entry) return "";
        if (entry.type === "lead_submission" && entry.payload) {
            return "Заявка отправлена. Контакт: " + (entry.payload.contactType || "—") + " — " + (entry.payload.contactValue || "—");
        }
        if (entry.type === "duplicate_submission") {
            return "Повторная заявка объединена с текущей карточкой.";
        }
        return entry.text || "";
    }

    function getNestedValue(object, path) {
        return path.split(".").reduce(function (accumulator, key) {
            return accumulator && accumulator[key] !== undefined ? accumulator[key] : undefined;
        }, object);
    }

    function setNestedValue(object, path, value) {
        var keys = path.split(".");
        var lastKey = keys.pop();
        var target = keys.reduce(function (accumulator, key) {
            if (!accumulator[key]) accumulator[key] = {};
            return accumulator[key];
        }, object);
        target[lastKey] = value;
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

    function trimTrailingSlash(value) {
        return String(value || "").replace(/\/+$/, "");
    }

    function showToast(message, type) {
        if (!toastEl) return;
        toastEl.textContent = message;
        toastEl.className = "admin-toast admin-toast--" + type + " is-visible";
        window.setTimeout(function () {
            toastEl.classList.remove("is-visible");
        }, 3500);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
