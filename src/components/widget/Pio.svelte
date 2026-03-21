<script>
import { onDestroy, onMount } from "svelte";

import { pioConfig } from "@/config";

// 确保DOM元素正确引用
let pioContainer;
let modelSelector;

// 全局Pio实例引用
let pioInstance = null;
let pioInitialized = false;
let isLoading = false;

// 当前选中的模型索引
let currentModelIndex = 0;

// 欢迎气泡状态
let showWelcomeBubble = false;
const welcomeMessage = "欢迎光临灵梦的博客站";

// 检查是否为新访客
function isNewVisitor(): boolean {
	if (typeof window === "undefined") {return false;}
	
	const visitedKey = "lingmeng_blog_visited";
	const visited = localStorage.getItem(visitedKey);
	
	if (!visited) {
		// 标记为已访问
		localStorage.setItem(visitedKey, new Date().toISOString());
		return true;
	}
	
	return false;
}

// 播放欢迎动作序列
async function playWelcomeSequence() {
	if (typeof window === "undefined" || !pioInitialized) {return;}
	
	try {
		// 显示欢迎气泡
		showWelcomeBubble = true;
		
		// 等待模型加载完成
		await new Promise(resolve => setTimeout(resolve, 500));
		
		// 尝试触发表情和动作
		const canvas = document.getElementById("pio");
		if (canvas) {
			// 模拟点击触发触摸动作
			canvas.click();
		}
		
		// 使用 pioInstance 的 message 方法显示欢迎消息
		if (pioInstance && typeof pioInstance.message === "function") {
			pioInstance.message(welcomeMessage, { time: 5000 });
		}
		
		// 3秒后隐藏气泡
		setTimeout(() => {
			showWelcomeBubble = false;
		}, 5000);
	} catch (error) {
		// eslint-disable-next-line no-console
		console.error("Welcome sequence error:", error);
	}
}

// 加载必要的脚本
function loadPioAssets() {
	if (typeof window === "undefined") {return;}

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

// 初始化或切换Pio模型
function initOrSwitchPio(modelPath) {
	if (typeof window === "undefined" || typeof Paul_Pio === "undefined") {
		// eslint-disable-next-line no-console
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
					if (pioInstance && typeof pioInstance.destroy === "function") {
						pioInstance.destroy();
						pioInstance = null;
					}
					
					const ctx = canvas.getContext("2d");
					if (ctx) {
						ctx.clearRect(0, 0, canvas.width, canvas.height);
					}
					
					pioInstance = new Paul_Pio(pioOptions);
					pioInitialized = true;
					
					container.style.opacity = "1";
					isLoading = false;
					// eslint-disable-next-line no-console
					console.log("Pio model switched successfully");
				}, 300);
			} else {
				pioInstance = new Paul_Pio(pioOptions);
				pioInitialized = true;
				isLoading = false;
				// eslint-disable-next-line no-console
				console.log("Pio initialized successfully (Svelte)");
				
				// 检查是否为新访客，播放欢迎序列
				if (isNewVisitor()) {
					setTimeout(() => {
						playWelcomeSequence();
					}, 1000);
				}
			}
		} else {
			// eslint-disable-next-line no-console
			console.warn("Pio DOM elements not found");
			isLoading = false;
		}
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error("Pio initialization/switch error:", e);
		isLoading = false;
	}
}

// 切换到下一个模型
function nextModel() {
	if (pioConfig.models && pioConfig.models.length > 1) {
		currentModelIndex = (currentModelIndex + 1) % pioConfig.models.length;
		switchModel(pioConfig.models[currentModelIndex]);
	}
}

// 切换到指定模型
function switchModel(modelPath) {
	if (typeof window !== "undefined" && pioInitialized) {
		initOrSwitchPio(modelPath);
	}
}

onMount(async () => {
	if (!pioConfig.enable) {return;}

	if (pioConfig.hiddenOnMobile && window.matchMedia("(max-width: 1280px)").matches) {
		return;
	}

	try {
		await loadPioAssets();
		
		setTimeout(() => {
			initOrSwitchPio(pioConfig.models[currentModelIndex] || "/pio/models/pio/model.json");
		}, 100);
	} catch (error) {
		// eslint-disable-next-line no-console
		console.error("Failed to initialize Pio:", error);
		isLoading = false;
	}
});

onDestroy(() => {
	if (pioInstance) {
		if (typeof pioInstance.destroy === "function") {
			pioInstance.destroy();
		}
		pioInstance = null;
		// eslint-disable-next-line no-console
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
      class:opacity-50={isLoading}
    ></canvas>
    
    <!-- 欢迎气泡 -->
    {#if showWelcomeBubble}
      <div class="welcome-bubble">
        <div class="bubble-content">
          <span class="bubble-text">{welcomeMessage}</span>
        </div>
        <div class="bubble-arrow"></div>
      </div>
    {/if}
    
    <!-- 模型选择器 -->
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
    
    <!-- 加载指示器 -->
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
  
  /* 欢迎气泡样式 */
  .welcome-bubble {
    position: absolute;
    top: -60px;
    right: -20px;
    z-index: 100;
    animation: bubbleFadeIn 0.5s ease-out, bubbleBounce 2s ease-in-out infinite 0.5s;
  }
  
  .bubble-content {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 12px 18px;
    border-radius: 20px;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    white-space: nowrap;
    font-size: 14px;
    font-weight: 500;
    letter-spacing: 0.5px;
  }
  
  .bubble-text {
    display: inline-block;
    animation: textGlow 2s ease-in-out infinite;
  }
  
  .bubble-arrow {
    position: absolute;
    bottom: -8px;
    right: 30px;
    width: 0;
    height: 0;
    border-left: 10px solid transparent;
    border-right: 10px solid transparent;
    border-top: 10px solid #764ba2;
  }
  
  @keyframes bubbleFadeIn {
    from {
      opacity: 0;
      transform: translateY(10px) scale(0.9);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  
  @keyframes bubbleBounce {
    0%, 100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-5px);
    }
  }
  
  @keyframes textGlow {
    0%, 100% {
      text-shadow: 0 0 5px rgba(255, 255, 255, 0.5);
    }
    50% {
      text-shadow: 0 0 15px rgba(255, 255, 255, 0.8);
    }
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
