const STOP_WORDS = new Set([
    "и", "в", "во", "на", "с", "со", "по", "к", "ко", "что", "как", "для", "или",
    "у", "из", "об", "от", "до", "не", "ли", "я", "мы", "вы", "мне", "могу", "нужно",
    "это", "этот", "эта", "есть", "про", "под", "над", "же", "а", "но"
]);

function matchMessage(message, content) {
    const normalized = normalize(message);
    const tokens = tokenize(message);

    if (hasAny(normalized, ["стоимость", "цена", "сколько стоит", "бюджет", "прайс"])) {
        return {
            matchType: "pricing",
            confidence: 0.95,
            reply: buildPricingReply(content),
            nextStep: "offer_lead",
            showLeadCta: true
        };
    }

    if (hasAny(normalized, ["срок", "сроки", "времени", "сколько по времени", "когда будет готово"])) {
        return {
            matchType: "faq",
            confidence: 0.92,
            reply: buildTimelineReply(content),
            nextStep: "offer_lead",
            showLeadCta: true
        };
    }

    if (hasAny(normalized, ["что вы делаете", "что делаете", "услуги", "чем можете помочь", "что умеете"])) {
        return {
            matchType: "faq",
            confidence: 0.9,
            reply: buildServicesReply(content),
            nextStep: "offer_lead",
            showLeadCta: true
        };
    }

    const faqMatch = findBestFaqMatch(tokens, content);
    if (faqMatch && faqMatch.score >= 2) {
        return {
            matchType: "faq",
            confidence: faqMatch.score,
            reply: faqMatch.answer,
            nextStep: "offer_lead",
            showLeadCta: true
        };
    }

    return {
        matchType: "fallback",
        confidence: 0,
        reply: (content.chatBot && content.chatBot.capturePrompt) ||
            "Похоже, лучше передать вопрос вручную. Оставьте заявку, и я вернусь с ответом.",
        nextStep: "capture_lead",
        showLeadCta: true
    };
}

function buildPricingReply(content) {
    const pricing = content.pricing || {};
    const plans = Array.isArray(pricing.plans) ? pricing.plans : [];
    const summary = plans.slice(0, 3).map(function (plan) {
        return plan.name + " — " + plan.price;
    }).join("\n");

    return [
        pricing.subtitle ? stripHtml(pricing.subtitle) : "Стоимость зависит от объёма и количества блоков.",
        summary,
        pricing.note || ""
    ].filter(Boolean).join("\n");
}

function buildTimelineReply(content) {
    const faq = Array.isArray(content.faq && content.faq.items) ? content.faq.items : [];
    const timeFaq = faq.find(function (item) {
        const question = normalize(item.question);
        return question.indexOf("сколько по времени") !== -1 || question.indexOf("занимает проект") !== -1;
    });

    if (timeFaq) {
        return timeFaq.answer;
    }

    const steps = Array.isArray(content.process && content.process.steps) ? content.process.steps : [];
    if (!steps.length) {
        return "Срок зависит от объёма проекта, контента и количества согласований. Точнее скажу после короткого брифа.";
    }

    return "Срок зависит от объёма проекта и количества согласований. Обычно работа проходит через этапы: " +
        steps.map(function (step) { return step.title; }).join(", ") +
        ". После короткого описания задачи можно оценить сроки точнее.";
}

function buildServicesReply(content) {
    const faq = Array.isArray(content.faq && content.faq.items) ? content.faq.items : [];
    const serviceFaq = faq.find(function (item) {
        return normalize(item.question).indexOf("чем вы можете помочь") !== -1;
    });

    if (serviceFaq) {
        return serviceFaq.answer;
    }

    const benefits = Array.isArray(content.benefits && content.benefits.items) ? content.benefits.items : [];
    const summary = benefits.slice(0, 3).map(function (item) { return item.title; }).join(", ");
    if (summary) {
        return "Я помогаю с лендингами, небольшими сайтами и доработкой существующих страниц. Основной фокус: " + summary + ".";
    }

    return stripHtml((content.hero && content.hero.subtitle) || "Помогаю с дизайном, структурой и адаптивной вёрсткой сайтов.");
}

function findBestFaqMatch(tokens, content) {
    const faq = Array.isArray(content.faq && content.faq.items) ? content.faq.items : [];
    let bestMatch = null;

    faq.forEach(function (item) {
        const haystack = tokenize((item.question || "") + " " + (item.answer || ""));
        let score = 0;
        tokens.forEach(function (token) {
            if (haystack.includes(token)) {
                score += 1;
            }
        });

        if (!bestMatch || score > bestMatch.score) {
            bestMatch = {
                score: score,
                answer: item.answer
            };
        }
    });

    return bestMatch;
}

function tokenize(text) {
    return normalize(text)
        .split(/\s+/)
        .filter(function (token) {
            return token && token.length > 2 && !STOP_WORDS.has(token);
        });
}

function normalize(text) {
    return String(text || "")
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function stripHtml(text) {
    return String(text || "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .trim();
}

function hasAny(text, patterns) {
    return patterns.some(function (pattern) {
        return text.indexOf(pattern) !== -1;
    });
}

module.exports = {
    matchMessage
};
