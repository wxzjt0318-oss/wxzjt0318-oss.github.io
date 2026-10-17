import { prefersReducedMotion } from "@utils/motion";
import { loadScriptOnce } from "@utils/script-loader";
import type { Cubism4InternalModel } from "pixi-live2d-display/cubism4";
import type { SeriaAction } from "./protected-assets";
import { loadProtectedSeria } from "./protected-assets";

interface Options {
	asset: string;
	width: number;
	height: number;
	onText: (text: string) => void;
}
export interface SeriaRuntime {
	intro: () => void;
	setVisible: (visible: boolean) => void;
	destroy: () => void;
}
export async function mountSeria(
	canvas: HTMLCanvasElement,
	options: Options,
	lifetime: AbortSignal,
): Promise<SeriaRuntime> {
	const timeout = AbortSignal.timeout(30_000); // Binary model transfer, larger than a normal API response.
	const signal = AbortSignal.any([lifetime, timeout]);
	const resources = await loadProtectedSeria(options.asset, signal);
	let dispose = () => resources.release();
	try {
		// Core stays on Live2D's official host; it is not redistributed in this repository.
		await loadScriptOnce(
			"https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js",
		);
		signal.throwIfAborted();
		const PIXI = await import("pixi.js");
		const {
			Live2DModel,
			Cubism4ModelSettings,
			MotionPreloadStrategy,
			MotionPriority,
		} = await import("pixi-live2d-display/cubism4");
		const { payload, urls } = resources;
		const settings = new Cubism4ModelSettings({
			...payload.model,
			url: new URL(options.asset, location.href).href,
		} as ConstructorParameters<typeof Cubism4ModelSettings>[0]);
		settings.replaceFiles((file) => {
			const url = urls.get(file);
			if (!url) throw new Error(`Missing protected model asset: ${file}`);
			return url;
		});
		// The renderer's legacy Node URL resolver corrupts nested `blob:https:` URLs.
		// All packaged resources already have absolute, authenticated Blob URLs.
		settings.resolveURL = (file) => urls.get(file) ?? file;
		const app = new PIXI.Application({
			view: canvas,
			width: options.width,
			height: options.height,
			backgroundAlpha: 0,
			antialias: true,
			autoDensity: true,
			resolution: Math.min(devicePixelRatio || 1, 2),
			autoStart: false,
		});
		let model: InstanceType<typeof Live2DModel> | undefined;
		let audio: HTMLAudioElement | undefined;
		let timer: ReturnType<typeof setTimeout> | undefined;
		let destroyed = false;
		let shown = true;
		const events = new AbortController();
		dispose = () => {
			if (destroyed) return;
			destroyed = true;
			events.abort();
			clearTimeout(timer);
			audio?.pause();
			if (audio) audio.src = "";
			app.destroy(false, { children: true, texture: true, baseTexture: true });
			resources.release();
		};
		lifetime.addEventListener("abort", dispose, { once: true });
		model = await Live2DModel.from(settings, {
			autoUpdate: false,
			autoInteract: false,
			motionPreload: MotionPreloadStrategy.ALL,
			idleMotionGroup: prefersReducedMotion() ? "__none" : "Idle",
		});
		if (lifetime.aborted) {
			model.destroy();
			throw new DOMException("Unmounted", "AbortError");
		}
		const live = model;
		const internal = live.internalModel as Cubism4InternalModel;
		const scale = Math.min(
			options.width / live.width,
			options.height / live.height,
		);
		live.scale.set(scale);
		live.x = (options.width - live.width) / 2;
		live.y = options.height - live.height;
		app.stage.addChild(live);
		const core = internal.coreModel;
		const blocked = ["L", "R"].flatMap((side) =>
			[
				"ParamArmHi",
				"ParamArmRaise",
				"ParamHandWave",
				"ParamHandPeace",
				"ParamCloakLift",
			].map((name) => name + side),
		);
		internal.on("beforeModelUpdate", () => {
			const reduced = prefersReducedMotion();
			const x = reduced ? 0 : internal.focusController.x;
			const y = reduced ? 0 : internal.focusController.y;
			for (const [id, value] of Object.entries({
				ParamEyeBallX: x,
				ParamEyeBallY: y,
				ParamAngleX: x * 25,
				ParamAngleY: y * 25,
				ParamAngleZ: x * 4,
				ParamBodyAngleX: x * 8,
				ParamBodyAngleY: y * 7,
				ParamBodyAngleZ: x * 1.5,
			}))
				core.setParameterValueById(id, value);
			for (const id of blocked) core.setParameterValueById(id, 0);
		});
		const render = () => {
			live.update(Math.min(app.ticker.deltaMS, 50));
		};
		app.ticker.maxFPS = 30;
		app.ticker.add(render, undefined, PIXI.UPDATE_PRIORITY.HIGH);
		app.start();
		const coordinates = (event: PointerEvent) => {
			const rect = canvas.getBoundingClientRect();
			return new PIXI.Point(
				((event.clientX - rect.left) * options.width) / rect.width,
				((event.clientY - rect.top) * options.height) / rect.height,
			);
		};
		const speak = (action: SeriaAction) => {
			clearTimeout(timer);
			options.onText(action.text);
			timer = setTimeout(() => options.onText(""), action.duration);
			audio?.pause();
			if (action.sound) {
				audio = new Audio(urls.get(action.sound));
				void audio.play().catch((error) => {
					if (error instanceof DOMException && error.name === "AbortError")
						return;
					console.warn("Seria audio playback failed", error);
				});
			}
		};
		const play = (group: string) => {
			const actions = payload.actions[group];
			if (!actions?.length) return;
			const index = Math.floor(Math.random() * actions.length);
			speak(actions[index]);
			void live.motion(group, index, MotionPriority.FORCE);
		};
		const intro = () => play("Voice");
		// Test actual triangles, not only each drawable's rectangle.
		const hitAt = (point: InstanceType<typeof PIXI.Point>) => {
			const local = live.toModelPosition(point);
			return [...payload.hits]
				.sort((a, b) => b.order - a.order)
				.find((hit) => {
					const index = core.getDrawableIndex(hit.id);
					if (index < 0 || core.getDrawableOpacity(index) < 0.1) return false;
					const vertices = internal.getDrawableVertices(index);
					const triangles = core.getDrawableVertexIndices(index);
					for (let j = 0; j < triangles.length; j += 3) {
						const a = triangles[j] * 2;
						const b = triangles[j + 1] * 2;
						const c = triangles[j + 2] * 2;
						const cross = (u: number, v: number) =>
							(vertices[v] - vertices[u]) * (local.y - vertices[u + 1]) -
							(vertices[v + 1] - vertices[u + 1]) * (local.x - vertices[u]);
						const signs = [cross(a, b), cross(b, c), cross(c, a)];
						if (signs.every((n) => n >= 0) || signs.every((n) => n <= 0))
							return true;
					}
					return false;
				});
		};
		document.addEventListener(
			"pointermove",
			(event) => {
				if (!prefersReducedMotion()) {
					const p = coordinates(event);
					live.focus(p.x, p.y);
				}
			},
			{ signal: events.signal, passive: true },
		);
		canvas.addEventListener(
			"pointerdown",
			(event) => {
				if (event.button !== 0) return;
				const point = coordinates(event);
				// Transparent texture margins must not count as a model click.
				app.render();
				const renderer = app.renderer as InstanceType<typeof PIXI.Renderer>;
				const pixel = new Uint8Array(4);
				const gl = renderer.gl;
				gl.readPixels(
					Math.floor(point.x * renderer.resolution),
					Math.floor((options.height - point.y) * renderer.resolution),
					1,
					1,
					gl.RGBA,
					gl.UNSIGNED_BYTE,
					pixel,
				);
				if (pixel[3] < 20) return;
				const hit = hitAt(point);
				if (hit) play(hit.group);
			},
			{ signal: events.signal },
		);
		document.addEventListener(
			"visibilitychange",
			() => {
				if (document.hidden || !shown) {
					app.stop();
					audio?.pause();
				} else app.start();
			},
			{ signal: events.signal },
		);
		canvas.dataset.seriaReady = "true";
		return {
			intro,
			setVisible: (visible: boolean) => {
				shown = visible;
				if (visible && !document.hidden) app.start();
				else {
					app.stop();
					audio?.pause();
					options.onText("");
				}
			},
			destroy: dispose,
		};
	} catch (error) {
		dispose();
		throw error;
	}
}
