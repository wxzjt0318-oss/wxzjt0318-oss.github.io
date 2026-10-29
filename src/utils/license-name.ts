import type { LicenseOverride } from "@/types/config";

/**
 * 本站文章的 `licenseName` 字段（早于上游的 `license` 覆写字段）：
 * 改写自萌娘百科的文章是 CC BY-NC-SA 3.0、改写自维基百科的是 CC BY-SA 4.0，
 * 版权卡片要显示这些文章自己的许可证，而不是全站默认值。
 * 只认识的 Creative Commons 名称才覆写；未知名称（如 "Unlicensed"）沿用全站配置。
 */
const CC_LICENSES: Record<string, string> = {
	"CC BY 4.0": "https://creativecommons.org/licenses/by/4.0/",
	"CC BY-SA 4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
	"CC BY-NC-SA 3.0": "https://creativecommons.org/licenses/by-nc-sa/3.0/",
	"CC BY-NC-SA 4.0": "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};

export function licenseOverrideFromName(
	name: string | undefined,
): LicenseOverride | undefined {
	const key = name?.trim() ?? "";
	const url = CC_LICENSES[key];
	return url ? { name: key, url } : undefined;
}
