function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

async function sendTelegramLead(options) {
    if (!options.botToken || !options.chatId) {
        return false;
    }

    const lead = options.lead;
    const lines = [
        "<b>Новая заявка с сайта</b>",
        "",
        "<b>Имя:</b> " + escapeHtml(lead.visitorName || "Не указано"),
        "<b>Контакт:</b> " + escapeHtml((lead.contactType || "—") + " — " + (lead.contactValue || "—")),
        "<b>Вопрос:</b> " + escapeHtml(lead.firstQuestion || "Не указан"),
        "<b>Страница:</b> " + escapeHtml(lead.sourcePage || "/"),
        "<b>Время:</b> " + escapeHtml(lead.createdAt || new Date().toISOString())
    ];

    if (options.adminAppUrl) {
        lines.push("", "<a href=\"" + escapeHtml(options.adminAppUrl) + "\">Открыть админку</a>");
    }

    const response = await fetch("https://api.telegram.org/bot" + options.botToken + "/sendMessage", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            chat_id: options.chatId,
            text: lines.join("\n"),
            parse_mode: "HTML",
            disable_web_page_preview: true
        })
    });

    if (!response.ok) {
        throw new Error("Telegram API error: " + response.status);
    }

    return true;
}

module.exports = {
    sendTelegramLead
};
