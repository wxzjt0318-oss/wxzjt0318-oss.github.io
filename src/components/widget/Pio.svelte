<script>
import { onDestroy, onMount } from "svelte";

import { pioConfig } from "@/config";
import { createWaveAction,Live2DWaveAction } from "@/utils/live2d-wave-action";

// 确保DOM元素正确引用
let pioContainer;
let modelSelector;

// 全局Pio实例引用
let pioInstance = null;
let pioInitialized = false;
let isLoading = false;

// 当前选中的模型索引
let currentModelIndex = 0;

// 招手动作管理器
let waveAction = null;
let isWaving = false;

// 加载必要的脚本
function loadPioAssets() {
	if (typeof window === "undefined") {return;}

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

// 初始化或切换Pio模型
function initOrSwitchPio(modelPath) {
	if (typeof window === "undefined" || typeof Paul_Pio === "undefined") {
		// eslint-disable-next-line no-console
		console.error("Paul_Pio is not available");
		return;
	}

	try {
		isLoading = true;
		
		// 确保DOM元素存在
		const canvas = document.getElementById("pio");
		const container = document.querySelector(".pio-container");
		const action = document.querySelector(".pio-container .pio-action");
		
		if (canvas && container && action) {
			// 创建配置对象
			const pioOptions = {
				model: [modelPath],
				content: pioConfig.dialog || {},
				mode: pioConfig.mode,
				hidden: pioConfig.hiddenOnMobile
			};
			
			// 如果已经有实例，先销毁
			if (pioInstance) {
				// 添加淡出效果
				container.style.opacity = "0";
				container.style.transition = "opacity 0.3s ease";
				
				// 延迟销毁和重新初始化，等待淡出动画完成
				setTimeout(() => {
					// 销毁现有实例
					if (pioInstance && typeof pioInstance.destroy === "function") {
						pioInstance.destroy();
						pioInstance = null; // 确保引用被清除
					}
					
					// 清除画布
					const ctx = canvas.getContext("2d");
					if (ctx) {
						ctx.clearRect(0, 0, canvas.width, canvas.height);
					}
					
					// 重新初始化
					pioInstance = new Paul_Pio(pioOptions);
					pioInitialized = true;
					
					// 初始化招手动作
					initWaveAction();
					
					// 添加淡入效果
					container.style.opacity = "1";
					isLoading = false;
					// eslint-disable-next-line no-console
					console.log("Pio model switched successfully");
				}, 300);
			} else {
				// 首次初始化
				pioInstance = new Paul_Pio(pioOptions);
				pioInitialized = true;
				
				// 初始化招手动作
				initWaveAction();
				
				isLoading = false;
				// eslint-disable-next-line no-console
				console.log("Pio initialized successfully (Svelte)");
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

// 初始化招手动作管理器
function initWaveAction() {
	if (typeof window === "undefined") {return;}
	
	// 销毁旧的招手动作管理器
	if (waveAction) {
		waveAction.destroy();
	}
	
	// 创建新的招手动作管理器
	waveAction = createWaveAction({
		enable: true,
		trigger: "all",
		duration: 2000,
		intensity: 1.0,
		repeatCount: 3,
		autoTriggerInterval: 60000,
		transitionDuration: 300
	});
	
	// 启动自动触发
	waveAction.startAutoTrigger();
	
	// 绑定模型实例（如果可用）
	if (window.live2dModel) {
		waveAction.setModel(window.live2dModel);
	}
}

// 触发招手动作
function triggerWave() {
	if (waveAction && waveAction.canTrigger() && !isWaving) {
		isWaving = true;
		waveAction.startWave().finally(() => {
			isWaving = false;
		});
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

// 处理画布点击事件
function handleCanvasClick(event) {
	// 触发招手动作
	triggerWave();
	
	// 如果有Pio实例，触发原有消息
	if (pioInstance && typeof pioInstance.message === "function") {
		pioInstance.message("你好呀～");
	}
}

// 处理画布悬停事件
function handleCanvasMouseEnter() {
	// 悬停时触发招手动作（有冷却时间）
	if (waveAction && waveAction.canTrigger()) {
		waveAction.handleHover();
	}
}

// 处理画布双击事件
function handleCanvasDoubleClick() {
	// 双击触发热情招手
	if (waveAction && !isWaving) {
		waveAction.updateConfig({ intensity: 1.5, repeatCount: 5 });
		triggerWave();
		// 恢复默认配置
		setTimeout(() => {
			waveAction?.updateConfig({ intensity: 1.0, repeatCount: 3 });
		}, 3000);
	}
}

onMount(async () => {
	if (!pioConfig.enable) {return;}

	// 如果配置了手机端隐藏，且当前屏幕宽度小于 1280px (平板/手机)，则直接终止，不加载脚本
    if (pioConfig.hiddenOnMobile && window.matchMedia("(max-width: 1280px)").matches) {
        return;
    }

	try {
		// 加载资源
		await loadPioAssets();
		
		// 等待DOM完全渲染
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
	// 销毁招手动作管理器
	if (waveAction) {
		waveAction.destroy();
		waveAction = null;
	}
	
	// Svelte 组件销毁时清理 Pio 实例
	if (pioInstance) {
		// 如果 Paul_Pio 有清理方法，这里可以调用
		if (typeof pioInstance.destroy === "function") {
			pioInstance.destroy();
		}
		pioInstance = null; // 确保引用被清除
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
      class:waving={isWaving}
      on:click={handleCanvasClick}
      on:mouseenter={handleCanvasMouseEnter}
      on:dblclick={handleCanvasDoubleClick}
    />
    
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
    
    <!-- 招手动作按钮 -->
    <button 
      on:click={triggerWave}
      disabled={isWaving || isLoading}
      class="wave-action-btn"
      aria-label="触发招手动作"
      title="招手"
    >
      👋
    </button>
    
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
  
  .wave-action-btn {
    position: absolute;
    bottom: -80px;
    left: 50%;
    transform: translateX(-50%);
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 2px solid rgba(102, 102, 102, 0.3);
    background: rgba(255, 255, 255, 0.95);
    font-size: 20px;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(10px);
  }
  
  .wave-action-btn:hover:not(:disabled) {
    transform: translateX(-50%) scale(1.1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    border-color: rgba(102, 102, 102, 0.5);
  }
  
  .wave-action-btn:active:not(:disabled) {
    transform: translateX(-50%) scale(0.95);
  }
  
  .wave-action-btn:disabled {
    opacity: 0.5;
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
  
  .waving {
    animation: wave-hint 0.5s ease-in-out;
  }
  
  @keyframes wave-hint {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.02); }
  }
  
  #pio {
    cursor: pointer;
    transition: transform 0.3s ease;
  }
  
  #pio:hover {
    transform: scale(1.01);
  }
</style>
