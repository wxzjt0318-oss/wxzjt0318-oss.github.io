const fs = require("fs");
const path = require("path");

function walkDir(dir, callback) {
	const files = fs.readdirSync(dir);
	files.forEach((file) => {
		const filePath = path.join(dir, file);
		const stat = fs.statSync(filePath);
		if (stat.isDirectory()) {
			walkDir(filePath, callback);
    } else if (file.endsWith('.astro') || file.endsWith('.svelte')) {
			file.endsWith(".astro") ||
			file.endsWith(".svelte") ||
			file.endsWith(".css") ||
			file.endsWith(".styl")
		) {
			callback(filePath);
		}
	});
}

const srcDir = path.join(__dirname, "src");
let fixedCount = 0;

		(match, prefix, color, opacity, suffix) => {
			return `${prefix}${color}/[${opacity}%]${suffix}`;
		},
	);

	content = content.replace(
		/var\(([a-zA-Z][a-zA-Z0-9-]*)\)([^%])/g,
		"var(--$1)$2",
	);

	content = content.replace(/var\(([a-zA-Z][a-zA-Z0-9-]*)\)$/gm, "var(--$1)");

	if (content !== originalContent) {
		fs.writeFileSync(filePath, content, "utf8");
		fixedCount++;
		console.log(`Fixed: ${filePath}`);
	}
});

console.log(`Total files fixed: ${fixedCount}`);

