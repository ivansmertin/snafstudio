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
            filter: "new",
            items: [],
            counts: { all: 0 },
            activeLeadId: null,
            activeLead: null,
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
    var inboxList = document.getElementById("inbox-list");
    var inboxDetail = document.getElementById("inbox-detail");
    var inboxFilterButtons = document.querySelectorAll("[data-inbox-filter]");

    function init() {
        if (repoOwnerInput && repoOwner) repoOwnerInput.value = repoOwner;
        if (repoNameInput && repoName) repoNameInput.value = repoName;

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
        state.backend.counts = { all: 0 };
        state.backend.activeLeadId = null;
        state.backend.activeLead = null;
        state.backend.statusText = state.backend.enabled ? "Backend ещё не авторизован" : "Подключение к backend не настроено";
        state.backend.statusType = state.backend.enabled ? "warn" : "error";

        authScreen.hidden = false;
        dashboard.hidden = true;
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
        window.open("index.html", "_blank");
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
            if (state.backend.enabled && state.backend.authed && !state.backend.loading) {
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
                setBackendStatus("Inbox подключён", "ok");
                return loadInbox();
            })
            .catch(function (error) {
                state.backend.authed = false;
                state.backend.items = [];
                state.backend.activeLead = null;
                state.backend.activeLeadId = null;
                setBackendStatus(error.message || "Не удалось авторизовать backend", "error");
                renderInbox();
                return false;
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

        return backendFetch("/api/admin/inbox?status=" + encodeURIComponent(state.backend.filter))
            .then(function (payload) {
                state.backend.items = payload.items || [];
                state.backend.counts = payload.counts || { all: state.backend.items.length };

                if (!state.backend.items.length) {
                    state.backend.activeLeadId = null;
                    state.backend.activeLead = null;
                    renderInbox();
                    return null;
                }

                var hasActive = state.backend.activeLeadId && state.backend.items.some(function (item) {
                    return item.id === state.backend.activeLeadId;
                });

                if (!hasActive) {
                    state.backend.activeLeadId = state.backend.items[0].id;
                }

                renderInbox();
                return loadLeadDetail(state.backend.activeLeadId);
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
                showToast("Заявка обновлена", "success");
                renderInbox();
                loadInbox();
            })
            .catch(function (error) {
                showToast(error.message || "Не удалось обновить заявку", "error");
            });
    }

    function renderInbox() {
        renderInboxStatus();
        renderInboxFilters();
        renderInboxList();
        renderInboxDetail();
    }

    function renderInboxStatus() {
        if (!inboxStatus) return;
        inboxStatus.textContent = state.backend.statusText;
        inboxStatus.className = "inbox-status inbox-status--" + state.backend.statusType;
    }

    function renderInboxFilters() {
        inboxFilterButtons.forEach(function (button) {
            var filter = button.getAttribute("data-inbox-filter");
            button.classList.toggle("is-active", filter === state.backend.filter);
            button.textContent = getInboxFilterLabel(filter);
        });
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
            inboxList.innerHTML = '<div class="inbox-empty">Загружаю заявки…</div>';
            return;
        }

        if (!state.backend.items.length) {
            inboxList.innerHTML = '<div class="inbox-empty">В этой выборке пока нет заявок.</div>';
            return;
        }

        inboxList.innerHTML = state.backend.items.map(function (item) {
            return (
                '<button class="inbox-item' + (item.id === state.backend.activeLeadId ? " is-active" : "") + '" type="button" data-lead-id="' + escapeAttr(item.id) + '">' +
                    '<div class="inbox-item-top">' +
                        '<div class="inbox-item-name">' + escapeHtml(item.visitorName || "Без имени") + "</div>" +
                        '<span class="inbox-badge inbox-badge--' + escapeAttr(item.status) + '">' + escapeHtml(getStatusLabel(item.status)) + "</span>" +
                    "</div>" +
                    '<div class="inbox-item-question">' + escapeHtml(item.firstQuestion || "Вопрос не указан") + "</div>" +
                    '<div class="inbox-item-meta">' + escapeHtml(formatDate(item.createdAt)) + " · " + escapeHtml(formatContactSummary(item)) + "</div>" +
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
            inboxDetail.innerHTML = '<div class="inbox-empty">После подключения backend здесь будет карточка обращения, статус и история переписки.</div>';
            return;
        }

        if (!state.backend.authed) {
            inboxDetail.innerHTML = '<div class="inbox-empty">Авторизуйтесь и убедитесь, что ваш GitHub-логин добавлен в allowlist backend-сервиса.</div>';
            return;
        }

        if (!state.backend.activeLead) {
            inboxDetail.innerHTML = '<div class="inbox-empty">Выберите заявку слева, чтобы открыть детали.</div>';
            return;
        }

        var lead = state.backend.activeLead;
        inboxDetail.innerHTML =
            '<div class="inbox-detail-card">' +
                '<div class="inbox-detail-title">' +
                    '<div>' +
                        "<h3>" + escapeHtml(lead.visitorName || "Без имени") + "</h3>" +
                        '<div class="inbox-item-meta">' + escapeHtml(formatDate(lead.createdAt)) + "</div>" +
                    "</div>" +
                    '<span class="inbox-badge inbox-badge--' + escapeAttr(lead.status) + '">' + escapeHtml(getStatusLabel(lead.status)) + "</span>" +
                "</div>" +
                '<div class="inbox-detail-grid">' +
                    buildMetaBlock("Контакт", lead.contactValue || "Не указан") +
                    buildMetaBlock("Тип контакта", getContactTypeLabel(lead.contactType)) +
                    buildMetaBlock("Страница", lead.sourcePage || "/") +
                    buildMetaBlock("Матчинг", getMatchTypeLabel(lead.matchType)) +
                "</div>" +
            "</div>" +
            '<div class="inbox-detail-card">' +
                '<div class="inbox-detail-title"><h3>Действия</h3></div>' +
                '<div class="inbox-actions">' +
                    '<button class="admin-btn admin-btn--outline admin-btn--sm" type="button" data-lead-set-status="in_progress">В работу</button>' +
                    '<button class="admin-btn admin-btn--outline admin-btn--sm" type="button" data-lead-set-status="closed">Закрыть</button>' +
                    '<button class="admin-btn admin-btn--outline admin-btn--sm" type="button" data-lead-set-status="spam">Спам</button>' +
                    '<button class="admin-btn admin-btn--outline admin-btn--sm" type="button" id="copy-contact-btn">Скопировать контакт</button>' +
                "</div>" +
            '</div>' +
            '<div class="inbox-detail-card">' +
                '<div class="inbox-detail-title"><h3>Переписка</h3></div>' +
                '<div class="inbox-transcript">' + renderTranscript(lead.transcript) + "</div>" +
            "</div>" +
            '<div class="inbox-detail-card">' +
                '<div class="inbox-detail-title"><h3>Внутренняя заметка</h3></div>' +
                '<div class="form-group">' +
                    '<textarea class="form-input inbox-note" id="lead-note-input">' + escapeHtml(lead.internalNote || "") + "</textarea>" +
                "</div>" +
                '<button class="admin-btn admin-btn--primary admin-btn--sm" type="button" id="save-note-btn">Сохранить заметку</button>' +
            "</div>";

        inboxDetail.querySelectorAll("[data-lead-set-status]").forEach(function (button) {
            button.addEventListener("click", function () {
                updateLead({
                    status: button.getAttribute("data-lead-set-status")
                });
            });
        });

        var copyButton = inboxDetail.querySelector("#copy-contact-btn");
        if (copyButton) copyButton.addEventListener("click", copyLeadContact);

        var saveNoteButton = inboxDetail.querySelector("#save-note-btn");
        if (saveNoteButton) {
            saveNoteButton.addEventListener("click", function () {
                var noteInput = inboxDetail.querySelector("#lead-note-input");
                updateLead({
                    internalNote: noteInput ? noteInput.value : ""
                });
            });
        }
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
                    return response.json().then(function (payload) {
                        throw new Error(payload.error || "Backend request failed");
                    }).catch(function () {
                        throw new Error("Backend request failed");
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
        if (!normalized.contact) normalized.contact = { phone: "", phoneHref: "", email: "", telegram: "", vk: "" };
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
