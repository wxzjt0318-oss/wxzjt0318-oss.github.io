import type {
	LicenseConfig,
	LicenseOverrideInput,
	ResolvedLicenseConfig,
} from "@/types/config";

/**
 * 解析单篇文章的版权配置：frontmatter 中显式提供的字段优先，
 * 作者缺省回退到站点作者名，其余字段回退到全站 licenseConfig。
 */
export function resolveLicenseConfig(
	base: LicenseConfig,
	override?: LicenseOverrideInput | null,
	fallbackAuthor = "",
): ResolvedLicenseConfig {
	const input = typeof override === "string" ? { name: override } : override;
	const name = input?.name?.trim();
	const url = input?.url?.trim();
	const source = input?.source?.trim() || "";
	const author = input?.author;
	const authorName =
		(typeof author === "string" ? author : author?.name)?.trim() ||
		fallbackAuthor;
	const authorUrl =
		(typeof author === "object" ? author?.url?.trim() : "") || "";

	return {
		enable: input?.enable ?? base.enable,
		name: name || base.name,
		url: url || base.url,
		author: {
			name: authorName,
			url: authorUrl,
		},
		source,
	};
}
