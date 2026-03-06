<script>
import { onDestroy, onMount } from "svelte";
import { pioConfig } from "@/config";

let pioContainer;
let modelSelector;

let pioInstance = null;
let pioInitialized = false;
let isLoading = false;
let currentModelIndex = 0;

function loadPioAssets() {
	if (typeof window === "undefined") return;

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

	return loadScript("/pio/static/l2d.js", "pio-l2d-script")
		.then(() => loadScript("/pio/static/pio.js", "pio-main-script"));
}

function initOrSwitchPio(modelPath) {
	if (typeof window === "undefined" || typeof Paul_Pio === "undefined") {
		console.error("Paul_Pio is not available");
		return;
	}

	try {
		isLoading = true;
		
		const canvas = document.getElementById("pio");
		const container = document.querySelector(".pio-container");
		const action = document.querySelector(".pio-container .pio-action");
		
		if (canvas && container && action) {
			const pioOptions = {
				model: [modelPath],
				content: pioConfig.dialog || {},
				mode: pioConfig.mode,
				hidden: pioConfig.hiddenOnMobile
			};
			
			if (pioInstance) {
				container.style.opacity = "0";
				container.style.transition = "opacity 0.3s ease";
				
				setTimeout(() => {
					if (typeof pioInstance.destroy === "function") {
						pioInstance.destroy();
					}
					
					const ctx = canvas.getContext("2d");
					if (ctx) {
						ctx.clearRect(0, 0, canvas.width, canvas.height);
					}
					
					pioInstance = new Paul_Pio(pioOptions);
					pioInitialized = true;
					
					container.style.opacity = "1";
					isLoading = false;
					console.log("Pio model switched successfully");
				}, 300);
			} else {
				pioInstance = new Paul_Pio(pioOptions);
				pioInitialized = true;
				isLoading = false;
				console.log("Pio initialized successfully (Svelte)");
			}
		} else {
			console.warn("Pio DOM elements not found");
			isLoading = false;
		}
	} catch (e) {
		console.error("Pio initialization/switch error:", e);
		isLoading = false;
	}
}

function nextModel() {
	if (pioConfig.models && pioConfig.models.length > 1) {
		currentModelIndex = (currentModelIndex + 1) % pioConfig.models.length;
		switchModel(pioConfig.models[currentModelIndex]);
	}
}

function switchModel(modelPath) {
	if (typeof window !== "undefined" && pioInitialized) {
		initOrSwitchPio(modelPath);
	}
}

onMount(async () => {
	if (!pioConfig.enable) return;

	if (pioConfig.hiddenOnMobile && window.matchMedia("(max-width: 1280px)").matches) {
		return;
	}

	try {
		await loadPioAssets();
		
		setTimeout(() => {
			initOrSwitchPio(pioConfig.models[currentModelIndex] || "/pio/models/pio/model.json");
		}, 100);
	} catch (error) {
		console.error("Failed to initialize Pio:", error);
		isLoading = false;
	}
});

onDestroy(() => {
	if (pioInstance) {
		if (typeof pioInstance.destroy === "function") {
			pioInstance.destroy();
		}
		console.log("Pio Svelte component destroyed");
	}
});
</script>

{#if pioConfig.enable}
  <div class={`pio-container ${pioConfig.position || 'right'}`} bind:this={pioContainer}>
    <div class="pio-action"></div>
    <canvas 
      id="pio"
      width={pioConfig.width || 300} 
      height={pioConfig.height || 300}
      class:opacity-50={isLoading}
    ></canvas>
    
    {#if pioConfig.models && pioConfig.models.length > 1}
      <div class="pio-model-selector" bind:this={modelSelector}>
        <select 
          on:change={(e) => {
            currentModelIndex = parseInt(e.target.value);
            switchModel(pioConfig.models[currentModelIndex]);
          }}
          value={currentModelIndex}
          disabled={isLoading}
          class="model-select"
        >
          {#each pioConfig.models as modelPath, index}
            <option value={index}>
              {modelPath.split('/').slice(-2)[0]} - {modelPath.split('/').pop()}
            </option>
          {/each}
        </select>
        <button 
          on:click={nextModel}
          disabled={isLoading}
          class="next-model-btn"
          aria-label="切换到下一个模型"
        >
          ↻
        </button>
      </div>
    {/if}
    
    {#if isLoading}
      <div class="pio-loading-indicator">
        <div class="loading-spinner"></div>
        <span>模型加载中...</span>
      </div>
    {/if}
  </div>
{/if}

<style>
  :global(.pio-container) {
    position: fixed !important;
    z-index: 52;
    will-change: transform;
    backface-visibility: hidden;
  }
  
  :global(.pio-container canvas) {
    image-rendering: -webkit-optimize-contrast;
    image-rendering: crisp-edges;
  }
  
  :global(.pio-container .pio-action) {
    display: flex;
    flex-direction: column;
    gap: 8px;
    top: 50%;
    opacity: 0;
    transform: translateY(-50%);
    pointer-events: none;
    transition: opacity 0.3s ease;
  }
  
  :global(.pio-container.left .pio-action) {
    right: 0;
  }
  
  :global(.pio-container.right .pio-action) {
    left: 0;
  }
  
  :global(.pio-container:hover .pio-action) {
    opacity: 1;
    pointer-events: auto;
  }
  
  :global(.pio-action span) {
    width: 36px !important;
    height: 36px !important;
    border-radius: 50% !important;
    border: 2px solid rgba(102, 102, 102, 0.3) !important;
    background-color: rgba(255, 255, 255, 0.95) !important;
    background-size: 60% !important;
    background-position: center !important;
    background-repeat: no-repeat !important;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    margin-bottom: 0 !important;
  }
  
  :global(.pio-action span:hover) {
    transform: scale(1.1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    border-color: rgba(102, 102, 102, 0.5) !important;
  }
  
  :global(.pio-action span:active) {
    transform: scale(0.95);
  }
  
  .pio-model-selector {
    position: absolute;
    bottom: -40px;
    left: 0;
    right: 0;
    display: flex;
    gap: 8px;
    justify-content: center;
    align-items: center;
  }
  
  .model-select {
    padding: 4px 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.8);
    font-size: 12px;
    cursor: pointer;
    backdrop-filter: blur(10px);
  }
  
  .model-select:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .next-model-btn {
    padding: 4px 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    font-size: 14px;
    backdrop-filter: blur(10px);
    transition: all 0.2s ease;
  }
  
  .next-model-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 1);
    transform: scale(1.05);
  }
  
  .next-model-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .pio-loading-indicator {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    z-index: 10;
  }
  
  .loading-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top: 2px solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .opacity-50 {
    opacity: 0.5;
  }
</style>
