// 配置读写：config/storages.json（存储档案，gitignored）、config/settings.json（处理参数）
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOL_SRC = path.dirname(fileURLToPath(import.meta.url));

/** 仓库根目录 = tool/src 上溯两级 */
export const REPO_ROOT = path.resolve(TOOL_SRC, '../..');
export const CONFIG_DIR = path.join(REPO_ROOT, 'config');
export const TOOL_DATA_DIR = path.join(REPO_ROOT, 'tool', 'data');
export const WEB_DATA_DIR = path.join(REPO_ROOT, 'web', 'public', 'data');

export const DEFAULT_SETTINGS = {
  avif: { quality: 60, effort: 4, maxDimension: { pc: 3840, phone: 2160, both: 2560 } },
  thumb: { width: 640, quality: 55 },
  pool: { pcMinRatio: 1.2, phoneMaxRatio: 0.9 },
  rename: { hashLength: 8, timezone: '+08:00' },
};

function deepMerge(base, over) {
  for (const k of Object.keys(over || {})) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k])) {
      deepMerge((base[k] = base[k] || {}), over[k]);
    } else {
      base[k] = over[k];
    }
  }
  return base;
}

export function loadStorages() {
  const p = path.join(CONFIG_DIR, 'storages.json');
  if (!existsSync(p)) return { storages: [], defaultStorageId: null };
  return JSON.parse(readFileSync(p, 'utf-8'));
}

export function saveStorages(data) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(path.join(CONFIG_DIR, 'storages.json'), JSON.stringify(data, null, 2), 'utf-8');
}

export function loadSettings() {
  const p = path.join(CONFIG_DIR, 'settings.json');
  if (!existsSync(p)) return structuredClone(DEFAULT_SETTINGS);
  try {
    return deepMerge(structuredClone(DEFAULT_SETTINGS), JSON.parse(readFileSync(p, 'utf-8')));
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export function getStorage(id) {
  const { storages, defaultStorageId } = loadStorages();
  const target = id
    ? storages.find((s) => s.id === id)
    : storages.find((s) => s.id === defaultStorageId) || storages[0];
  if (!target) throw new Error(`存储配置不存在：${id || '(默认)'}，请先运行 rp storage add`);
  return target;
}

export function getStorageById(id) {
  const { storages } = loadStorages();
  const s = storages.find((x) => x.id === id);
  if (!s) throw new Error(`存储配置不存在：${id}`);
  return s;
}
