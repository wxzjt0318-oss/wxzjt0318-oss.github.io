import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, "../src/config.ts");
const BANGUMI_DATA_PATH = path.join(__dirname, "../src/data/bangumi-data.json");

async function getAnimeModeFromConfig() {
	try {
		const configContent = await fs.readFile(CONFIG_PATH, "utf-8");
		const match = configContent.match(
			/anime:\s*\{[\s\S]*?mode:\s*["']([^"']+)["']/,
		);

		if (match && match[1]) {
			return match[1];
		}
		return "bangumi";
	} catch (error) {
		return "bangumi";
	}
}

async function hasExistingBangumiData() {
	try {
		const raw = await fs.readFile(BANGUMI_DATA_PATH, "utf-8");
		const data = JSON.parse(raw);
		return Array.isArray(data) && data.length > 0;
	} catch {
		return false;
	}
}

function runScript(scriptPath) {
	return new Promise((resolve, reject) => {
		const script = spawn("node", [scriptPath], {
			stdio: "inherit",
			shell: true,
		});

		script.on("close", (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`Script exited with code ${code}`));
			}
		});

		script.on("error", (err) => {
			reject(err);
		});
	});
}

async function main() {
	const mode = await getAnimeModeFromConfig();
	const scriptsDir = __dirname;

	if (mode === "bilibili") {
		console.log("Detected anime mode: bilibili, running update-bilibili.mjs");
		await runScript(path.join(scriptsDir, "update-bilibili.mjs"));
	} else if (mode === "bangumi") {
		const hasExistingData = await hasExistingBangumiData();
		if (process.env.CI && hasExistingData) {
			console.log("Detected anime mode: bangumi, using checked-in bangumi-data.json in CI");
			return;
		}

		if (hasExistingData) {
			console.log("Detected anime mode: bangumi, using existing bangumi-data.json");
			return;
		}

		console.log("Detected anime mode: bangumi, but update-bangumi.mjs has been removed. Skipping.");
	} else {
		console.log(`Anime mode is "${mode}", skipping data update.`);
	}
}

main().catch((err) => {
	console.error("\n✘ Script execution error:");
	console.error(err);
	process.exit(1);
});

