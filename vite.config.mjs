import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const rootDir = dirname(fileURLToPath(import.meta.url));

function copyStaticEntries(entries) {
    return {
        name: "copy-static-entries",
        writeBundle(outputOptions) {
            const outputDir = resolve(rootDir, outputOptions.dir || "dist");

            entries.forEach((entry) => {
                const source = resolve(rootDir, entry.from);
                if (!existsSync(source)) {
                    return;
                }

                const destination = resolve(outputDir, entry.to || entry.from);
                mkdirSync(dirname(destination), { recursive: true });
                cpSync(source, destination, {
                    force: true,
                    recursive: true
                });
            });
        }
    };
}

export default defineConfig({
    server: {
        host: true
    },
    preview: {
        host: true
    },
    build: {
        assetsInlineLimit: 0,
        rollupOptions: {
            input: {
                index: resolve(rootDir, "index.html"),
                offer: resolve(rootDir, "offer.html"),
                privacy: resolve(rootDir, "privacy.html"),
                notFound: resolve(rootDir, "404.html"),
                admin: resolve(rootDir, "admin.html")
            }
        }
    },
    plugins: [
        copyStaticEntries([
            { from: "robots.txt" },
            { from: "sitemap.xml" },
            { from: "CNAME" },
            { from: "data" }
        ])
    ]
});
