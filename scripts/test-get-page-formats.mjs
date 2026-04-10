import { initializeMoegirlMcp, stopMoegirlMcpServer } from "./moegirl-mcp-client.mjs";

async function testGetPageWithDifferentFormats() {
    console.log("🔍 测试 get_page 不同参数格式\n");

    const MOEGIRL_MCP_COMMAND = "npx";
    const MOEGIRL_MCP_ARGS = ["-y", "moegirl-wiki-mcp"];

    let requestId = 0;
    let serverProcess = null;
    let pendingRequests = new Map();

    function createJsonRpcRequest(method, params = {}) {
        const id = ++requestId;
        return { jsonrpc: "2.0", id, method, params };
    }

    function handleServerMessage(message) {
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

    async function sendRequest(method, params = {}) {
        return new Promise((resolve, reject) => {
            pendingRequests.set(requestId + 1, { resolve, reject });
            const request = createJsonRpcRequest(method, params);
            serverProcess.stdin.write(JSON.stringify(request) + "\n");

            setTimeout(() => {
                if (pendingRequests.has(requestId + 1)) {
                    pendingRequests.delete(requestId + 1);
                    reject(new Error("Request timeout"));
                }
            }, 30000);
        });
    }

    try {
        console.log("🚀 启动 MCP 服务器...");
        const { spawn } = await import("node:child_process");

        serverProcess = spawn(MOEGIRL_MCP_COMMAND, MOEGIRL_MCP_ARGS, {
            stdio: ["pipe", "pipe", "pipe"],
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
                } catch {}
            }
        });

        serverProcess.stderr.on("data", (data) => {
            const text = data.toString().trim();
            if (text && !text.includes("npm warn")) {
                console.log(`[MCP stderr] ${text}`);
            }
        });

        await new Promise(resolve => setTimeout(resolve, 5000));

        console.log("✅ 服务器已启动\n");

        const testFormats = [
            { arguments: { pageName: "魔法少女" }, desc: "pageName (标准)" },
            { arguments: { page: "魔法少女" }, desc: "page" },
            { arguments: { title: "魔法少女" }, desc: "title" },
            { arguments: { name: "魔法少女" }, desc: "name" },
            { arguments: { ttitle: "魔法少女" }, desc: "ttitle" },
            { arguments: { keyword: "魔法少女" }, desc: "keyword" },
            { arguments: "魔法少女", desc: "直接字符串" },
        ];

        for (const format of testFormats) {
            console.log(`📡 测试: ${format.desc}`);
            console.log(`   参数: ${JSON.stringify(format.arguments)}`);

            try {
                const result = await sendRequest("tools/call", {
                    name: "get_page",
                    arguments: format.arguments
                });

                console.log(`   结果: ${JSON.stringify(result).slice(0, 150)}`);
            } catch (error) {
                console.log(`   错误: ${error.message}`);
            }
            console.log();
        }

    } catch (error) {
        console.error(`❌ 测试失败: ${error.message}`);
    } finally {
        if (serverProcess) {
            serverProcess.kill();
        }
        console.log("🔌 服务器已关闭");
    }
}

testGetPageWithDifferentFormats().catch(console.error);
