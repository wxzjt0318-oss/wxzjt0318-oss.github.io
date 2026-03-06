<script>
import { onDestroy, onMount } from "svelte";
import { pioConfig } from "@/config";

// 确保DOM元素正确引用
let pioContainer;

// 全局Pio实例引用
let pioInstance = null;
let pioInitialized = false;

// 加载必要的脚本
function loadPioAssets() {
	if (typeof window === "undefined") return;

	// 加载JS脚本
	const loadScript = (src, id) => {
		return new Promise((resolve, reject) => {
			if (document.querySelector(`#${id}`)) {
				resolve();
				return;
			}
			const script = document.createElement("script");
			script.id = id;
			script.src = src;
			script.onload = resolve;
			script.onerror = reject;
			document.head.appendChild(script);
		});
	};

	// 按顺序加载脚本
	return loadScript("/pio/static/l2d.js", "pio-l2d-script")
		.then(() => loadScript("/pio/static/pio.js", "pio-main-script"));
}

// 等待 DOM 加载完成后再初始化 Pio
function initPio() {
	if (typeof window !== "undefined" && typeof Paul_Pio !== "undefined") {
		try {
			// 确保DOM元素存在
			const canvas = document.getElementById("pio");
			const container = document.querySelector(".pio-container");
			const action = document.querySelector(".pio-container .pio-action");
			
			if (canvas && container && action && !pioInitialized) {
				// 创建配置对象
				const pioOptions = {
					model: pioConfig.models || ["/pio/models/pio/model.json"],
					content: pioConfig.dialog || {},
					mode: pioConfig.mode,
					hidden: pioConfig.hiddenOnMobile
				};
				
				// 初始化Pio
				pioInstance = new Paul_Pio(pioOptions);
				pioInitialized = true;
				console.log("Pio initialized successfully (Svelte)");
			} else if (!pioContainer || !canvas) {
				console.warn("Pio DOM elements not found, retrying...");
				setTimeout(initPio, 100);
			}
		} catch (e) {
			console.error("Pio initialization error:", e);
		}
	} else {
		// 如果 Paul_Pio 还未定义，稍后再试
		setTimeout(initPio, 100);
	}
}

onMount(async () => {
	if (!pioConfig.enable) return;

	// 如果配置了手机端隐藏，且当前屏幕宽度小于 1280px (平板/手机)，则直接终止，不加载脚本
    if (pioConfig.hiddenOnMobile && window.matchMedia("(max-width: 1280px)").matches) {
        return;
    }

	try {
		// 加载资源
		await loadPioAssets();
		
		// 等待DOM完全渲染
		setTimeout(() => {
			initPio();
		}, 100);
	} catch (error) {
		console.error("Failed to initialize Pio:", error);
	}
});

onDestroy(() => {
	// Svelte 组件销毁时清理 Pio 实例
	if (pioInstance) {
		// 如果 Paul_Pio 有清理方法，这里可以调用
		console.log("Pio Svelte component destroyed");
	}
});
</script>

{#if pioConfig.enable}
  <div class={`pio-container ${pioConfig.position || 'right'}`} bind:this={pioContainer}>
    <div class="pio-action"></div>
    <canvas 
      id="pio"
      width={pioConfig.width || 280} 
      height={pioConfig.height || 250}
    ></canvas>
  </div>
{/if}

<style>
  /* Pio 相关样式将通过外部CSS文件加载 */
</style>