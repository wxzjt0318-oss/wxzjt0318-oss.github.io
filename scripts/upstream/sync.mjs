/**
 * 上游同步：把 LyraVoid/Shirone 自上次同步以来的改动三方合并进本仓库。
 * ─────────────────────────────────────────────────────────────────────────────
 * 本仓库与上游没有共同的 git 历史，所以不能直接 git merge：
 * 逐个文件做 git merge-file（基准 = 上次同步到的上游版本，ours = 本仓库，theirs = 上游最新）。
 *
 *   node scripts/upstream/sync.mjs           # 检查是否有更新（只读）
 *   node scripts/upstream/sync.mjs --apply   # 合并到工作区，并更新 scripts/upstream/state.json
 *
 * state.json：
 *   lastSynced  上次同步到的上游提交（完整 SHA）
 *   pathMap     上游路径 → 本仓库路径（如上游 ci.yml 在本仓库叫 CI.yml）
 *   keepOurs    始终保留本仓库版本的文件（站点自己的内容 / 配置）
 *   regenerate  不合并、合并后用工具重新生成的文件（如 pnpm-lock.yaml）
 *
 * 退出码：0 = 没有更新或合并干净；2 = 有冲突（文件里留有 <<<<<<< 标记，需要手动解决）；1 = 出错。
 * 详细流程见 docs/upstream-sync.md。
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const STATE_FILE = path.join(__dirname, "state.json");
const apply = process.argv.includes("--apply");
const MAX_BUFFER = 64 * 1024 * 1024;

const git = (args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: MAX_BUFFER });
const gitBuffer = (args) => execFileSync("git", args, { cwd: ROOT, maxBuffer: MAX_BUFFER, stdio: ["ignore", "pipe", "ignore"] });

const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
const REMOTE = "upstream";

if (!git(["remote"]).split("\n").includes(REMOTE)) git(["remote", "add", REMOTE, state.repo]);
git(["fetch", "--quiet", REMOTE, state.branch]);

const base = git(["rev-parse", "--verify", `${state.lastSynced}^{commit}`]).trim();
const theirs = git(["rev-parse", "--verify", `${REMOTE}/${state.branch}^{commit}`]).trim();
if (base === theirs) {
	console.log(`上游没有更新（已同步到 ${theirs.slice(0, 8)}）。`);
	process.exit(0);
}

const commits = git(["log", "--format=%h %s", `${base}..${theirs}`]).trim().split("\n").filter(Boolean);
console.log(`上游有 ${commits.length} 个新提交（${base.slice(0, 8)} → ${theirs.slice(0, 8)}）：`);
for (const c of commits) console.log(`  ${c}`);

const changes = git(["diff", "--name-status", "--no-renames", base, theirs])
	.trim()
	.split("\n")
	.filter(Boolean)
	.map((line) => {
		const [status, file] = line.split("\t");
		return { status, upstream: file, local: state.pathMap?.[file] || file };
	});

if (!apply) {
	console.log(`\n涉及 ${changes.length} 个文件。加 --apply 执行合并。`);
	process.exit(0);
}

const keepOurs = new Set(state.keepOurs || []);
const regenerate = new Set(state.regenerate || []);
const report = { merged: [], added: [], deleted: [], kept: [], conflicts: [], skipped: [] };
const blob = (rev, file) => {
	try {
		return gitBuffer(["show", `${rev}:${file}`]);
	} catch {
		return null;
	}
};

const tmpDir = fs.mkdtempSync(path.join(ROOT, ".upstream-sync-"));
try {
	for (const { status, upstream, local } of changes) {
		const target = path.join(ROOT, local);
		if (keepOurs.has(local) || regenerate.has(local)) {
			report.kept.push(local);
			continue;
		}
		const theirsBuf = blob(theirs, upstream);
		const baseBuf = blob(base, upstream);
		const oursBuf = fs.existsSync(target) ? fs.readFileSync(target) : null;

		if (status === "D") {
			if (oursBuf && baseBuf && oursBuf.equals(baseBuf)) {
				fs.rmSync(target);
				report.deleted.push(local);
			} else if (oursBuf) {
				report.conflicts.push(`${local}（上游删除了它，但本仓库改过，已保留）`);
			}
			continue;
		}
		if (!oursBuf) {
			if (status === "A" || !baseBuf) {
				fs.mkdirSync(path.dirname(target), { recursive: true });
				fs.writeFileSync(target, theirsBuf);
				report.added.push(local);
			} else {
				// 本仓库删掉了上游的文件（如示例文章），保持删除
				report.skipped.push(`${local}（本仓库已删除）`);
			}
			continue;
		}
		if (oursBuf.equals(theirsBuf)) continue;
		const files = ["ours", "base", "theirs"].map((n) => path.join(tmpDir, n));
		fs.writeFileSync(files[0], oursBuf);
		fs.writeFileSync(files[1], baseBuf || Buffer.alloc(0));
		fs.writeFileSync(files[2], theirsBuf);
		let merged;
		let conflicted = false;
		try {
			merged = execFileSync(
				"git",
				["merge-file", "-p", "-L", "本仓库", "-L", "上次同步", "-L", "上游", ...files],
				{ maxBuffer: MAX_BUFFER },
			);
		} catch (error) {
			// merge-file 的退出码是冲突块数；输出仍是带冲突标记的合并结果
			if (typeof error.status === "number" && error.status > 0 && error.stdout) {
				merged = error.stdout;
				conflicted = true;
			} else {
				throw error;
			}
		}
		fs.writeFileSync(target, merged);
		(conflicted ? report.conflicts : report.merged).push(local);
	}
} finally {
	fs.rmSync(tmpDir, { recursive: true, force: true });
}

state.lastSynced = theirs;
fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, "\t")}\n`);

const section = (title, list) => {
	if (list.length) console.log(`\n${title}（${list.length}）：\n${list.map((f) => `  ${f}`).join("\n")}`);
};
section("已合并", report.merged);
section("新增", report.added);
section("已删除", report.deleted);
section("保留本仓库版本 / 需重新生成", report.kept);
section("跳过", report.skipped);
section("⚠ 有冲突，需要手动解决", report.conflicts);
console.log(`\nstate.json 已更新为 ${theirs.slice(0, 8)}。`);
process.exit(report.conflicts.length ? 2 : 0);
