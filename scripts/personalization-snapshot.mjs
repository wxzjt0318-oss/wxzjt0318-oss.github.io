import fs from "node:fs/promises";
import path from "node:path";
import CryptoJS from "crypto-js";

const root = process.cwd();
const key = process.env.PERSONALIZATION_SNAPSHOT_KEY;

if (!key) {
	throw new Error("Missing PERSONALIZATION_SNAPSHOT_KEY");
}

const date = new Date().toISOString().slice(0, 10);
const outputFile = path.join(
	root,
	`personalization-snapshot-${date}.enc`,
);

const targets = [
	"src/config.ts",
	"src/FooterConfig.html",
	"src/data",
	"src/content/spec",
	"src/assets/images",
	"public/assets/home",
	"public/favicon",
	"public/js/umami-share.js",
];

async function listFiles(entry) {
	const full = path.join(root, entry);
	try {
		const stat = await fs.stat(full);
		if (stat.isFile()) {
			return [entry];
		}
		if (stat.isDirectory()) {
			const items = await fs.readdir(full);
			const nested = await Promise.all(
				items.map((name) => listFiles(path.join(entry, name))),
			);
			return nested.flat();
		}
		return [];
	} catch {
		return [];
	}
}

const fileList = (
	await Promise.all(targets.map((entry) => listFiles(entry)))
).flat();

const files = [];
for (const filePath of fileList) {
	const absolutePath = path.join(root, filePath);
	const content = await fs.readFile(absolutePath);
	files.push({
		path: filePath.replace(/\\/g, "/"),
		encoding: "base64",
		content: content.toString("base64"),
	});
}

function extractBlock(source, marker) {
	const startIndex = source.indexOf(marker);
	if (startIndex === -1) return "";
	const braceIndex = source.indexOf("{", startIndex);
	if (braceIndex === -1) return "";
	let depth = 0;
	for (let i = braceIndex; i < source.length; i += 1) {
		const char = source[i];
		if (char === "{") depth += 1;
		if (char === "}") depth -= 1;
		if (depth === 0) {
			return source.slice(braceIndex, i + 1);
		}
	}
	return "";
}

function extractValue(block, keyName) {
	const regex = new RegExp(`${keyName}\\s*:\\s*["']([^"']*)["']`);
	const match = block.match(regex);
	return match ? match[1] : "";
}

function extractNumber(block, keyName) {
	const regex = new RegExp(`${keyName}\\s*:\\s*(\\d+)`);
	const match = block.match(regex);
	return match ? Number(match[1]) : null;
}

const configPath = path.join(root, "src", "config.ts");
const configText = await fs.readFile(configPath, "utf8");
const siteBlock = extractBlock(configText, "export const siteConfig");
const profileBlock = extractBlock(configText, "export const profileConfig");
const announcementBlock = extractBlock(
	configText,
	"export const announcementConfig",
);
const commentBlock = extractBlock(configText, "export const commentConfig");

const assertions = {
	siteTitle: extractValue(siteBlock, "title"),
	siteSubtitle: extractValue(siteBlock, "subtitle"),
	siteURL: extractValue(siteBlock, "siteURL"),
	themeHue: extractNumber(siteBlock, "hue"),
	profileName: extractValue(profileBlock, "name"),
	profileBio: extractValue(profileBlock, "bio"),
	profileAvatar: extractValue(profileBlock, "avatar"),
	announcementContent: extractValue(announcementBlock, "content"),
	twikooEnvId: extractValue(commentBlock, "envId"),
};

const snapshot = {
	version: 1,
	createdAt: new Date().toISOString(),
	files,
	assertions,
};

const encrypted = CryptoJS.AES.encrypt(
	JSON.stringify(snapshot),
	key,
).toString();

await fs.writeFile(outputFile, encrypted, "utf8");
console.log(`Snapshot written: ${outputFile}`);
