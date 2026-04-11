export class MediaWikiApi {
    constructor(baseUrl = "https://zh.moegirl.org.cn/api.php") {
        this.baseUrl = baseUrl;
    }

    async fetchWithTimeout(url, options = {}, timeout = 15000) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept": "application/json",
                    ...options.headers,
                },
            });
            clearTimeout(timer);
            return response;
        } catch (error) {
            clearTimeout(timer);
            throw error;
        }
    }

    async openSearch(query, limit = 10) {
        const params = new URLSearchParams({
            action: "opensearch",
            search: query,
            namespace: "0",
            limit: limit.toString(),
            format: "json",
        });

        try {
            const response = await this.fetchWithTimeout(`${this.baseUrl}?${params}`, {
                redirect: "follow",
            });

            const data = await response.json();

            if (Array.isArray(data) && data.length >= 2) {
                const [, titles, , description] = data;
                return titles.map((title, index) => ({
                    title: title,
                    description: description?.[index] || '',
                }));
            }

            return [];
        } catch (error) {
            console.error(`OpenSearch 失败: ${error.message}`);
            return [];
        }
    }

    async search(query, limit = 10) {
        return this.openSearch(query, limit);
    }

    async getPage(pageName) {
        const params = new URLSearchParams({
            action: "query",
            titles: pageName,
            prop: "extracts|info|categories",
            exintro: "false",
            explaintext: "true",
            exsectionformat: "plain",
            format: "json",
            formatversion: "2",
            cllimit: "20",
        });

        try {
            const response = await this.fetchWithTimeout(`${this.baseUrl}?${params}`);
            const data = await response.json();

            if (data.query?.pages) {
                const page = Object.values(data.query.pages)[0];
                if (page.missing) {
                    return null;
                }

                return {
                    title: page.title,
                    pageid: page.pageid,
                    extract: page.extract || '',
                    categories: page.categories?.map(c => c.title.replace('Category:', '')) || [],
                };
            }

            return null;
        } catch (error) {
            console.error(`获取页面失败: ${error.message}`);
            return null;
        }
    }

    async getPageSections(pageName) {
        const params = new URLSearchParams({
            action: "parse",
            page: pageName,
            prop: "sections",
            format: "json",
            formatversion: "2",
        });

        try {
            const response = await this.fetchWithTimeout(`${this.baseUrl}?${params}`);
            const data = await response.json();

            if (data.parse?.sections) {
                return data.parse.sections.map(s => ({
                    index: s.index,
                    title: s.line,
                    level: s.level,
                }));
            }

            return [];
        } catch (error) {
            console.error(`获取章节失败: ${error.message}`);
            return [];
        }
    }

    async getPageById(pageId) {
        const params = new URLSearchParams({
            action: "query",
            pageids: pageId,
            prop: "extracts|info|categories",
            exintro: "false",
            explaintext: "true",
            exsectionformat: "plain",
            format: "json",
            formatversion: "2",
            cllimit: "20",
        });

        try {
            const response = await this.fetchWithTimeout(`${this.baseUrl}?${params}`);
            const data = await response.json();

            if (data.query?.pages) {
                const page = Object.values(data.query.pages)[0];
                if (page.missing) {
                    return null;
                }

                return {
                    title: page.title,
                    pageid: page.pageid,
                    extract: page.extract || '',
                    categories: page.categories?.map(c => c.title.replace('Category:', '')) || [],
                };
            }

            return null;
        } catch (error) {
            console.error(`通过ID获取页面失败: ${error.message}`);
            return null;
        }
    }
}

export const moegirlApi = new MediaWikiApi();

export async function searchMoegirlDirect(query, limit = 10) {
    return moegirlApi.search(query, limit);
}

export async function getMoegirlPageDirect(pageName) {
    return moegirlApi.getPage(pageName);
}

export async function getMoegirlSectionsDirect(pageName) {
    return moegirlApi.getPageSections(pageName);
}
