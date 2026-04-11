import { MediaWikiApi } from 'wiki-saikou';

const MOEGIRL_API_URL = 'https://zh.moegirl.org.cn/api.php';

export class MoegirlWikiSDK {
    constructor() {
        this.api = new MediaWikiApi(MOEGIRL_API_URL);
    }

    async search(query, limit = 10) {
        try {
            const result = await this.api.get({
                action: 'opensearch',
                search: query,
                limit: limit,
                namespace: 0,
            });

            const data = result.response?.data || result;

            if (Array.isArray(data) && data.length >= 2) {
                const [, titles, descriptions, urls] = data;
                return titles.map((title, index) => ({
                    title,
                    description: descriptions?.[index] || '',
                    url: urls?.[index] || '',
                }));
            }

            return [];
        } catch (error) {
            console.error(`搜索失败: ${error.message}`);
            return [];
        }
    }

    async getPage(pageName) {
        try {
            const result = await this.api.get({
                action: 'query',
                titles: pageName,
                prop: 'extracts|categories|info',
                exintro: false,
                explaintext: true,
                exsectionformat: 'plain',
                cllimit: 20,
            });

            const data = result.response?.data || result;

            if (data.query?.pages) {
                const pages = Object.values(data.query.pages);
                const page = pages[0];

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
        try {
            const result = await this.api.get({
                action: 'parse',
                page: pageName,
                prop: 'sections',
            });

            const data = result.response?.data || result;

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
        try {
            const result = await this.api.get({
                action: 'query',
                pageids: pageId,
                prop: 'extracts|categories|info',
                exintro: false,
                explaintext: true,
                exsectionformat: 'plain',
                cllimit: 20,
            });

            const data = result.response?.data || result;

            if (data.query?.pages) {
                const pages = Object.values(data.query.pages);
                const page = pages[0];

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

export const moegirlSdk = new MoegirlWikiSDK();

export async function searchMoegirlSDK(query, limit = 10) {
    return moegirlSdk.search(query, limit);
}

export async function getMoegirlPageSDK(pageName) {
    return moegirlSdk.getPage(pageName);
}

export async function getMoegirlSectionsSDK(pageName) {
    return moegirlSdk.getPageSections(pageName);
}
