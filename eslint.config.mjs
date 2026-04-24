const browserGlobals = {
    AbortController: "readonly",
    CustomEvent: "readonly",
    FormData: "readonly",
    HTMLElement: "readonly",
    IntersectionObserver: "readonly",
    URL: "readonly",
    cancelAnimationFrame: "readonly",
    document: "readonly",
    fetch: "readonly",
    history: "readonly",
    localStorage: "readonly",
    navigator: "readonly",
    performance: "readonly",
    requestAnimationFrame: "readonly",
    setTimeout: "readonly",
    clearTimeout: "readonly",
    window: "readonly",
    console: "readonly"
};

export default [
    {
        ignores: ["dist/**", "node_modules/**", "backend/**", "legacy/**"]
    },
    {
        files: ["js/**/*.js"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: browserGlobals
        },
        rules: {
            eqeqeq: ["error", "always"],
            "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
            "prefer-const": "warn"
        }
    },
    {
        files: ["scripts/**/*.mjs", "*.mjs"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                console: "readonly"
            }
        },
        rules: {
            eqeqeq: ["error", "always"],
            "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
            "prefer-const": "warn"
        }
    }
];
