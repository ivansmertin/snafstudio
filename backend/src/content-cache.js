function createContentCache(options) {
    const sourceUrl = options.sourceUrl;
    const refreshMs = Number(options.refreshMs || 300000);
    const state = {
        data: null,
        lastLoadedAt: null,
        lastError: null
    };

    async function refresh() {
        try {
            const response = await fetch(sourceUrl, {
                headers: {
                    "Cache-Control": "no-cache"
                }
            });

            if (!response.ok) {
                throw new Error("Failed to fetch content: " + response.status);
            }

            state.data = await response.json();
            state.lastLoadedAt = new Date().toISOString();
            state.lastError = null;
            return state.data;
        } catch (error) {
            state.lastError = error.message;
            if (state.data) {
                return state.data;
            }
            throw error;
        }
    }

    async function start() {
        await refresh();
        if (refreshMs > 0) {
            const timer = setInterval(function () {
                refresh().catch(function () {
                    return null;
                });
            }, refreshMs);
            if (typeof timer.unref === "function") {
                timer.unref();
            }
        }
    }

    return {
        start,
        refresh,
        getContent: function () { return state.data; },
        getStatus: function () {
            return {
                sourceUrl: sourceUrl,
                refreshMs: refreshMs,
                lastLoadedAt: state.lastLoadedAt,
                lastError: state.lastError
            };
        }
    };
}

module.exports = {
    createContentCache
};
