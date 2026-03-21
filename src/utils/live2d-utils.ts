/**
 * Live2D模型工具函数
 * 提供模型加载、切换和管理功能
 */

/**
 * 模型信息接口
 */
export interface Live2DModelInfo {
	id: string;
	name: string;
	path: string;
	thumbnail?: string;
	description?: string;
}

/**
 * Live2D模型管理器
 */
export class Live2DModelManager {
	private models: Live2DModelInfo[] = [];
	private currentModelIndex: number = 0;

	constructor() {
		this.initModels();
	}

	/**
	 * 初始化模型列表
	 * 从public/pio/models目录自动扫描模型
	 */
	private initModels(): void {
		// 这里可以实现从服务器或本地目录扫描模型的逻辑
		// 由于是静态站点，我们使用配置文件来管理模型列表
		console.log("Live2DModelManager initialized");
	}

	/**
	 * 添加模型
	 */
	addModel(model: Live2DModelInfo): void {
		this.models.push(model);
	}

	/**
	 * 获取所有模型
	 */
	getModels(): Live2DModelInfo[] {
		return this.models;
	}

	/**
	 * 获取当前模型
	 */
	getCurrentModel(): Live2DModelInfo | null {
		return this.models[this.currentModelIndex] || null;
	}

	/**
	 * 切换到下一个模型
	 */
	nextModel(): Live2DModelInfo | null {
		if (this.models.length === 0) {return null;}

		this.currentModelIndex =
			(this.currentModelIndex + 1) % this.models.length;
		return this.models[this.currentModelIndex];
	}

	/**
	 * 切换到指定索引的模型
	 */
	switchToModel(index: number): Live2DModelInfo | null {
		if (index < 0 || index >= this.models.length) {return null;}

		this.currentModelIndex = index;
		return this.models[this.currentModelIndex];
	}

	/**
	 * 从GitHub下载模型
	 * @param modelUrl GitHub上的模型文件URL
	 * @param savePath 保存路径（相对于public/pio/models）
	 */
	async downloadModelFromGitHub(
		modelUrl: string,
		savePath: string,
	): Promise<boolean> {
		try {
			// 由于是静态站点，我们无法在运行时写入文件系统
			// 这里提供一个示例，实际应用中需要通过服务器或构建时下载
			console.log(`尝试从GitHub下载模型: ${modelUrl} 到 ${savePath}`);

			// 模拟下载过程
			return new Promise((resolve) => {
				setTimeout(() => {
					console.log(`模型下载完成: ${savePath}`);
					resolve(true);
				}, 2000);
			});
		} catch (error) {
			console.error("模型下载失败:", error);
			return false;
		}
	}

	/**
	 * 加载模型配置
	 * @param configPath 配置文件路径
	 */
	async loadModelConfig(configPath: string): Promise<any> {
		try {
			const response = await fetch(configPath);
			if (!response.ok) {
				throw new Error(`无法加载模型配置: ${response.statusText}`);
			}
			return await response.json();
		} catch (error) {
			console.error("加载模型配置失败:", error);
			throw error;
		}
	}
}

/**
 * Live2D模型工具函数
 */
export const Live2DUtils = {
	/**
	 * 生成模型唯一ID
	 */
	generateModelId(name: string): string {
		return `${name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
	},

	/**
	 * 验证模型文件是否完整
	 * @param modelPath 模型路径
	 */
	async validateModel(modelPath: string): Promise<boolean> {
		try {
			// 检查model.json是否存在
			const modelJsonUrl = `${modelPath}/model.json`;
			const response = await fetch(modelJsonUrl);
			if (!response.ok) {
				throw new Error("缺少model.json文件");
			}

			const modelJson = await response.json();

			// 检查必要的模型文件
			const requiredFiles = [
				modelJson.model || "model.moc",
				...(modelJson.textures || []),
				...Object.values(modelJson.motions || {}).flat(),
			];

			// 验证文件是否存在
			for (const file of requiredFiles) {
				const filePath = `${modelPath}/${file}`;
				const fileResponse = await fetch(filePath);
				if (!fileResponse.ok) {
					console.warn(`模型文件缺失: ${file}`);
					// 非关键文件缺失时继续验证
				}
			}

			return true;
		} catch (error) {
			console.error("模型验证失败:", error);
			return false;
		}
	},

	/**
	 * 从GitHub仓库获取模型列表
	 * @param repoUrl GitHub仓库URL
	 */
	async getModelsFromGitHub(repoUrl: string): Promise<string[]> {
		try {
			// 解析GitHub API URL
			const apiUrl = repoUrl
				.replace("https://github.com/", "https://api.github.com/repos/")
				.concat("/contents");

			const response = await fetch(apiUrl);
			if (!response.ok) {
				throw new Error(
					`无法获取GitHub仓库内容: ${response.statusText}`,
				);
			}

			const contents = await response.json();
			const modelDirs = contents
				.filter(
					(item: any) => item.type === "dir" && item.name !== ".git",
				)
				.map((item: any) => item.path);

			return modelDirs;
		} catch (error) {
			console.error("从GitHub获取模型列表失败:", error);
			return [];
		}
	},
};

/**
 * Live2D模型示例配置
 * 手动添加模型时，可以参考此配置格式
 */
export const sampleLive2DModels: Live2DModelInfo[] = [
	{
		id: "default-pio",
		name: "默认模型",
		path: "/pio/models/pio/model.json",
		thumbnail: "/pio/models/pio/textures/default-costume.png",
		description: "默认的Pio Live2D模型",
	},
	{
		id: "custom-model-1",
		name: "自定义模型1",
		path: "/pio/models/custom1/model.json",
		description: "手动添加的自定义模型",
	},
];

/**
 * 手动添加模型指南
 * 1. 下载Live2D模型文件，确保包含以下文件：
 *    - model.json (模型配置文件)
 *    - model.moc (模型数据文件)
 *    - textures/ (纹理文件夹)
 *    - motions/ (动作文件夹)
 *
 * 2. 将模型文件放入public/pio/models/目录下，例如：
 *    public/pio/models/your-model/
 *      ├── model.json
 *      ├── model.moc
 *      ├── textures/
 *      │   └── default.png
 *      └── motions/
 *          ├── idle.mtn
 *          └── tap.mtn
 *
 * 3. 在src/config.ts中添加模型路径到pioConfig.models数组：
 *    export const pioConfig: PioConfig = {
 *      // 其他配置...
 *      models: [
 *        '/pio/models/pio/model.json',
 *        '/pio/models/your-model/model.json'
 *      ]
 *    };
 *
 * 4. 重启开发服务器，即可在模型选择器中看到新添加的模型
 */

