const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

function createDatabase(filePath) {
    const resolvedPath = path.resolve(filePath);
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

    const db = new Database(resolvedPath);
    db.pragma("journal_mode = WAL");

    db.exec(`
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            source_page TEXT,
            referrer TEXT,
            user_agent TEXT,
            transcript TEXT NOT NULL,
            first_question TEXT,
            match_type TEXT DEFAULT 'fallback'
        );

        CREATE TABLE IF NOT EXISTS leads (
            id TEXT PRIMARY KEY,
            session_id TEXT UNIQUE,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            status TEXT NOT NULL,
            source_page TEXT,
            referrer TEXT,
            user_agent TEXT,
            visitor_name TEXT,
            contact_type TEXT,
            contact_value TEXT,
            first_question TEXT,
            transcript TEXT NOT NULL,
            match_type TEXT,
            internal_note TEXT DEFAULT '',
            telegram_notified_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
        CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
    `);

    function createSession(meta) {
        const now = new Date().toISOString();
        const session = {
            id: crypto.randomUUID(),
            created_at: now,
            updated_at: now,
            source_page: meta.sourcePage || "",
            referrer: meta.referrer || "",
            user_agent: meta.userAgent || "",
            transcript: "[]",
            first_question: null,
            match_type: "fallback"
        };

        db.prepare(`
            INSERT INTO chat_sessions (
                id, created_at, updated_at, source_page, referrer, user_agent, transcript, first_question, match_type
            )
            VALUES (
                @id, @created_at, @updated_at, @source_page, @referrer, @user_agent, @transcript, @first_question, @match_type
            )
        `).run(session);

        return mapSession(session);
    }

    function getSessionRow(sessionId) {
        return db.prepare("SELECT * FROM chat_sessions WHERE id = ?").get(sessionId) || null;
    }

    function getSession(sessionId) {
        const row = getSessionRow(sessionId);
        return row ? mapSession(row) : null;
    }

    function appendTranscript(sessionId, entry) {
        const row = getSessionRow(sessionId);
        if (!row) return null;

        const transcript = parseTranscript(row.transcript);
        transcript.push(entry);

        const firstQuestion = row.first_question || (
            entry.role === "user" && entry.text ? entry.text : null
        );

        db.prepare(`
            UPDATE chat_sessions
            SET transcript = ?, updated_at = ?, first_question = COALESCE(?, first_question)
            WHERE id = ?
        `).run(JSON.stringify(transcript), new Date().toISOString(), firstQuestion, sessionId);

        return getSession(sessionId);
    }

    function updateSessionMatchType(sessionId, matchType) {
        db.prepare(`
            UPDATE chat_sessions
            SET match_type = ?, updated_at = ?
            WHERE id = ?
        `).run(matchType, new Date().toISOString(), sessionId);
    }

    function saveLead(data) {
        const now = new Date().toISOString();
        const sessionRow = data.sessionId ? getSessionRow(data.sessionId) : null;
        const transcript = sessionRow ? parseTranscript(sessionRow.transcript) : [];
        const existingLead = data.sessionId
            ? db.prepare("SELECT id, created_at FROM leads WHERE session_id = ?").get(data.sessionId)
            : null;

        const lead = {
            id: existingLead ? existingLead.id : crypto.randomUUID(),
            session_id: data.sessionId || null,
            created_at: existingLead ? existingLead.created_at : now,
            updated_at: now,
            status: data.status || "new",
            source_page: data.sourcePage || (sessionRow ? sessionRow.source_page : ""),
            referrer: data.referrer || (sessionRow ? sessionRow.referrer : ""),
            user_agent: data.userAgent || (sessionRow ? sessionRow.user_agent : ""),
            visitor_name: data.visitorName || "",
            contact_type: data.contactType || "",
            contact_value: data.contactValue || "",
            first_question: (sessionRow && sessionRow.first_question) || data.question || "",
            transcript: JSON.stringify(transcript),
            match_type: data.matchType || (sessionRow ? sessionRow.match_type : "handoff"),
            internal_note: data.internalNote || "",
            telegram_notified_at: data.telegramNotifiedAt || null
        };

        db.prepare(`
            INSERT INTO leads (
                id, session_id, created_at, updated_at, status, source_page, referrer, user_agent,
                visitor_name, contact_type, contact_value, first_question, transcript, match_type,
                internal_note, telegram_notified_at
            )
            VALUES (
                @id, @session_id, @created_at, @updated_at, @status, @source_page, @referrer, @user_agent,
                @visitor_name, @contact_type, @contact_value, @first_question, @transcript, @match_type,
                @internal_note, @telegram_notified_at
            )
            ON CONFLICT(id) DO UPDATE SET
                session_id = excluded.session_id,
                updated_at = excluded.updated_at,
                status = excluded.status,
                source_page = excluded.source_page,
                referrer = excluded.referrer,
                user_agent = excluded.user_agent,
                visitor_name = excluded.visitor_name,
                contact_type = excluded.contact_type,
                contact_value = excluded.contact_value,
                first_question = excluded.first_question,
                transcript = excluded.transcript,
                match_type = excluded.match_type,
                internal_note = excluded.internal_note,
                telegram_notified_at = excluded.telegram_notified_at
        `).run(lead);

        return getLead(lead.id);
    }

    function markLeadTelegramNotified(leadId) {
        db.prepare(`
            UPDATE leads
            SET telegram_notified_at = ?, updated_at = ?
            WHERE id = ?
        `).run(new Date().toISOString(), new Date().toISOString(), leadId);
        return getLead(leadId);
    }

    function listLeads(status) {
        const rows = status && status !== "all"
            ? db.prepare("SELECT * FROM leads WHERE status = ? ORDER BY datetime(created_at) DESC").all(status)
            : db.prepare("SELECT * FROM leads ORDER BY datetime(created_at) DESC").all();

        const counts = {
            all: db.prepare("SELECT COUNT(*) AS total FROM leads").get().total
        };

        db.prepare(`
            SELECT status, COUNT(*) AS total
            FROM leads
            GROUP BY status
        `).all().forEach(function (row) {
            counts[row.status] = row.total;
        });

        return {
            items: rows.map(mapLead),
            counts: counts
        };
    }

    function getLead(leadId) {
        const row = db.prepare("SELECT * FROM leads WHERE id = ?").get(leadId);
        return row ? mapLead(row) : null;
    }

    function updateLead(leadId, patch) {
        const current = db.prepare("SELECT * FROM leads WHERE id = ?").get(leadId);
        if (!current) return null;

        db.prepare(`
            UPDATE leads
            SET status = ?, internal_note = ?, updated_at = ?
            WHERE id = ?
        `).run(
            patch.status || current.status,
            patch.internalNote !== undefined ? patch.internalNote : current.internal_note,
            new Date().toISOString(),
            leadId
        );

        return getLead(leadId);
    }

    return {
        createSession,
        getSession,
        appendTranscript,
        updateSessionMatchType,
        saveLead,
        getLead,
        listLeads,
        updateLead,
        markLeadTelegramNotified
    };
}

function parseTranscript(value) {
    try {
        return JSON.parse(value || "[]");
    } catch (error) {
        return [];
    }
}

function mapSession(row) {
    return {
        id: row.id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        sourcePage: row.source_page,
        referrer: row.referrer,
        userAgent: row.user_agent,
        transcript: parseTranscript(row.transcript),
        firstQuestion: row.first_question,
        matchType: row.match_type
    };
}

function mapLead(row) {
    return {
        id: row.id,
        sessionId: row.session_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        status: row.status,
        sourcePage: row.source_page,
        referrer: row.referrer,
        userAgent: row.user_agent,
        visitorName: row.visitor_name,
        contactType: row.contact_type,
        contactValue: row.contact_value,
        firstQuestion: row.first_question,
        transcript: parseTranscript(row.transcript),
        matchType: row.match_type,
        internalNote: row.internal_note || "",
        telegramNotifiedAt: row.telegram_notified_at
    };
}

module.exports = {
    createDatabase
};
