import fs from "node:fs/promises";
import path from "node:path";
import CryptoJS from "crypto-js";

const root = process.cwd();
const key = process.env.PERSONALIZATION_SNAPSHOT_KEY;

if (!key) {
	throw new Error("Missing PERSONALIZATION_SNAPSHOT_KEY");
}

const argFile = process.argv.find((arg) => arg.startsWith("--file="));
const inputFile = argFile ? argFile.split("=").slice(1).join("=") : null;

async function findLatestSnapshot() {
	const entries = await fs.readdir(root);
	const matches = entries
		.filter((name) => name.startsWith("personalization-snapshot-"))
		.filter((name) => name.endsWith(".enc"))
		.sort();
	return matches.length > 0 ? matches[matches.length - 1] : null;
}

const snapshotFile = inputFile || (await findLatestSnapshot());
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

const payload = JSON.parse(decrypted);
const files = payload.files || [];

for (const item of files) {
	const targetPath = path.resolve(root, item.path);
	if (!targetPath.startsWith(root)) {
		throw new Error(`Invalid path: ${item.path}`);
	}
	await fs.mkdir(path.dirname(targetPath), { recursive: true });
	let content = Buffer.from(item.content, "base64");
	if (item.path === "src/config.ts") {
		const text = content.toString("utf8").replace(/fa6-/g, "fa7-");
		content = Buffer.from(text, "utf8");
	}
	await fs.writeFile(targetPath, content);
}

console.log(`Snapshot restored: ${snapshotFile}`);
