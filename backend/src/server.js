require("dotenv").config();

const crypto = require("crypto");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const express = require("express");

const { createDatabase } = require("./database");
const { createContentCache } = require("./content-cache");
const { matchMessage } = require("./matcher");
const { sendTelegramLead } = require("./telegram");

const PORT = Number(process.env.PORT || 3000);
const ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
const GITHUB_ADMIN_ALLOWLIST = String(process.env.GITHUB_ADMIN_ALLOWLIST || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
const SESSION_SECRET = process.env.SESSION_SECRET || "change-me";
const SQLITE_PATH = process.env.SQLITE_PATH || "./data/snafstudio.sqlite";
const CONTENT_SOURCE_URL = process.env.CONTENT_SOURCE_URL || "https://snafstudio.ru/data/content.json";
const ADMIN_APP_URL = process.env.ADMIN_APP_URL || "";
const ADMIN_SESSION_TTL_HOURS = Number(process.env.ADMIN_SESSION_TTL_HOURS || 24);
const CONTENT_REFRESH_MS = Number(process.env.CONTENT_REFRESH_MS || 300000);
const COOKIE_SECURE = String(process.env.COOKIE_SECURE || "true") === "true";
const COOKIE_SAME_SITE = process.env.COOKIE_SAME_SITE || "lax";
const ADMIN_COOKIE_NAME = "snaf_admin_session";
const LEAD_STATUSES = new Set(["new", "in_progress", "closed", "spam"]);

const app = express();
const database = createDatabase(SQLITE_PATH);
const contentCache = createContentCache({
    sourceUrl: CONTENT_SOURCE_URL,
    refreshMs: CONTENT_REFRESH_MS
});

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || !ALLOWED_ORIGINS.length || ALLOWED_ORIGINS.includes(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error("CORS blocked for origin: " + origin));
    },
    credentials: true
}));
app.use(express.json({ limit: "200kb" }));
app.use(cookieParser());

app.get("/api/health", function (req, res) {
    res.json({
        ok: true,
        content: contentCache.getStatus()
    });
});

app.post("/api/chat/session", function (req, res) {
    const session = database.createSession({
        sourcePage: safeString(req.body.sourcePage),
        referrer: safeString(req.body.referrer),
        userAgent: safeString(req.body.userAgent || req.get("user-agent"))
    });

    res.status(201).json({
        sessionId: session.id
    });
});

app.post("/api/chat/message", function (req, res) {
    const sessionId = safeString(req.body.sessionId);
    const message = safeString(req.body.message);

    if (!sessionId || !message) {
        res.status(400).json({ error: "sessionId and message are required" });
        return;
    }

    const session = database.getSession(sessionId);
    if (!session) {
        res.status(404).json({ error: "Session not found" });
        return;
    }

    database.appendTranscript(sessionId, {
        role: "user",
        text: message,
        createdAt: new Date().toISOString()
    });

    const result = matchMessage(message, contentCache.getContent() || {});
    database.updateSessionMatchType(sessionId, result.matchType);
    database.appendTranscript(sessionId, {
        role: "bot",
        text: result.reply,
        matchType: result.matchType,
        createdAt: new Date().toISOString()
    });

    res.json({
        reply: result.reply,
        matchType: result.matchType,
        nextStep: result.nextStep,
        showLeadCta: result.showLeadCta !== false
    });
});

app.post("/api/chat/lead", async function (req, res) {
    const name = safeString(req.body.name);
    const contactType = safeString(req.body.contactType);
    const contactValue = safeString(req.body.contactValue);
    const question = safeString(req.body.question);
    const consent = Boolean(req.body.consent);

    if (!name || !contactType || !contactValue || !question || !consent) {
        res.status(400).json({ error: "name, contactType, contactValue, question, and consent are required" });
        return;
    }

    let sessionId = safeString(req.body.sessionId);
    if (!sessionId || !database.getSession(sessionId)) {
        sessionId = database.createSession({
            sourcePage: safeString(req.body.sourcePage),
            referrer: safeString(req.body.referrer),
            userAgent: safeString(req.get("user-agent"))
        }).id;
    }

    database.appendTranscript(sessionId, {
        role: "system",
        type: "lead_submission",
        text: "Lead submitted",
        payload: {
            name: name,
            contactType: contactType,
            contactValue: contactValue,
            question: question
        },
        createdAt: new Date().toISOString()
    });

    const session = database.getSession(sessionId);
    const lead = database.saveLead({
        sessionId: sessionId,
        visitorName: name,
        contactType: contactType,
        contactValue: contactValue,
        question: question,
        sourcePage: safeString(req.body.sourcePage),
        referrer: safeString(req.body.referrer),
        userAgent: safeString(req.get("user-agent")),
        matchType: session ? session.matchType : "handoff",
        status: "new"
    });

    try {
        await sendTelegramLead({
            botToken: process.env.TELEGRAM_BOT_TOKEN,
            chatId: process.env.TELEGRAM_CHAT_ID,
            lead: lead,
            adminAppUrl: ADMIN_APP_URL
        });
        database.markLeadTelegramNotified(lead.id);
    } catch (error) {
        console.error("[telegram]", error.message);
    }

    const content = contentCache.getContent() || {};
    const successMessage = content.chatBot && content.chatBot.successMessage
        ? content.chatBot.successMessage
        : "Спасибо! Заявка сохранена.";

    res.status(201).json({
        leadId: lead.id,
        message: successMessage
    });
});

app.post("/api/admin/auth/github", async function (req, res) {
    if (!GITHUB_ADMIN_ALLOWLIST.length) {
        res.status(500).json({ error: "GITHUB_ADMIN_ALLOWLIST is not configured" });
        return;
    }

    const token = safeString(req.body.token);
    if (!token) {
        res.status(400).json({ error: "token is required" });
        return;
    }

    try {
        const user = await fetchGithubUser(token);
        if (!GITHUB_ADMIN_ALLOWLIST.includes(String(user.login || "").toLowerCase())) {
            res.status(403).json({ error: "GitHub user is not allowed" });
            return;
        }

        res.cookie(ADMIN_COOKIE_NAME, signAdminSession(user.login), getCookieOptions());
        res.json({
            ok: true,
            username: user.login
        });
    } catch (error) {
        res.status(401).json({ error: error.message || "GitHub token is invalid" });
    }
});

app.post("/api/admin/logout", function (req, res) {
    res.clearCookie(ADMIN_COOKIE_NAME, getCookieOptions());
    res.json({ ok: true });
});

app.get("/api/admin/inbox", requireAdmin, function (req, res) {
    const status = safeString(req.query.status || "all");
    res.json(database.listLeads(status));
});

app.get("/api/admin/inbox/:id", requireAdmin, function (req, res) {
    const lead = database.getLead(req.params.id);
    if (!lead) {
        res.status(404).json({ error: "Lead not found" });
        return;
    }

    res.json({ item: lead });
});

app.patch("/api/admin/inbox/:id", requireAdmin, function (req, res) {
    const nextStatus = req.body.status !== undefined ? safeString(req.body.status) : undefined;
    const internalNote = req.body.internalNote !== undefined ? safeString(req.body.internalNote) : undefined;

    if (nextStatus && !LEAD_STATUSES.has(nextStatus)) {
        res.status(400).json({ error: "Unknown lead status" });
        return;
    }

    const updated = database.updateLead(req.params.id, {
        status: nextStatus,
        internalNote: internalNote
    });

    if (!updated) {
        res.status(404).json({ error: "Lead not found" });
        return;
    }

    res.json({ item: updated });
});

app.use(function (error, req, res, next) {
    if (error && error.message && error.message.indexOf("CORS blocked") === 0) {
        res.status(403).json({ error: error.message });
        return;
    }

    console.error("[server]", error);
    res.status(500).json({ error: "Internal server error" });
});

contentCache.start()
    .catch(function (error) {
        console.error("[content-cache]", error.message);
    })
    .finally(function () {
        app.listen(PORT, function () {
            console.log("[snaf-backend] listening on port " + PORT);
        });
    });

function requireAdmin(req, res, next) {
    const session = verifyAdminSession(req.cookies[ADMIN_COOKIE_NAME]);
    if (!session) {
        res.status(401).json({ error: "Admin session required" });
        return;
    }

    req.admin = session;
    next();
}

async function fetchGithubUser(token) {
    const response = await fetch("https://api.github.com/user", {
        headers: {
            Authorization: "token " + token,
            "User-Agent": "snafstudio-backend"
        }
    });

    if (!response.ok) {
        throw new Error("GitHub token is invalid");
    }

    return response.json();
}

function signAdminSession(username) {
    const payload = {
        username: username,
        exp: Date.now() + (ADMIN_SESSION_TTL_HOURS * 60 * 60 * 1000)
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = crypto.createHmac("sha256", SESSION_SECRET).update(encoded).digest("base64url");
    return encoded + "." + signature;
}

function verifyAdminSession(token) {
    if (!token || token.indexOf(".") === -1) {
        return null;
    }

    const parts = token.split(".");
    const encoded = parts[0];
    const signature = parts[1];
    const expectedSignature = crypto.createHmac("sha256", SESSION_SECRET).update(encoded).digest("base64url");
    if (!safeCompare(signature, expectedSignature)) {
        return null;
    }

    try {
        const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
        if (!payload.exp || payload.exp < Date.now()) {
            return null;
        }
        return payload;
    } catch (error) {
        return null;
    }
}

function getCookieOptions() {
    return {
        httpOnly: true,
        secure: COOKIE_SECURE,
        sameSite: COOKIE_SAME_SITE,
        maxAge: ADMIN_SESSION_TTL_HOURS * 60 * 60 * 1000,
        path: "/"
    };
}

function safeCompare(left, right) {
    try {
        return crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));
    } catch (error) {
        return false;
    }
}

function safeString(value) {
    return String(value || "").trim();
}
