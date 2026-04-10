import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, "..", ".cache", "bangumi");

async function convertCollectionsToAnimeJson() {
    const entries = await fs.readdir(CACHE_DIR, { withFileTypes: true });
    const collectionFiles = entries
        .filter(e => e.isFile() && e.name.startsWith("collection-"))
        .map(e => e.name);

    const allItems = [];

    for (const file of collectionFiles) {
        const filePath = path.join(CACHE_DIR, file);
        const raw = await fs.readFile(filePath, "utf8");

        let data;
        try {
            data = JSON.parse(raw);
        } catch (e) {
            console.warn(`Skipping ${file} - invalid JSON`);
            continue;
        }

        let items = [];
        if (Array.isArray(data)) {
            items = data;
        } else if (data?.data?.data && Array.isArray(data.data.data)) {
            items = data.data.data;
        } else if (data?.data && Array.isArray(data.data)) {
            items = data.data;
        }

        for (const item of items) {
            if (item.subject) {
                const subjectType = item.subject_type || item.subject?.type;
                const type = item.type;
                const isAnime = subjectType === 2 || type === 2 || type === 3;

                if (isAnime) {
                    allItems.push({
                        link: `/subject/${item.subject.id}`,
                        title: item.subject.name_cn || item.subject.name || "",
                        status: type === 3 ? "watching" : type === 2 ? "completed" : type === 1 ? "planned" : type === 4 ? "on_hold" : type === 5 ? "dropped" : "planned",
                        progress: item.ep_status || 0,
                        startDate: item.subject.date || "",
                        endDate: "",
                        year: item.subject.date ? item.subject.date.split("-")[0] : "",
                        totalEpisodes: item.subject.eps || 0,
                        description: item.subject.short_summary || "",
                        cover: item.subject.images?.large || item.subject.images?.common || "",
                        genre: item.subject.tags?.slice(0, 5).map(t => t.name) || []
                    });
                }
            }
        }
    }

    console.log(`Found ${allItems.length} anime items`);
    const outputPath = path.join(CACHE_DIR, "anime.json");
    await fs.writeFile(outputPath, JSON.stringify(allItems, null, 2), "utf8");
    console.log(`✅ Created anime.json at ${outputPath}`);
}

convertCollectionsToAnimeJson().catch(console.error);
