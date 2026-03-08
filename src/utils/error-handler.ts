import { writable, get } from 'svelte/store';

export type ErrorLevel = 'info' | 'warning' | 'error' | 'fatal';

export interface AppError {
    code: string;
    message: string;
    level: ErrorLevel;
    timestamp: number;
    retry?: () => void;
}

// Error Store using Svelte Store
export const errorStore = writable<AppError[]>([]);

// Error Code Mapping
const ERROR_MESSAGES: Record<string, { en: string; zh: string }> = {
    '400': { en: 'Bad Request', zh: '请求参数错误' },
    '401': { en: 'Unauthorized', zh: '未授权，请登录' },
    '403': { en: 'Forbidden', zh: '拒绝访问' },
    '404': { en: 'Not Found', zh: '资源未找到' },
    '408': { en: 'Request Timeout', zh: '请求超时，请检查网络' },
    '500': { en: 'Internal Server Error', zh: '服务器内部错误' },
    '502': { en: 'Bad Gateway', zh: '网关错误' },
    '503': { en: 'Service Unavailable', zh: '服务暂时不可用' },
    '504': { en: 'Gateway Timeout', zh: '网关超时' },
    'NETWORK_ERROR': { en: 'Network Error', zh: '网络连接失败，请检查您的网络设置' },
    'TIMEOUT': { en: 'Operation Timed Out', zh: '操作超时，系统将自动重试' },
};

export class ErrorHandler {
    private static instance: ErrorHandler;
    private language: 'en' | 'zh' = 'zh';

    private constructor() {
        if (typeof window !== 'undefined') {
            this.language = document.documentElement.lang === 'en' ? 'en' : 'zh';
        }
    }

    public static getInstance(): ErrorHandler {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler();
        }
        return ErrorHandler.instance;
    }

    public getMessage(code: string): string {
        const msg = ERROR_MESSAGES[code] || ERROR_MESSAGES['500'];
        return msg[this.language];
    }

    public handleError(error: any, context?: string, retry?: () => void) {
        console.error(`[ErrorHandler] ${context || 'Error'}:`, error);

        let code = '500';
        let level: ErrorLevel = 'error';

        if (error.name === 'AbortError' || error.message?.includes('timeout')) {
            code = 'TIMEOUT';
            level = 'warning';
        } else if (error.message === 'Network Error') {
            code = 'NETWORK_ERROR';
        } else if (error.response) {
            code = error.response.status.toString();
        }

        const appError: AppError = {
            code,
            message: this.getMessage(code),
            level,
            timestamp: Date.now(),
            retry
        };

        // Add to store
        const currentErrors = get(errorStore);
        errorStore.set([...currentErrors, appError]);

        // Auto-remove toast after 2.5s if it's info/warning
        if (level !== 'fatal') {
            setTimeout(() => {
                this.dismissError(appError.timestamp);
            }, 2500);
        }
    }

    public dismissError(timestamp: number) {
        const currentErrors = get(errorStore);
        errorStore.set(currentErrors.filter(e => e.timestamp !== timestamp));
    }
}

export const errorHandler = ErrorHandler.getInstance();
