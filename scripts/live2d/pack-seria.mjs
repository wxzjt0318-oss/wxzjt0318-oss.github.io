import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

// Private source directory and key are deliberately outside the public repository.
const [sourceDirectory, keyFile] = process.argv.slice(2);
if (!sourceDirectory || !keyFile)
	throw new Error(
		"Usage: node scripts/live2d/pack-seria.mjs <runtime-directory> <private-key-file>",
	);
const root = path.resolve(sourceDirectory);
const config = JSON.parse(
	await readFile(path.join(root, "Seria_Voice.model3.json"), "utf8"),
);
const refs = config.FileReferences;
const readAsset = async (name) => {
	const resolved = path.resolve(root, name);
	if (!resolved.startsWith(root + path.sep))
		throw new Error("Asset outside model directory");
	return readFile(resolved);
};
const forbidden = /peace|smile_wave|_hand_|_greeting\./i;
const files = new Set([refs.Moc, refs.Physics, ...refs.Textures]);
const actions = {};
const motions = {};
for (const [group, entries] of Object.entries(refs.Motions)) {
	if (
		["Start", "Special", "Reset", "Peace", "Hands", "Greeting"].includes(group)
	)
		continue;
	actions[group] = [];
	motions[group] = [];
	for (const entry of entries) {
		if (forbidden.test(entry.File))
			throw new Error("Forbidden hand gesture in web package");
		const motion = JSON.parse(await readAsset(entry.File));
		for (const curve of motion.Curves) {
			if (
				/^Param(ArmHi|ArmRaise|HandWave|HandPeace|CloakLift)/.test(curve.Id) &&
				!(
					curve.Segments.length === 5 &&
					curve.Segments[1] === 0 &&
					curve.Segments[2] === 0 &&
					curve.Segments[4] === 0
				)
			)
				throw new Error("Active hand gesture");
		}
		files.add(entry.File);
		if (entry.Sound) files.add(entry.Sound);
		motions[group].push({
			File: entry.File,
			FadeInTime: (entry.FadeIn ?? 200) / 1000,
			FadeOutTime: (entry.FadeOut ?? 200) / 1000,
		});
		actions[group].push({
			text: entry.Text ?? "",
			duration: entry.TextDuration ?? 3600,
			sound: entry.Sound,
		});
	}
}
for (const expression of refs.Expressions) files.add(expression.File);
const model = {
	Version: 3,
	FileReferences: {
		Moc: refs.Moc,
		Textures: refs.Textures,
		Physics: refs.Physics,
		Motions: motions,
		Expressions: refs.Expressions.map(({ Name, File }) => ({ Name, File })),
	},
	Groups: [
		{
			Target: "Parameter",
			Name: "EyeBlink",
			Ids: ["ParamEyeLOpen", "ParamEyeROpen"],
		},
	],
	HitAreas: config.HitAreas.filter((h) => !h.Id.startsWith("HandHi")).map(
		({ Id, Name }) => ({ Id, Name }),
	),
};
const assets = {};
for (const name of files)
	assets[name] = (await readAsset(name)).toString("base64");
const payload = {
	format: "seria-web-1",
	owner: "wxzjt0318-oss",
	source: "https://lm520.cc/",
	model,
	actions,
	hits: config.HitAreas.filter((h) =>
		model.HitAreas.some((a) => a.Id === h.Id),
	).map(({ Id, Name, Order, Motion }) => ({
		id: Id,
		name: Name,
		order: Order,
		group: Motion,
	})),
	assets,
};
let key;
try {
	key = Buffer.from((await readFile(keyFile, "utf8")).trim(), "base64");
} catch (error) {
	if (error.code !== "ENOENT") throw error;
	key = randomBytes(32);
	await mkdir(path.dirname(keyFile), { recursive: true });
	await writeFile(keyFile, key.toString("base64"), { mode: 0o600 });
}
if (key.length !== 32) throw new Error("Expected a 256-bit key");
const iv = randomBytes(12);
const cipher = createCipheriv("aes-256-gcm", key, iv);
const compressed = gzipSync(JSON.stringify(payload), { level: 9 });
const encrypted = Buffer.concat([
	cipher.update(compressed),
	cipher.final(),
	cipher.getAuthTag(),
]);
const output = Buffer.concat([Buffer.from("SRIA1"), iv, encrypted]);
const digest = createHash("sha256").update(output).digest("hex").slice(0, 16);
const directory = new URL("../../public/pio/seria/", import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL(`seria-${digest}.bin`, directory), output);
await writeFile(
	new URL("asset.json", directory),
	JSON.stringify(
		{ file: `seria-${digest}.bin`, bytes: output.length, owner: payload.owner },
		null,
		2,
	),
);
console.log(
	`Encrypted ${files.size} runtime assets: ${output.length} bytes; no source project included.`,
);
