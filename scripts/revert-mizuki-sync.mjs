import path from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const restoreScript = path.join(root, "scripts", "personalization-restore.mjs");

const child = spawn(process.execPath, [restoreScript], {
	stdio: "inherit",
	env: process.env,
});

child.on("exit", (code) => {
	process.exit(code ?? 0);
});
