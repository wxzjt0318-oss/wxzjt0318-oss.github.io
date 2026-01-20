import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./load-env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv();

// 从 sitemap 文件中解析 URL 列表
function parseSitemap(sitemapPath) {
	const sitemapContent = fs.readFileSync(sitemapPath, "utf-8");

	// 使用正则表达式提取 URL
	const urlMatches = sitemapContent.match(/<loc>(.*?)<\/loc>/g);

	if (!urlMatches) {
		console.error("❌ 未在 sitemap 中找到任何 URL");
		return [];
	}

	const urls = urlMatches.map((match) => {
		const url = match.replace(/<loc>|<\/loc>/g, "").trim();
		return url;
	});

	console.log(`✓ 从 sitemap 中解析到 ${urls.length} 个 URL`);
	return urls;
}

// 提交 URL 到 Bing IndexNow API
async function submitToIndexNow(urls) {
	if (!urls || urls.length === 0) {
		console.log("⚠ 没有 URL 需要提交");
		return;
	}

	// 限制每次提交的 URL 数量（IndexNow API 有数量限制）
	const MAX_URLS_PER_REQUEST = 10000; // IndexNow API 限制最大 10000 个URL
	const urlChunks = [];

	for (let i = 0; i < urls.length; i += MAX_URLS_PER_REQUEST) {
		urlChunks.push(urls.slice(i, i + MAX_URLS_PER_REQUEST));
	}

	const apiKey = process.env.INDEXNOW_KEY;
	const host = process.env.INDEXNOW_HOST;
	const keyLocation = `https://${host}/${apiKey}.txt`;

	if (!apiKey || !host) {
		console.error("❌ 缺少必要的环境变量: INDEXNOW_KEY 或 INDEXNOW_HOST");
		console.error("   请在 .env 文件中配置这些变量");
		return;
	}

	for (let i = 0; i < urlChunks.length; i++) {
		const chunk = urlChunks[i];
		console.log(
			`\n📊 提交第 ${i + 1}/${urlChunks.length} 批 URL (${chunk.length} 个 URL)...`,
		);

		try {
			const response = await fetch("https://api.indexnow.org/IndexNow", {
				method: "POST",
				headers: {
					"Content-Type": "application/json; charset=utf-8",
				},
				body: JSON.stringify({
					host: host,
					key: apiKey,
					keyLocation: keyLocation,
					urlList: chunk,
				}),
			});

			if (response.status === 200) {
				console.log(`✅ 第 ${i + 1} 批 URL 提交成功`);
			} else if (response.status === 202) {
				console.warn(
					`⚠ 第 ${i + 1} 批 URL 请求被接受但仍在处理中 (状态码: ${response.status})`,
				);
				console.warn("这不是标准的成功状态码，可能需要检查 API 文档");
			} else {
				console.error(
					`❌ 第 ${i + 1} 批 URL 提交失败，状态码: ${response.status}`,
				);
				const responseBody = await response.text();
				console.error(`   响应内容: ${responseBody}`);

				// 根据状态码提供更详细的错误信息
				switch (response.status) {
					case 400:
						console.error("   错误: 请求格式无效");
						break;
					case 403:
						console.error("   错误: API 密钥无效或验证失败");
						break;
					case 422:
						console.error("   错误: URL 不属于指定主机或密钥不匹配");
						break;
					case 429:
						console.error("   错误: 请求过于频繁，可能被视为垃圾信息");
						break;
					default:
						console.error(`   错误: 其他错误，状态码 ${response.status}`);
				}
			}
		} catch (error) {
			console.error(`❌ 第 ${i + 1} 批 URL 提交过程中发生错误:`, error.message);
		}
	}
}

// 主函数
async function main() {
	console.log("🚀 开始执行 Bing IndexNow URL 提交任务...\n");

	// 构建输出目录路径
	const distDir = path.join(__dirname, "../dist");
	const sitemapPath = path.join(distDir, "sitemap-0.xml");

	if (!fs.existsSync(sitemapPath)) {
		console.error(`❌ 未找到 sitemap 文件: ${sitemapPath}`);
		console.error("   请确保在构建项目后再执行此脚本");
		process.exit(1);
	}

	try {
		// 解析 sitemap 获取 URL 列表
		const urls = parseSitemap(sitemapPath);

		if (urls.length === 0) {
			console.log("⚠ sitemap 中没有找到任何 URL，跳过提交");
			return;
		}

		// 过滤出有效的 URL（以指定主机开头的）
		const host = process.env.INDEXNOW_HOST;
		const filteredUrls = urls.filter(
			(url) =>
				url.startsWith(`https://${host}/`) || url.startsWith(`http://${host}/`),
		);

		console.log(`✓ 过滤后剩余 ${filteredUrls.length} 个有效 URL`);

		if (filteredUrls.length === 0) {
			console.log("⚠ 没有找到与主机匹配的 URL，跳过提交");
			return;
		}

		// 提交 URL 到 IndexNow
		await submitToIndexNow(filteredUrls);

		console.log("\n🎉 Bing IndexNow URL 提交任务完成！");
	} catch (error) {
		console.error("❌ 执行过程中发生错误:", error.message);
		process.exit(1);
	}
}

// 运行主函数
await main();
