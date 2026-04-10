import { spawn } from "node:child_process";

const MOEGIRL_MCP_COMMAND = "npx";
const MOEGIRL_MCP_ARGS = ["-y", "moegirl-wiki-mcp"];

let serverProcess = null;
let requestId = 0;
let pendingRequests = new Map();
let isInitialized = false;
let isReady = false;

function createJsonRpcRequest(method, params = {}) {
	const id = ++requestId;
	return { jsonrpc: "2.0", id, method, params };
}

function createJsonRpcResponse(id, result) {
	return { jsonrpc: "2.0", id, result };
}

function createJsonRpcError(id, code, message) {
	return { jsonrpc: "2.0", id, error: { code, message } };
}

function parseJsonLines(data) {
	const lines = data.split("\n").filter((line) => line.trim());
	const results = [];
	for (const line of lines) {
		try {
			results.push(JSON.parse(line));
		} catch {
		}
	}
	return results;
}

export function startMoegirlMcpServer() {
	return new Promise((resolve, reject) => {
		if (serverProcess) {
			resolve();
			return;
		}

		console.log("🚀 启动萌娘百科 MCP 服务器...");

		serverProcess = spawn(MOEGIRL_MCP_COMMAND, MOEGIRL_MCP_ARGS, {
			stdio: ["pipe", "pipe", "pipe"],
			env: { ...process.env },
			shell: true,
		});

		let stdoutBuffer = "";

		serverProcess.stdout.on("data", (data) => {
			stdoutBuffer += data.toString();

			while (stdoutBuffer.includes("\n")) {
				const newlineIndex = stdoutBuffer.indexOf("\n");
				const line = stdoutBuffer.slice(0, newlineIndex);
				stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);

				if (!line.trim()) continue;

				try {
					const message = JSON.parse(line);
					handleServerMessage(message);
				} catch {
					// Log stdout for debugging
					if (line.includes("✅") || line.includes("🔗") || line.includes("🚀")) {
						console.log(line);
					}
				}
			}
		});

		serverProcess.stderr.on("data", (data) => {
			const text = data.toString().trim();
			if (text && !text.includes("npm warn")) {
				console.warn(`[Moegirl MCP stderr] ${text}`);
			}
		});

		serverProcess.on("error", (error) => {
			console.error(`❌ MCP 服务器启动失败: ${error.message}`);
			serverProcess = null;
			reject(error);
		});

		serverProcess.on("close", (code) => {
			console.log(`🔌 MCP 服务器已关闭 (code: ${code})`);
			serverProcess = null;
			isInitialized = false;
			isReady = false;
		});

		// Wait for initialization
		setTimeout(() => {
			if (serverProcess && !isInitialized) {
				console.log("⏳ 等待 MCP 服务器初始化...");
			}
		}, 2000);

		setTimeout(() => {
			if (serverProcess) {
				resolve();
			}
		}, 5000);
	});
}

function handleServerMessage(message) {
	if (message.method === "notifications/initialized") {
		isInitialized = true;
		console.log("✅ MCP 服务器已初始化");
		return;
	}

	if (message.method === "notifications/server-ready") {
		isReady = true;
		console.log("✅ MCP 服务器已就绪");
		return;
	}

	if (message.id && pendingRequests.has(message.id)) {
		const { resolve, reject } = pendingRequests.get(message.id);
		pendingRequests.delete(message.id);

		if (message.error) {
			reject(new Error(message.error.message || "Unknown error"));
		} else {
			resolve(message.result);
		}
	}
}

function setServerReady() {
	isReady = true;
	console.log("✅ MCP 服务器已就绪 (通过搜索验证)");
}

async function sendRequest(method, params) {
	if (!serverProcess) {
		throw new Error("MCP 服务器未启动");
	}

	return new Promise((resolve, reject) => {
		const request = createJsonRpcRequest(method, params);
		pendingRequests.set(request.id, { resolve, reject });

		const timeout = setTimeout(() => {
			if (pendingRequests.has(request.id)) {
				pendingRequests.delete(request.id);
				reject(new Error(`请求超时: ${method}`));
			}
		}, 30000);

		serverProcess.stdin.write(JSON.stringify(request) + "\n");

		// For tools/list, resolve quickly after sending
		if (method === "tools/list") {
			setTimeout(() => {
				if (pendingRequests.has(request.id)) {
					pendingRequests.delete(request.id);
					resolve({ tools: [] });
				}
			}, 1000);
		}
	});
}

export async function initializeMoegirlMcp() {
	try {
		await startMoegirlMcpServer();

		// Send initialize request
		const initResult = await sendRequest("initialize", {
			protocolVersion: "2024-11-05",
			capabilities: {},
			clientInfo: { name: "bangumi-daily-posts", version: "1.0.0" },
		});

		console.log(`✅ 初始化响应: ${JSON.stringify(initResult).slice(0, 100)}`);

		// Send initialized notification
		if (serverProcess) {
			serverProcess.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
		}

		// Wait for server to be ready
		const startTime = Date.now();
		while (!isReady && serverProcess) {
			await new Promise(resolve => setTimeout(resolve, 500));
			if (Date.now() - startTime > 15000) {
				console.warn("⚠️ 等待 MCP 服务器就绪超时，但仍尝试继续...");
				break;
			}
		}

		console.log("✅ 萌娘百科 MCP 客户端初始化完成");
		return true;
	} catch (error) {
		console.error(`❌ MCP 初始化失败: ${error.message}`);
		return false;
	}
}

export async function searchMoegirl(query, exact = false) {
	try {
		if (!serverProcess) {
			console.log("⚠️ MCP 服务器未运行，尝试启动...");
			await initializeMoegirlMcp();
		}

		const result = await sendRequest("tools/call", {
			name: "search_moegirl",
			arguments: { query, exact }
		});

		if (result && result.content) {
			const textContent = result.content.find((c) => c.type === "text");
			if (textContent) {
				setServerReady();
				const text = textContent.text.trim();

				if (text.includes("未找到相关条目") || text.includes("❌")) {
					console.log(`⚠️ 萌娘百科搜索未找到: ${query}`);
					return [];
				}

				try {
					const parsed = JSON.parse(text);
					return parsed;
				} catch {
					return text;
				}
			}
		}

		return result;
	} catch (error) {
		console.warn(`⚠️ 萌娘百科搜索失败: ${error.message}`);
		return null;
	}
}

export async function getMoegirlPage(pageName) {
	try {
		if (!serverProcess) {
			console.log("⚠️ MCP 服务器未运行，尝试启动...");
			await initializeMoegirlMcp();
		}

		const result = await sendRequest("tools/call", {
			name: "get_page",
			arguments: { title: pageName }
		});

		if (result && result.content) {
			const textContent = result.content.find((c) => c.type === "text");
			if (textContent) {
				const text = textContent.text.trim();
				if (text.includes("操作失败") || text.includes("错误") || text.includes("undefined")) {
					console.warn(`⚠️ 获取页面失败: ${pageName}`);
					return null;
				}
				return text;
			}
		}

		return result;
	} catch (error) {
		console.warn(`⚠️ 获取萌娘百科页面失败: ${error.message}`);
		return null;
	}
}

export async function getMoegirlPageSection(pageName, section) {
	try {
		if (!serverProcess) {
			console.log("⚠️ MCP 服务器未运行，尝试启动...");
			await initializeMoegirlMcp();
		}

		const result = await sendRequest("tools/call", {
			name: "get_page_sections",
			arguments: { title: pageName, section }
		});

		if (result && result.content) {
			const textContent = result.content.find((c) => c.type === "text");
			if (textContent) {
				const text = textContent.text.trim();
				if (text.includes("操作失败") || text.includes("错误") || text.includes("undefined")) {
					console.warn(`⚠️ 获取页面章节失败: ${pageName} - ${section}`);
					return null;
				}
				return text;
			}
		}

		return result;
	} catch (error) {
		console.warn(`⚠️ 获取萌娘百科章节失败: ${error.message}`);
		return null;
	}
}

export async function getMoegirlPageSections(pageName, sectionTitles = []) {
	try {
		if (!serverProcess) {
			console.log("⚠️ MCP 服务器未运行，尝试启动...");
			await initializeMoegirlMcp();
		}

		const result = await sendRequest("tools/call", {
			name: "get_page_sections",
			arguments: { pageName, sectionTitles }
		});

		if (result && result.content) {
			const textContent = result.content.find((c) => c.type === "text");
			return textContent ? textContent.text : result;
		}

		return result;
	} catch (error) {
		console.warn(`⚠️ 获取萌娘百科页面章节失败: ${error.message}`);
		return null;
	}
}

export async function stopMoegirlMcpServer() {
	if (serverProcess) {
		serverProcess.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "shutdown" }) + "\n");
		setTimeout(() => {
			if (serverProcess) {
				serverProcess.kill();
				serverProcess = null;
			}
		}, 1000);
	}
}

export function isMoegirlMcpReady() {
	return serverProcess !== null && isReady;
}

export function isMoegirlMcpConnected() {
	return serverProcess !== null;
}
