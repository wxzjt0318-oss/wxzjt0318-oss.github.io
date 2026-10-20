import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';

export default defineConfig({
  plugins: [vue(), vuetify({ autoImport: true })],
  build: { outDir: 'dist', assetsDir: 'assets' },
  server: {
    // 本地联调：/api 代理到本地随机图 API（生产环境由 EdgeOne Pages Functions 直接处理）
    proxy: {
      '/api': 'http://127.0.0.1:8790',
    },
  },
});
