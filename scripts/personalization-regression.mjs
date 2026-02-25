import fs from "node:fs/promises";
import path from "node:path";
import CryptoJS from "crypto-js";
import { parse } from "node-html-parser";

const root = process.cwd();
const key = process.env.PERSONALIZATION_SNAPSHOT_KEY;

if (!key) {
	throw new Error("Missing PERSONALIZATION_SNAPSHOT_KEY");
}

async function findLatestSnapshot() {
	const entries = await fs.readdir(root);
	const matches = entries
		.filter((name) => name.startsWith("personalization-snapshot-"))
		.filter((name) => name.endsWith(".enc"))
		.sort();
	return matches.length > 0 ? matches[matches.length - 1] : null;
}

const snapshotFile = await findLatestSnapshot();
if (!snapshotFile) {
	throw new Error("Snapshot file not found");
}

const encrypted = await fs.readFile(path.join(root, snapshotFile), "utf8");
const decrypted = CryptoJS.AES.decrypt(encrypted, key).toString(
	CryptoJS.enc.Utf8,
);
if (!decrypted) {
	throw new Error("Failed to decrypt snapshot");
}

const snapshot = JSON.parse(decrypted);
const assertions = snapshot.assertions || {};

const indexPath = path.join(root, "dist", "index.html");
const html = await fs.readFile(indexPath, "utf8");
const rootNode = parse(html);

const errors = [];
const title = rootNode.querySelector("title")?.text?.trim() || "";
const metaDesc =
	rootNode.querySelector('meta[name="description"]')?.getAttribute("content") ||
	"";
const ogSite =
	rootNode
		.querySelector('meta[property="og:site_name"]')
		?.getAttribute("content") || "";
const avatarSrc =
	rootNode
		.querySelector('img[alt*="Profile"]')
		?.getAttribute("src") || "";
const jsonLd =
	rootNode
		.querySelector('script[type="application/ld+json"]')
		?.text || "";

if (assertions.siteTitle && !title.includes(assertions.siteTitle)) {
	errors.push(`title mismatch: ${assertions.siteTitle}`);
}
if (assertions.siteSubtitle && !metaDesc.includes(assertions.siteSubtitle)) {
	errors.push(`description mismatch: ${assertions.siteSubtitle}`);
}
if (assertions.siteTitle && ogSite && !ogSite.includes(assertions.siteTitle)) {
	errors.push(`og:site_name mismatch: ${assertions.siteTitle}`);
}
if (assertions.profileName && !html.includes(assertions.profileName)) {
	errors.push(`profile name mismatch: ${assertions.profileName}`);
}
if (assertions.announcementContent && !html.includes(assertions.announcementContent)) {
	errors.push(`announcement mismatch: ${assertions.announcementContent}`);
}
if (assertions.profileAvatar) {
	const avatarBase = path.basename(assertions.profileAvatar).replace(/\.[a-z0-9]+$/i, "");
	if (avatarBase && !avatarSrc.includes(avatarBase) && !html.includes(avatarBase)) {
		errors.push(`avatar mismatch: ${assertions.profileAvatar}`);
	}
}
if (assertions.siteURL && jsonLd && !jsonLd.includes(assertions.siteURL)) {
	errors.push(`json-ld url mismatch: ${assertions.siteURL}`);
}

if (errors.length > 0) {
	console.error(`Personalization regression failed: ${errors.join(" | ")}`);
	process.exit(1);
}

console.log("Personalization regression passed");
