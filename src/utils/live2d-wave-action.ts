/**
 * Live2D招手动作管理器
 * 提供自然流畅的招手动画序列，支持多种触发方式和平滑过渡
 */

export interface WaveActionConfig {
	enable: boolean;
	trigger: "click" | "hover" | "timer" | "all";
	duration: number;
	intensity: number;
	repeatCount: number;
	autoTriggerInterval: number;
	transitionDuration: number;
}

export interface WaveMotion {
	name: string;
	file?: string;
	parameters?: {
		id: string;
		value: number;
		time: number;
		easing: string;
	}[];
}

const defaultWaveConfig: WaveActionConfig = {
	enable: true,
	trigger: "all",
	duration: 2000,
	intensity: 1.0,
	repeatCount: 3,
	autoTriggerInterval: 60000,
	transitionDuration: 300,
};

export class Live2DWaveAction {
	private config: WaveActionConfig;
	private isActive: boolean = false;
	private animationFrame: number | null = null;
	private autoTriggerTimer: ReturnType<typeof setInterval> | null = null;
	private model: any = null;
	private lastActionTime: number = 0;
	private cooldownTime: number = 5000;

	constructor(config: Partial<WaveActionConfig> = {}) {
		this.config = { ...defaultWaveConfig, ...config };
	}

	setModel(model: any): void {
		this.model = model;
	}

	updateConfig(config: Partial<WaveActionConfig>): void {
		this.config = { ...this.config, ...config };
	}

	canTrigger(): boolean {
		const now = Date.now();
		return !this.isActive && now - this.lastActionTime > this.cooldownTime;
	}

	async startWave(): Promise<void> {
		if (!this.model || this.isActive || !this.canTrigger()) {
			return;
		}

		this.isActive = true;
		this.lastActionTime = Date.now();

		try {
			await this.executeWaveSequence();
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error("Wave action failed:", error);
		} finally {
			this.isActive = false;
		}
	}

	private async executeWaveSequence(): Promise<void> {
		const { duration, intensity, repeatCount, transitionDuration } = this.config;

		await this.fadeIn(transitionDuration);

		for (let i = 0; i < repeatCount; i++) {
			await this.executeWaveMotion(duration / repeatCount, intensity);
		}

		await this.fadeOut(transitionDuration);
	}

	private async fadeIn(duration: number): Promise<void> {
		return new Promise((resolve) => {
			if (!this.model) {
				resolve();
				return;
			}

			const startOpacity = this.model.getOpacity?.() ?? 1;
			const targetOpacity = 1;
			const startTime = performance.now();

			const animate = (currentTime: number) => {
				const elapsed = currentTime - startTime;
				const progress = Math.min(elapsed / duration, 1);
				const easedProgress = this.easeInOutCubic(progress);

				const currentOpacity = startOpacity + (targetOpacity - startOpacity) * easedProgress;
				this.model.setOpacity?.(currentOpacity);

				if (progress < 1) {
					this.animationFrame = requestAnimationFrame(animate);
				} else {
					resolve();
				}
			};

			this.animationFrame = requestAnimationFrame(animate);
		});
	}

	private async fadeOut(duration: number): Promise<void> {
		return new Promise((resolve) => {
			if (!this.model) {
				resolve();
				return;
			}

			const startOpacity = this.model.getOpacity?.() ?? 1;
			const targetOpacity = 1;
			const startTime = performance.now();

			const animate = (currentTime: number) => {
				const elapsed = currentTime - startTime;
				const progress = Math.min(elapsed / duration, 1);
				const easedProgress = this.easeInOutCubic(progress);

				const currentOpacity = startOpacity + (targetOpacity - startOpacity) * easedProgress;
				this.model.setOpacity?.(currentOpacity);

				if (progress < 1) {
					this.animationFrame = requestAnimationFrame(animate);
				} else {
					resolve();
				}
			};

			this.animationFrame = requestAnimationFrame(animate);
		});
	}

	private async executeWaveMotion(duration: number, intensity: number): Promise<void> {
		return new Promise((resolve) => {
			if (!this.model) {
				resolve();
				return;
			}

			const startTime = performance.now();
			const halfDuration = duration / 2;

			const animate = (currentTime: number) => {
				const elapsed = currentTime - startTime;

				if (elapsed >= duration) {
					this.resetArmPosition();
					resolve();
					return;
				}

				const phase = elapsed < halfDuration ? 0 : 1;
				const phaseElapsed = phase === 0 ? elapsed : elapsed - halfDuration;
				const phaseProgress = phaseElapsed / halfDuration;

				const waveValue = phase === 0
					? Math.sin(phaseProgress * Math.PI) * intensity
					: Math.sin((1 - phaseProgress) * Math.PI) * intensity;

				this.applyWaveParameters(waveValue);

				this.animationFrame = requestAnimationFrame(animate);
			};

			this.animationFrame = requestAnimationFrame(animate);
		});
	}

	private applyWaveParameters(intensity: number): void {
		if (!this.model || typeof this.model.setParameterValue !== "function") {
			return;
		}

		const armRotationX = -30 * intensity;
		const armRotationY = 20 * Math.sin(intensity * Math.PI);
		const armRotationZ = 15 * intensity;

		const parameters = [
			{ id: "PARAM_ARM_R", value: armRotationX },
			{ id: "PARAM_ARM_L", value: -armRotationX * 0.3 },
			{ id: "PARAM_ARM_ROTATION_R", value: armRotationY },
			{ id: "PARAM_ARM_ROTATION_L", value: -armRotationY * 0.3 },
			{ id: "PARAM_HAND_R", value: armRotationZ },
			{ id: "PARAM_HAND_L", value: -armRotationZ * 0.3 },
		];

		parameters.forEach(({ id, value }) => {
			try {
				this.model.setParameterValue(id, value);
			} catch {
				// Parameter may not exist on all models
			}
		});
	}

	private resetArmPosition(): void {
		if (!this.model || typeof this.model.setParameterValue !== "function") {
			return;
		}

		const parameters = [
			"PARAM_ARM_R",
			"PARAM_ARM_L",
			"PARAM_ARM_ROTATION_R",
			"PARAM_ARM_ROTATION_L",
			"PARAM_HAND_R",
			"PARAM_HAND_L",
		];

		parameters.forEach((id) => {
			try {
				this.model.setParameterValue(id, 0);
			} catch {
				// Parameter may not exist on all models
			}
		});
	}

	private easeInOutCubic(t: number): number {
		return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
	}

	startAutoTrigger(): void {
		if (this.config.trigger === "timer" || this.config.trigger === "all") {
			this.stopAutoTrigger();
			this.autoTriggerTimer = setInterval(() => {
				if (this.canTrigger()) {
					this.startWave();
				}
			}, this.config.autoTriggerInterval);
		}
	}

	stopAutoTrigger(): void {
		if (this.autoTriggerTimer) {
			clearInterval(this.autoTriggerTimer);
			this.autoTriggerTimer = null;
		}
	}

	handleClick(): void {
		if (this.config.trigger === "click" || this.config.trigger === "all") {
			this.startWave();
		}
	}

	handleHover(): void {
		if (this.config.trigger === "hover" || this.config.trigger === "all") {
			this.startWave();
		}
	}

	destroy(): void {
		this.stopAutoTrigger();
		if (this.animationFrame) {
			cancelAnimationFrame(this.animationFrame);
			this.animationFrame = null;
		}
		this.model = null;
		this.isActive = false;
	}
}

export const createWaveAction = (config?: Partial<WaveActionConfig>): Live2DWaveAction => {
	return new Live2DWaveAction(config);
};

export const waveMotions: WaveMotion[] = [
	{
		name: "wave_gentle",
		parameters: [
			{ id: "PARAM_ARM_R", value: -20, time: 0, easing: "easeInOut" },
			{ id: "PARAM_ARM_R", value: -30, time: 500, easing: "easeInOut" },
			{ id: "PARAM_ARM_R", value: -20, time: 1000, easing: "easeInOut" },
			{ id: "PARAM_HAND_R", value: 15, time: 250, easing: "easeInOut" },
			{ id: "PARAM_HAND_R", value: -15, time: 750, easing: "easeInOut" },
			{ id: "PARAM_HAND_R", value: 0, time: 1000, easing: "easeInOut" },
		],
	},
	{
		name: "wave_enthusiastic",
		parameters: [
			{ id: "PARAM_ARM_R", value: -40, time: 0, easing: "easeOut" },
			{ id: "PARAM_ARM_R", value: -50, time: 300, easing: "easeInOut" },
			{ id: "PARAM_ARM_R", value: -40, time: 600, easing: "easeInOut" },
			{ id: "PARAM_HAND_R", value: 30, time: 150, easing: "easeInOut" },
			{ id: "PARAM_HAND_R", value: -30, time: 450, easing: "easeInOut" },
			{ id: "PARAM_HAND_R", value: 0, time: 600, easing: "easeIn" },
		],
	},
	{
		name: "wave_shy",
		parameters: [
			{ id: "PARAM_ARM_R", value: -15, time: 0, easing: "easeOut" },
			{ id: "PARAM_ARM_R", value: -25, time: 800, easing: "easeInOut" },
			{ id: "PARAM_HAND_R", value: 10, time: 400, easing: "easeInOut" },
			{ id: "PARAM_HAND_R", value: 0, time: 800, easing: "easeIn" },
		],
	},
];

export const getWaveMotionByName = (name: string): WaveMotion | undefined => {
	return waveMotions.find((motion) => motion.name === name);
};
