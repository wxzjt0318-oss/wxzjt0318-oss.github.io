import sharp from "sharp";
import { glob } from "glob";
import { dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const publicDir = path.join(rootDir, "public");

const targets = [
	"assets/home/*.png",
	"assets/home/*.jpg",
	"sakura.png",
	"images/albums/**/*.jpg",
	"images/albums/**/*.jpeg",
	"images/diary/*.jpg",
	"images/device/*.png",
	"assets/music/cover/*.jpg",
];

async function convertToWebP(inputPath, quality = 80) {
	const ext = extname(inputPath);
	const outputPath = inputPath.replace(/\.(png|jpg|jpeg)$/i, ".webp");

	if (fs.existsSync(outputPath)) {
		const inputStat = fs.statSync(inputPath);
		const outputStat = fs.statSync(outputPath);
		if (outputStat.mtime > inputStat.mtime) {
			console.log(`⏭️  Skipped (exists): ${outputPath}`);
			return;
		}
	}

	try {
		await sharp(inputPath)
			.webp({ 
				quality, 
				effort: 6,
				smartSubsample: true,
				mixed: true
			})
			.toFile(outputPath);

		const inputSize = fs.statSync(inputPath).size;
		const outputSize = fs.statSync(outputPath).size;
		const savings = ((1 - outputSize / inputSize) * 100).toFixed(1);

		console.log(`✅ ${inputPath} → ${outputPath}`);
		console.log(
			`   ${(inputSize / 1024).toFixed(1)}KB → ${(outputSize / 1024).toFixed(1)}KB (${savings}% saved)`,
		);
	} catch (err) {
		console.error(`❌ Failed: ${inputPath}`, err.message);
	}
}

async function convertToAVIF(inputPath, quality = 65) {
	const ext = extname(inputPath);
	const outputPath = inputPath.replace(/\.(png|jpg|jpeg|webp)$/i, ".avif");

	if (fs.existsSync(outputPath)) {
		const inputStat = fs.statSync(inputPath);
		const outputStat = fs.statSync(outputPath);
		if (outputStat.mtime > inputStat.mtime) {
			console.log(`⏭️  Skipped AVIF (exists): ${outputPath}`);
			return;
		}
	}

	try {
		await sharp(inputPath)
			.avif({ 
				quality, 
				effort: 6,
				chromaSubsampling: '4:2:0'
			})
			.toFile(outputPath);

		const inputSize = fs.statSync(inputPath).size;
		const outputSize = fs.statSync(outputPath).size;
		const savings = ((1 - outputSize / inputSize) * 100).toFixed(1);

		console.log(`✅ AVIF: ${inputPath} → ${outputPath}`);
		console.log(
			`   ${(inputSize / 1024).toFixed(1)}KB → ${(outputSize / 1024).toFixed(1)}KB (${savings}% saved)`,
		);
	} catch (err) {
		console.error(`❌ AVIF Failed: ${inputPath}`, err.message);
	}
}

async function main() {
	const files = await glob(targets, { cwd: publicDir, absolute: true });

	console.log(`Found ${files.length} images to convert\n`);

	for (const file of files) {
		await convertToWebP(file, 80);
	}

	console.log("\n✓ WebP Done!");
}

main().catch(console.error);
