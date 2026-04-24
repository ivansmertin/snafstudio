import { existsSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import sharp from "sharp";

const jobs = [
    {
        source: "images/ivan.png",
        formats: [
            { extension: ".webp", method: "webp", options: { quality: 82 } },
            { extension: ".avif", method: "avif", options: { quality: 58 } }
        ]
    }
];

for (const job of jobs) {
    if (!existsSync(job.source)) {
        console.warn(`Skipped missing image: ${job.source}`);
        continue;
    }

    const directory = dirname(job.source);
    const basename = job.source.slice(0, -extname(job.source).length).split(/[\\/]/).pop();

    for (const format of job.formats) {
        const target = join(directory, `${basename}${format.extension}`);
        await sharp(job.source)
            .rotate()
            [format.method](format.options)
            .toFile(target);

        console.log(`Generated ${target}`);
    }
}
