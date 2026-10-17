export interface SeriaAction {
	text: string;
	duration: number;
	sound?: string;
}
export interface SeriaHit {
	id: string;
	name: string;
	order: number;
	group: string;
}
export interface SeriaPayload {
	format: string;
	owner: string;
	model: Record<string, unknown>;
	actions: Record<string, SeriaAction[]>;
	hits: SeriaHit[];
	assets: Record<string, string>;
}
const hosts = new Set([
	"lm520.cc",
	"www.lm520.cc",
	"wxzjt0318-oss.github.io",
	"localhost",
	"127.0.0.1",
	"[::1]",
]);
export function isSeriaHost(hostname: string): boolean {
	return hosts.has(hostname.toLowerCase());
}
function decode(value: string): Uint8Array<ArrayBuffer> {
	return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}
export interface SeriaResources {
	payload: SeriaPayload;
	urls: Map<string, string>;
	release: () => void;
}
export async function loadProtectedSeria(
	url: string,
	signal: AbortSignal,
): Promise<SeriaResources> {
	if (!isSeriaHost(location.hostname))
		throw new Error("Seria host is not permitted");
	// This is a deployment secret, not a browser-side secret: the deployed JS can be inspected.
	const encodedKey = import.meta.env.PUBLIC_SERIA_ASSET_KEY;
	if (!encodedKey) throw new Error("Seria asset key is missing in this build");
	const response = await fetch(url, { signal, credentials: "same-origin" });
	if (!response.ok) throw new Error(`Seria asset HTTP ${response.status}`);
	const data = new Uint8Array(await response.arrayBuffer());
	if (
		data.length > 64 * 1024 * 1024 ||
		new TextDecoder().decode(data.subarray(0, 5)) !== "SRIA1"
	)
		throw new Error("Invalid Seria asset envelope");
	const key = await crypto.subtle.importKey(
		"raw",
		decode(encodedKey),
		"AES-GCM",
		false,
		["decrypt"],
	);
	const compressed = await crypto.subtle.decrypt(
		{ name: "AES-GCM", iv: data.subarray(5, 17) },
		key,
		data.subarray(17),
	);
	const stream = new Blob([compressed])
		.stream()
		.pipeThrough(new DecompressionStream("gzip"));
	const payload = (await new Response(stream).json()) as SeriaPayload;
	if (
		payload.format !== "seria-web-1" ||
		payload.owner !== "wxzjt0318-oss" ||
		!payload.model ||
		!payload.assets ||
		!Array.isArray(payload.hits)
	)
		throw new Error("Invalid Seria model payload");
	signal.throwIfAborted();
	const urls = new Map<string, string>();
	try {
		for (const [name, contents] of Object.entries(payload.assets)) {
			const type = name.endsWith(".png")
				? "image/png"
				: name.endsWith(".ogg")
					? "audio/ogg"
					: name.endsWith(".json")
						? "application/json"
						: "application/octet-stream";
			urls.set(
				name,
				URL.createObjectURL(new Blob([decode(contents)], { type })),
			);
		}
		return {
			payload,
			urls,
			release: () => {
				for (const url of urls.values()) URL.revokeObjectURL(url);
			},
		};
	} catch (error) {
		for (const url of urls.values()) URL.revokeObjectURL(url);
		throw error;
	}
}
